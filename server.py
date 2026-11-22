import os
import sys
import json
import asyncio
import re
import socket
import subprocess
import shutil
from pathlib import Path
from urllib.parse import urlparse, quote
import aiohttp
from aiohttp import web, WSMsgType

# Garante suporte a UTF-8 no Windows
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

APP_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = APP_DIR / "public"

# Garante que a pasta public exista (caso o upload do GitHub tenha colocado os arquivos na raiz)
if not PUBLIC_DIR.exists():
    try:
        PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
        for fname in ["index.html", "style.css", "app.js", "icon.ico"]:
            src_f = APP_DIR / fname
            if src_f.exists():
                shutil.copy2(src_f, PUBLIC_DIR / fname)
    except Exception as e:
        print(f"Aviso ao preparar pasta public: {e}")

CLOUDFLARED_EXE = APP_DIR / "cloudflared.exe"

import time

# --- CONFIGURAÇÃO IPTV & CINEMA 24/7 ---
IPTV_DNS = os.environ.get("IPTV_DNS", "http://acessoza.sbs")
IPTV_USER = os.environ.get("IPTV_USER", "9780108843")
IPTV_PASS = os.environ.get("IPTV_PASS", "8335606215")

# Estado das 3 Salas de Cinema (Com Sincronização em Tempo Real)
cinema_rooms = {
    "cinema-1": None,  # { streamId, streamName, streamType, ext, poster, startedBy, startedById, currentTime, isPlaying, updatedAt }
    "cinema-2": None,
    "cinema-3": None
}

def get_cinema_state(room):
    c = cinema_rooms.get(room)
    if not c:
        return None
    now = time.time()
    elapsed = (now - c.get("updatedAt", now)) if c.get("isPlaying") else 0
    return {
        **c,
        "currentTime": round(c.get("currentTime", 0.0) + elapsed, 2)
    }

iptv_cache_categories = {}  # type -> list
iptv_cache_streams = {}     # (type, cat_id) -> list
http_session = None

async def get_http_session():
    global http_session
    if http_session is None or http_session.closed:
        timeout = aiohttp.ClientTimeout(total=30, connect=10)
        http_session = aiohttp.ClientSession(timeout=timeout, headers={"User-Agent": "IPTVSmartersPro"})
    return http_session

# Estado do Servidor
clients = {}  # ws -> { id, username, avatar, voiceChannel, isMuted, isDeafened, isStreaming, streamInfo }
public_tunnel_url = None
cloudflared_proc = None

# Membros Cadastrados Permanentes (Integrantes do Servidor)
MEMBERS_FILE = APP_DIR / "members.json"

def load_members():
    if MEMBERS_FILE.exists():
        try:
            with open(MEMBERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_members(members):
    try:
        with open(MEMBERS_FILE, "w", encoding="utf-8") as f:
            json.dump(members, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

server_members = load_members()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

async def broadcast(message, exclude_ws=None):
    payload = json.dumps(message)
    dead = []
    for ws in list(clients.keys()):
        if ws == exclude_ws:
            continue
        try:
            await ws.send_str(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        clients.pop(ws, None)

async def send_to_user(target_user_id, message):
    payload = json.dumps(message)
    for ws, user in list(clients.items()):
        if user.get("id") == target_user_id:
            try:
                await ws.send_str(payload)
            except Exception:
                pass

# --- Rotas HTTP ---
async def index_handler(request):
    index_file = PUBLIC_DIR / "index.html"
    if index_file.exists():
        return web.FileResponse(index_file)
    fallback = APP_DIR / "index.html"
    if fallback.exists():
        return web.FileResponse(fallback)
    return web.Response(text="index.html não encontrado", status=404)

async def tunnel_api(request):
    return web.json_response({"publicUrl": public_tunnel_url})

# --- ROTAS DA API IPTV & CINEMA ---
async def iptv_categories_handler(request):
    cat_type = request.query.get("type", "live")
    if cat_type in iptv_cache_categories:
        return web.json_response(iptv_cache_categories[cat_type])

    action = f"get_{cat_type}_categories"
    url = f"{IPTV_DNS}/player_api.php?username={IPTV_USER}&password={IPTV_PASS}&action={action}"
    try:
        session = await get_http_session()
        async with session.get(url) as resp:
            if resp.status == 200:
                data = await resp.json(content_type=None)
                iptv_cache_categories[cat_type] = data
                return web.json_response(data)
    except Exception as e:
        print(f"[IPTV] Erro ao buscar categorias {cat_type}: {e}")
    return web.json_response([])

async def iptv_streams_handler(request):
    cat_type = request.query.get("type", "live")
    cat_id = request.query.get("category_id", "")
    cache_key = (cat_type, cat_id)
    if cache_key in iptv_cache_streams:
        return web.json_response(iptv_cache_streams[cache_key])

    if cat_type == "series":
        action = "get_series"
    elif cat_type in ("movie", "vod"):
        action = "get_vod_streams"
    else:
        action = "get_live_streams"

    url = f"{IPTV_DNS}/player_api.php?username={IPTV_USER}&password={IPTV_PASS}&action={action}"
    if cat_id:
        url += f"&category_id={cat_id}"
    try:
        session = await get_http_session()
        async with session.get(url) as resp:
            if resp.status == 200:
                data = await resp.json(content_type=None)
                iptv_cache_streams[cache_key] = data
                return web.json_response(data)
    except Exception as e:
        print(f"[IPTV] Erro ao buscar streams {cat_type} {cat_id}: {e}")
    return web.json_response([])

async def iptv_series_info_handler(request):
    series_id = request.query.get("series_id", "")
    if not series_id:
        return web.json_response({})
    url = f"{IPTV_DNS}/player_api.php?username={IPTV_USER}&password={IPTV_PASS}&action=get_series_info&series_id={series_id}"
    try:
        session = await get_http_session()
        async with session.get(url) as resp:
            if resp.status == 200:
                data = await resp.json(content_type=None)
                return web.json_response(data)
    except Exception as e:
        print(f"[IPTV] Erro ao buscar info da série {series_id}: {e}")
    return web.json_response({})

async def iptv_direct_stream_handler(request):
    stream_id = request.match_info.get("stream_id")
    target_url = f"{IPTV_DNS}/live/{IPTV_USER}/{IPTV_PASS}/{stream_id}.ts"
    try:
        session = await get_http_session()
        headers = {"User-Agent": "IPTVSmartersPro"}
        async with session.get(target_url, headers=headers, allow_redirects=True) as resp:
            response = web.StreamResponse(
                status=resp.status,
                headers={
                    "Content-Type": "video/mp2t",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "no-cache, no-store",
                    "Connection": "keep-alive"
                }
            )
            await response.prepare(request)
            async for chunk in resp.content.iter_chunked(65536):
                await response.write(chunk)
            await response.write_eof()
            return response
    except Exception as e:
        print(f"[IPTV] Erro no stream direto TS: {e}")
    return web.Response(status=502)

async def iptv_live_m3u8_handler(request):
    stream_id = request.match_info.get("stream_id")
    url = f"{IPTV_DNS}/live/{IPTV_USER}/{IPTV_PASS}/{stream_id}.m3u8"
    try:
        session = await get_http_session()
        async with session.get(url, allow_redirects=True) as resp:
            if resp.status == 200:
                text = await resp.text(encoding='utf-8', errors='ignore')
                final_url = str(resp.url)
                parsed = urlparse(final_url)
                edge_host = f"{parsed.scheme}://{parsed.netloc}"

                lines = []
                for line in text.splitlines():
                    s = line.strip()
                    if not s or s.startswith("#"):
                        lines.append(line)
                        continue
                    if s.startswith("http://") or s.startswith("https://"):
                        parsed_s = urlparse(s)
                        seg_edge = f"{parsed_s.scheme}://{parsed_s.netloc}"
                        seg_path = parsed_s.path
                        if parsed_s.query:
                            seg_path += "?" + parsed_s.query
                    else:
                        seg_edge = edge_host
                        seg_path = s if s.startswith("/") else "/" + s
                    proxied_ts = f"/api/iptv/ts?edge={quote(seg_edge)}&path={quote(seg_path)}"
                    lines.append(proxied_ts)

                rewritten_m3u8 = "\n".join(lines)
                return web.Response(
                    text=rewritten_m3u8,
                    content_type="application/vnd.apple.mpegurl",
                    headers={
                        "Access-Control-Allow-Origin": "*",
                        "Cache-Control": "no-cache, no-store, must-revalidate"
                    }
                )
    except Exception as e:
        print(f"[IPTV] Erro no live m3u8: {e}")
    return web.Response(status=502, text="Erro ao conectar ao canal IPTV")

async def iptv_ts_chunk_handler(request):
    edge = request.query.get("edge", "")
    path = request.query.get("path", "")
    if not edge or not path:
        return web.Response(status=400, text="Parâmetros inválidos")

    target_url = edge.rstrip("/") + "/" + path.lstrip("/")
    try:
        session = await get_http_session()
        headers = {"User-Agent": "IPTVSmartersPro"}
        if "Range" in request.headers:
            headers["Range"] = request.headers["Range"]

        async with session.get(target_url, headers=headers, allow_redirects=True) as resp:
            response = web.StreamResponse(
                status=resp.status,
                headers={
                    "Content-Type": "video/mp2t",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "max-age=60"
                }
            )
            if "Content-Length" in resp.headers:
                response.headers["Content-Length"] = resp.headers["Content-Length"]
            if "Accept-Ranges" in resp.headers:
                response.headers["Accept-Ranges"] = resp.headers["Accept-Ranges"]

            await response.prepare(request)
            async for chunk in resp.content.iter_chunked(65536):
                await response.write(chunk)
            await response.write_eof()
            return response
    except Exception as e:
        print(f"[IPTV] Erro ao servir TS: {e}")
    return web.Response(status=502)

async def iptv_vod_stream_handler(request):
    stream_id = request.match_info.get("stream_id")
    ext = request.query.get("ext", "mp4")
    stream_type = request.query.get("type", "movie")
    target_url = f"{IPTV_DNS}/{stream_type}/{IPTV_USER}/{IPTV_PASS}/{stream_id}.{ext}"

    try:
        session = await get_http_session()
        headers = {"User-Agent": "IPTVSmartersPro"}
        if "Range" in request.headers:
            headers["Range"] = request.headers["Range"]

        final_target = target_url
        try:
            async with session.get(target_url, headers=headers, allow_redirects=False) as resp_init:
                if resp_init.status in (301, 302, 307, 308) and "Location" in resp_init.headers:
                    loc = resp_init.headers["Location"]
                    if "hubby.run" in loc:
                        loc = loc.replace("hubby.run", "hubby-dmca.com")
                    final_target = loc
        except Exception:
            pass

        async with session.get(final_target, headers=headers, allow_redirects=True) as resp:
            response = web.StreamResponse(
                status=resp.status,
                headers={
                    "Content-Type": resp.headers.get("Content-Type", "video/mp4"),
                    "Access-Control-Allow-Origin": "*",
                    "Accept-Ranges": "bytes"
                }
            )
            if "Content-Length" in resp.headers:
                response.headers["Content-Length"] = resp.headers["Content-Length"]
            if "Content-Range" in resp.headers:
                response.headers["Content-Range"] = resp.headers["Content-Range"]

            await response.prepare(request)
            async for chunk in resp.content.iter_chunked(65536):
                await response.write(chunk)
            await response.write_eof()
            return response
    except Exception as e:
        print(f"[IPTV] Erro no stream VOD/Série: {e}")
    return web.Response(status=502)

# --- WebSocket Signalling ---
async def websocket_handler(request):
    ws = web.WebSocketResponse(heartbeat=10.0)
    await ws.prepare(request)

    user_id = None
    try:
        async for msg in ws:
            if msg.type != WSMsgType.TEXT:
                continue

            try:
                data = json.loads(msg.data)
            except Exception:
                continue

            msg_type = data.get("type")

            # 1. Login inicial do usuário
            if msg_type == "join":
                user_id = data.get("id")
                username = data.get("username", f"Usuário_{user_id[:4]}").strip()
                avatar = data.get("avatar", "#5865F2")

                # Regra: 1 só login por usuário.
                # Desconecta qualquer sessão anterior do mesmo usuário ou mesmo nome
                old_sessions = [
                    old_ws for old_ws, u in list(clients.items())
                    if old_ws != ws and (u.get("id") == user_id or u.get("username").lower() == username.lower())
                ]
                for old_ws in old_sessions:
                    try:
                        await old_ws.send_str(json.dumps({
                            "type": "force_disconnect",
                            "reason": "Você se conectou em outra aba ou dispositivo."
                        }))
                        await old_ws.close()
                    except Exception:
                        pass
                    clients.pop(old_ws, None)

                clients[ws] = {
                    "id": user_id,
                    "username": username,
                    "avatar": avatar,
                    "voiceChannel": None,  # Inicialmente fora de qualquer sala de voz
                    "isMuted": False,
                    "isDeafened": False,
                    "isStreaming": False,
                    "streamInfo": None
                }

                is_new_member = (user_id not in server_members)
                server_members[user_id] = {
                    "id": user_id,
                    "username": username,
                    "avatar": avatar,
                    "joinedAt": server_members.get(user_id, {}).get("joinedAt", int(time.time()))
                }
                save_members(server_members)

                # Responde ao usuário com estado inicial e link do túnel
                all_users = list(clients.values())
                online_ids = [u["id"] for u in clients.values()]
                await ws.send_str(json.dumps({
                    "type": "init_state",
                    "selfId": user_id,
                    "users": all_users,
                    "members": list(server_members.values()),
                    "onlineIds": online_ids,
                    "publicTunnelUrl": public_tunnel_url,
                    "cinemaRooms": { r: get_cinema_state(r) for r in cinema_rooms }
                }))

                # Notifica todos os outros participantes
                await broadcast({
                    "type": "user_joined",
                    "user": clients[ws],
                    "isNewMember": is_new_member,
                    "member": server_members[user_id]
                }, exclude_ws=ws)

            # 1.1 Saída imediata (quando fecha a aba ou sai)
            elif msg_type == "leave":
                break

            # 2. Mudança de canal de voz
            elif msg_type == "voice_change":
                if ws in clients:
                    clients[ws]["voiceChannel"] = data.get("channelId")
                    await broadcast({
                        "type": "user_voice_change",
                        "userId": user_id,
                        "channelId": clients[ws]["voiceChannel"]
                    })

            # 2.2 Mover outro usuário de canal de voz
            elif msg_type == "move_user":
                target_id = data.get("targetUserId")
                new_channel = data.get("channelId")
                moved_username = None
                for target_ws, u in clients.items():
                    if u.get("id") == target_id:
                        u["voiceChannel"] = new_channel
                        moved_username = u.get("username")
                        break
                if target_id and new_channel:
                    mover_name = clients[ws]["username"] if ws in clients else "Alguém"
                    await broadcast({
                        "type": "user_voice_change",
                        "userId": target_id,
                        "channelId": new_channel,
                        "movedBy": mover_name,
                        "movedUser": moved_username
                    })

            # 2.1 Atualização de Perfil (Mudar Nome / Avatar)
            elif msg_type == "update_profile":
                if ws in clients:
                    clients[ws]["username"] = data.get("username", clients[ws]["username"])
                    clients[ws]["avatar"] = data.get("avatar", clients[ws]["avatar"])
                    if user_id in server_members:
                        server_members[user_id]["username"] = clients[ws]["username"]
                        server_members[user_id]["avatar"] = clients[ws]["avatar"]
                        save_members(server_members)
                    await broadcast({
                        "type": "user_updated",
                        "user": clients[ws],
                        "member": server_members.get(user_id)
                    })

            # 3. Transmissão de tela 60 FPS iniciada
            elif msg_type == "screen_start":
                if ws in clients:
                    clients[ws]["isStreaming"] = True
                    clients[ws]["streamInfo"] = data.get("streamInfo", {})
                    await broadcast({
                        "type": "stream_started",
                        "userId": user_id,
                        "username": clients[ws]["username"],
                        "streamInfo": clients[ws]["streamInfo"]
                    })

            # 4. Transmissão de tela encerrada
            elif msg_type == "screen_stop":
                if ws in clients:
                    clients[ws]["isStreaming"] = False
                    clients[ws]["streamInfo"] = None
                    await broadcast({
                        "type": "stream_stopped",
                        "userId": user_id
                    })

            # 5. Estado de voz (Mute / Deafen / Falando)
            elif msg_type == "voice_state":
                if ws in clients:
                    clients[ws]["isMuted"] = data.get("isMuted", clients[ws]["isMuted"])
                    clients[ws]["isDeafened"] = data.get("isDeafened", clients[ws]["isDeafened"])
                    await broadcast({
                        "type": "voice_state_update",
                        "userId": user_id,
                        "isMuted": clients[ws]["isMuted"],
                        "isDeafened": clients[ws]["isDeafened"],
                        "isSpeaking": data.get("isSpeaking", False)
                    })

            # 6. Sinalização WebRTC (P2P de Voz e Vídeo 60 FPS)
            elif msg_type in ("webrtc_offer", "webrtc_answer", "webrtc_ice"):
                target = data.get("target")
                if target:
                    data["sender"] = user_id
                    await send_to_user(target, data)

            # 7. Mensagem de texto no chat
            elif msg_type == "chat_message":
                if ws in clients:
                    await broadcast({
                        "type": "chat_message",
                        "senderId": user_id,
                        "username": clients[ws]["username"],
                        "avatar": clients[ws]["avatar"],
                        "text": data.get("text", ""),
                        "timestamp": data.get("timestamp")
                    })

            # 8. Transmissão IPTV Cinema Sincronizada
            elif msg_type == "cinema_play":
                room = data.get("room")
                if room in cinema_rooms:
                    cinema_rooms[room] = {
                        "streamId": data.get("streamId"),
                        "streamName": data.get("streamName"),
                        "streamType": data.get("streamType", "live"),
                        "ext": data.get("ext", "mp4"),
                        "poster": data.get("poster", ""),
                        "startedBy": clients[ws]["username"] if ws in clients else "Alguém",
                        "startedById": user_id,
                        "currentTime": 0.0,
                        "isPlaying": True,
                        "updatedAt": time.time()
                    }
                    await broadcast({
                        "type": "cinema_update",
                        "room": room,
                        "cinema": cinema_rooms[room]
                    })

            # 8.1 Sincronização de Play/Pause/Minuto (Apenas pelo Dono que iniciou)
            elif msg_type == "cinema_sync":
                room = data.get("room")
                cinema = cinema_rooms.get(room)
                if cinema and cinema.get("startedById") == user_id:
                    cinema["currentTime"] = float(data.get("currentTime", 0.0))
                    cinema["isPlaying"] = bool(data.get("isPlaying", True))
                    cinema["updatedAt"] = time.time()
                    await broadcast({
                        "type": "cinema_sync",
                        "room": room,
                        "currentTime": cinema["currentTime"],
                        "isPlaying": cinema["isPlaying"],
                        "startedById": user_id
                    }, exclude_ws=ws)

            # 8.2 Encerrar Transmissão Cinema
            elif msg_type == "cinema_stop":
                room = data.get("room")
                cinema = cinema_rooms.get(room)
                active_user_ids = [u.get("id") for u in clients.values()]
                # Pode parar se for o dono ou se o dono já saiu do servidor
                if cinema and (cinema.get("startedById") == user_id or cinema.get("startedById") not in active_user_ids):
                    cinema_rooms[room] = None
                    await broadcast({
                        "type": "cinema_update",
                        "room": room,
                        "cinema": None
                    })

    finally:
        if ws in clients:
            leaving_user = clients.pop(ws)
            await broadcast({
                "type": "user_left",
                "userId": user_id,
                "username": leaving_user["username"]
            })
    return ws

# --- Túnel Cloudflare para Amigos em Outras Cidades ---
async def start_cloudflare_tunnel(port=8080):
    global public_tunnel_url, cloudflared_proc
    if not CLOUDFLARED_EXE.exists():
        print("[!] cloudflared.exe não encontrado. Conexão externa via internet desativada.")
        return

    print("🌐 Iniciando Túnel Cloudflare seguro (HTTPS) para amigos de outras cidades...")
    cmd = [str(CLOUDFLARED_EXE), "tunnel", "--url", f"http://127.0.0.1:{port}", "--no-autoupdate"]

    try:
        cloudflared_proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        async def read_stream(stream):
            global public_tunnel_url
            while True:
                line = await stream.readline()
                if not line:
                    break
                text = line.decode('utf-8', errors='ignore')
                match = re.search(r'(https://[a-zA-Z0-9-]+\.trycloudflare\.com)', text)
                if match:
                    public_tunnel_url = match.group(1)
                    print("\n" + "=" * 65)
                    print(" 🚀 LINK PÚBLICO PARA SEUS AMIGOS EM OUTRAS CIDADES:")
                    print(f" 👉 {public_tunnel_url}")
                    print(" (Envie este link no WhatsApp/Discord para seus amigos!)")
                    print("=" * 65 + "\n")
                    await broadcast({
                        "type": "tunnel_ready",
                        "publicTunnelUrl": public_tunnel_url
                    })
                    break

        asyncio.create_task(read_stream(cloudflared_proc.stderr))
        asyncio.create_task(read_stream(cloudflared_proc.stdout))
    except Exception as e:
        print(f"[!] Erro ao iniciar cloudflared: {e}")

async def on_startup(app):
    port = app.get("server_port", 8080)
    # Só tenta iniciar o túnel Cloudflare se estiver no Windows, com o .exe presente e fora de ambientes cloud (ex: Render)
    if sys.platform == 'win32' and not os.environ.get("RENDER") and CLOUDFLARED_EXE.exists():
        asyncio.create_task(start_cloudflare_tunnel(port))

async def on_cleanup(app):
    global cloudflared_proc
    if cloudflared_proc:
        try:
            cloudflared_proc.terminate()
        except Exception:
            pass

def init_app(port=8080):
    app = web.Application()
    app["server_port"] = port
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    app.router.add_get("/", index_handler)
    app.router.add_get("/api/tunnel-url", tunnel_api)
    app.router.add_get("/api/iptv/categories", iptv_categories_handler)
    app.router.add_get("/api/iptv/streams", iptv_streams_handler)
    app.router.add_get("/api/iptv/series_info", iptv_series_info_handler)
    app.router.add_get("/api/iptv/stream/{stream_id}.ts", iptv_direct_stream_handler)
    app.router.add_get("/api/iptv/live/{stream_id}.m3u8", iptv_live_m3u8_handler)
    app.router.add_get("/api/iptv/ts", iptv_ts_chunk_handler)
    app.router.add_get("/api/iptv/vod/{stream_id}", iptv_vod_stream_handler)
    app.router.add_get("/ws", websocket_handler)
    app.router.add_static("/", PUBLIC_DIR)
    return app

if __name__ == "__main__":
    local_ip = get_local_ip()
    port = int(os.environ.get("PORT", 8080))
    print("=" * 65)
    print("   🎮 DISCORD 60 FPS + 2K STREAM & VOICE")
    print("=" * 65)
    print(f" ✅ Servidor rodando com sucesso!")
    print(f" 💻 Porta em escuta:         {port}")
    print(f" 💻 Acesso local:           http://localhost:{port}")
    if sys.platform == 'win32' and not os.environ.get("RENDER"):
        print(f" 🏠 Rede local (Wi-Fi):     http://{local_ip}:{port}")
        print(" 🌍 Gerando link público HTTPS para outras cidades...")
    print("=" * 65)

    app = init_app(port)
    web.run_app(app, host="0.0.0.0", port=port, print=False)
