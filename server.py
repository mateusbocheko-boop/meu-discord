import os
import sys
import json
import asyncio
import re
import socket
import subprocess
import shutil
import uuid
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

# Garante que a pasta public exista e SEMPRE sincroniza arquivos da raiz para public/ (caso o upload do GitHub tenha sido feito na raiz)
try:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    for fname in ["index.html", "style.css", "app.js", "icon.ico", "manifest.json", "sw.js", "icon-192.png", "icon-512.png", "qrcode.min.js"]:
        src_f = APP_DIR / fname
        dst_f = PUBLIC_DIR / fname
        if src_f.exists():
            shutil.copy2(src_f, dst_f)
            print(f"[Sync] Arquivo {fname} sincronizado da raiz para public/")
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
        connector = aiohttp.TCPConnector(
            limit=200,
            limit_per_host=50,
            ttl_dns_cache=300,
            keepalive_timeout=75,
            enable_cleanup_closed=True
        )
        timeout = aiohttp.ClientTimeout(total=None, connect=10, sock_read=30)
        http_session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={"User-Agent": "IPTVSmartersPro/2.2.2.1"}
        )
    return http_session

# Estado do Servidor
clients = {}  # ws -> { id, username, avatar, voiceChannel, isMuted, isDeafened, isStreaming, streamInfo }
public_tunnel_url = None
cloudflared_proc = None

# Membros Cadastrados Permanentes (Integrantes do Servidor)
MEMBERS_FILE = APP_DIR / "members.json"
CHANNELS_FILE = APP_DIR / "channels.json"
BANNED_FILE = APP_DIR / "banned.json"
OWNERS_FILE = APP_DIR / "owners.json"

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

def load_channels():
    if CHANNELS_FILE.exists():
        try:
            with open(CHANNELS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    default_ch = {
        "text": [
            {"id": "geral", "name": "geral"},
            {"id": "clips-e-lives", "name": "clips-e-lives"},
            {"id": "jogos", "name": "jogos"},
            {"id": "memes", "name": "memes"}
        ],
        "voice": [
            {"id": "geral", "name": "Geral", "type": "voice", "icon": "fa-volume-high"},
            {"id": "jogos-60fps", "name": "Jogos 60FPS", "type": "voice", "icon": "fa-gamepad"},
            {"id": "cinema-1", "name": "Cinema 1 • Filmes", "type": "cinema", "icon": "fa-film"},
            {"id": "cinema-2", "name": "Cinema 2 • Séries", "type": "cinema", "icon": "fa-tv"},
            {"id": "cinema-3", "name": "Cinema 3 • Futebol & TV", "type": "cinema", "icon": "fa-futbol"},
            {"id": "competitivo", "name": "Competitivo / Ranked", "type": "voice", "icon": "fa-trophy"},
            {"id": "bate-papo", "name": "Bate-papo & Chill", "type": "voice", "icon": "fa-mug-hot"},
            {"id": "afk", "name": "AFK / Ausente", "type": "voice", "icon": "fa-bed"}
        ]
    }
    save_channels(default_ch)
    return default_ch

def save_channels(data):
    try:
        with open(CHANNELS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Erro ao salvar canais: {e}")

server_channels = load_channels()

# --- PERSISTÊNCIA DE MENSAGENS, AUDITORIA, ADVERTÊNCIAS E MUTADOS (VOX) ---
DATA_DIR = str(APP_DIR)
MESSAGES_FILE = os.path.join(DATA_DIR, "messages.json")
AUDIT_LOGS_FILE = os.path.join(DATA_DIR, "audit_logs.json")
WARNINGS_FILE = os.path.join(DATA_DIR, "warnings.json")
MUTED_USERS_FILE = os.path.join(DATA_DIR, "muted_users.json")

def load_json_data(file_path, default):
    if os.path.exists(file_path):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"[VOX] Erro ao carregar {file_path}: {e}")
    return default

def save_json_data(file_path, data):
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[VOX] Erro ao salvar {file_path}: {e}")

server_messages = load_json_data(MESSAGES_FILE, [])
server_audit_logs = load_json_data(AUDIT_LOGS_FILE, [])
server_warnings = load_json_data(WARNINGS_FILE, {})
server_muted_users = set(load_json_data(MUTED_USERS_FILE, []))

def save_messages():
    save_json_data(MESSAGES_FILE, server_messages[-1000:])

def save_audit_logs():
    save_json_data(AUDIT_LOGS_FILE, server_audit_logs[-1000:])

def save_warnings():
    save_json_data(WARNINGS_FILE, server_warnings)

def save_muted_users():
    save_json_data(MUTED_USERS_FILE, list(server_muted_users))

def log_audit(action, target_user_id, target_username, performed_by_id, performed_by_name, details=""):
    entry = {
        "id": f"log_{int(time.time()*1000)}",
        "action": action,
        "targetUserId": target_user_id,
        "targetUsername": target_username,
        "performedById": performed_by_id,
        "performedByName": performed_by_name,
        "details": details,
        "timestamp": time.time(),
        "timeStr": time.strftime("%d/%m/%Y %H:%M:%S")
    }
    server_audit_logs.append(entry)
    save_audit_logs()
    return entry

# --- VIP & MULTI-SERVIDORES PERSISTENTES ---
VIPS_FILE = APP_DIR / "vips.json"
SERVERS_FILE = APP_DIR / "servers.json"

def load_vips():
    if VIPS_FILE.exists():
        try:
            with open(VIPS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_vips(data):
    try:
        with open(VIPS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Erro ao salvar VIPs: {e}")

server_vips = load_vips()

def is_user_vip(user_id, username):
    clean_name = (username or "").strip().upper()
    if clean_name == "DIM" or clean_name.startswith("DIM") or "4095" in str(user_id):
        return True
    vdata = server_vips.get(user_id)
    if not vdata:
        return False
    if not vdata.get("isVip"):
        return False
    if vdata.get("isLifetime"):
        return True
    expires = vdata.get("expiresAt")
    if expires and time.time() > expires:
        vdata["isVip"] = False
        save_vips(server_vips)
        return False
    return True

def load_servers():
    if SERVERS_FILE.exists():
        try:
            with open(SERVERS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    default_servers = {
        "default": {
            "id": "default",
            "name": "Kord Oficial",
            "icon": "🔥",
            "ownerId": "DIM#4095",
            "ownerName": "DIM",
            "description": "Comunidade Principal do Kord • Voz, Filmes e 60 FPS",
            "channels": server_channels,
            "members": []
        }
    }
    save_servers(default_servers)
    return default_servers

def save_servers(data):
    try:
        with open(SERVERS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Erro ao salvar servidores: {e}")

all_servers = load_servers()

def get_user_servers(uid):
    res = []
    for s_id, s_data in all_servers.items():
        if s_id == "default" or s_data.get("ownerId") == uid or uid in s_data.get("members", []):
            res.append({
                "id": s_id,
                "name": s_data.get("name", "Servidor"),
                "icon": s_data.get("icon", "🎮"),
                "isOwner": (s_data.get("ownerId") == uid)
            })
    return res


def load_banned():
    if BANNED_FILE.exists():
        try:
            with open(BANNED_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_banned(data):
    try:
        with open(BANNED_FILE, "w", encoding="utf-8") as f:
            json.dump(list(data), f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Erro ao salvar banidos: {e}")

server_banned = load_banned()

def load_owners():
    if OWNERS_FILE.exists():
        try:
            with open(OWNERS_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_owners(data):
    try:
        with open(OWNERS_FILE, "w", encoding="utf-8") as f:
            json.dump(list(data), f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Erro ao salvar donos: {e}")

server_owners = load_owners()

ADMINS_FILE = APP_DIR / "admins.json"

def load_admins():
    if ADMINS_FILE.exists():
        try:
            with open(ADMINS_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_admins(data):
    try:
        with open(ADMINS_FILE, "w", encoding="utf-8") as f:
            json.dump(list(data), f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"Erro ao salvar administradores: {e}")

server_admins = load_admins()

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

async def check_empty_cinema_rooms():
    for room, cinema in list(cinema_rooms.items()):
        if cinema is not None:
            users_in_room = [u for u in clients.values() if u.get("voiceChannel") == room]
            if len(users_in_room) == 0:
                print(f"🎬 [Auto-Stop] Sala {room} ficou vazia (0 pessoas). Encerrando transmissão IPTV.")
                cinema_rooms[room] = None
                stream_id = str(cinema.get("streamId"))
                other_using = any(c and str(c.get("streamId")) == stream_id for r, c in cinema_rooms.items() if r != room)
                if not other_using and stream_id in active_channel_broadcasters:
                    bc = active_channel_broadcasters.pop(stream_id, None)
                    if bc:
                        bc.stop()
                await broadcast({
                    "type": "cinema_update",
                    "room": room,
                    "cinema": None
                })

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

async def download_apk_handler(request):
    apk_local = PUBLIC_DIR / "kord.apk"
    if apk_local.exists():
        return web.FileResponse(apk_local, headers={"Content-Disposition": 'attachment; filename="kord.apk"'})
    apk_root = APP_DIR / "kord.apk"
    if apk_root.exists():
        return web.FileResponse(apk_root, headers={"Content-Disposition": 'attachment; filename="kord.apk"'})
    raise web.HTTPFound("https://github.com/mateusbocheko-boop/meu-discord/releases/download/v1.0.0/kord.apk")

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

# --- GERENCIADOR DE FAN-OUT PARA CANAIS AO VIVO (1 CONEXÃO IPTV PARA MÚLTIPLOS USUÁRIOS) ---
active_channel_broadcasters = {}

class ChannelBroadcaster:
    def __init__(self, stream_id):
        self.stream_id = stream_id
        self.subscribers = set()
        self.task = None
        self.is_running = False

    def stop(self):
        self.is_running = False
        if self.task and not self.task.done():
            self.task.cancel()
        self.subscribers.clear()

    async def run(self):
        self.is_running = True
        url = f"{IPTV_DNS}/live/{IPTV_USER}/{IPTV_PASS}/{self.stream_id}.ts"
        headers = {"User-Agent": "IPTVSmartersPro/2.2.2.1"}
        try:
            session = await get_http_session()
            async with session.get(url, headers=headers, allow_redirects=True) as resp:
                if resp.status == 200:
                    async for chunk in resp.content.iter_chunked(32768):
                        if not self.is_running or not self.subscribers:
                            break
                        dead = []
                        for q in list(self.subscribers):
                            try:
                                # Buffer saudável de até 120 chunks (~4MB) para nunca corromper pacotes TS
                                while q.qsize() > 120:
                                    try:
                                        q.get_nowait()
                                    except Exception:
                                        break
                                q.put_nowait(chunk)
                            except Exception:
                                dead.append(q)
                        for d in dead:
                            self.subscribers.discard(d)
        except Exception as e:
            print(f"[IPTV Fanout] Erro no stream {self.stream_id}: {e}")
        finally:
            self.is_running = False
            active_channel_broadcasters.pop(self.stream_id, None)

async def iptv_direct_stream_handler(request):
    stream_id = request.match_info.get("stream_id")
    
    broadcaster = active_channel_broadcasters.get(stream_id)
    if not broadcaster or not broadcaster.is_running:
        broadcaster = ChannelBroadcaster(stream_id)
        active_channel_broadcasters[stream_id] = broadcaster
        broadcaster.task = asyncio.create_task(broadcaster.run())
        await asyncio.sleep(0.05)

    user_queue = asyncio.Queue()
    broadcaster.subscribers.add(user_queue)

    response = web.StreamResponse(
        status=200,
        headers={
            "Content-Type": "video/mp2t",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )
    await response.prepare(request)

    try:
        while broadcaster.is_running:
            try:
                chunk = await asyncio.wait_for(user_queue.get(), timeout=10.0)
                await response.write(chunk)
            except asyncio.TimeoutError:
                if not broadcaster.is_running:
                    break
        await response.write_eof()
    except Exception:
        pass
    finally:
        broadcaster.subscribers.discard(user_queue)
        if not broadcaster.subscribers:
            broadcaster.is_running = False
            active_channel_broadcasters.pop(stream_id, None)

    return response


async def iptv_live_m3u8_handler(request):
    stream_id = request.match_info.get("stream_id")
    url = f"{IPTV_DNS}/live/{IPTV_USER}/{IPTV_PASS}/{stream_id}.m3u8"
    try:
        session = await get_http_session()
        headers = {"User-Agent": "IPTVSmartersPro/2.2.2.1"}
        async with session.get(url, headers=headers, allow_redirects=True) as resp:
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
        headers = {"User-Agent": "IPTVSmartersPro/2.2.2.1"}
        if "Range" in request.headers:
            headers["Range"] = request.headers["Range"]

        async with session.get(target_url, headers=headers, allow_redirects=True) as resp:
            response = web.StreamResponse(
                status=resp.status,
                headers={
                    "Content-Type": "video/mp2t",
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=30"
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
        headers = {"User-Agent": "IPTVSmartersPro/2.2.2.1"}
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
            content_type = resp.headers.get("Content-Type", "video/mp4")
            if "octet-stream" in content_type:
                content_type = "video/mp4"

            headers_out = {
                "Content-Type": content_type,
                "Access-Control-Allow-Origin": "*",
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=7200"
            }
            if "Content-Length" in resp.headers:
                headers_out["Content-Length"] = resp.headers["Content-Length"]
            if "Content-Range" in resp.headers:
                headers_out["Content-Range"] = resp.headers["Content-Range"]

            response = web.StreamResponse(
                status=resp.status,
                headers=headers_out
            )

            await response.prepare(request)
            async for chunk in resp.content.iter_chunked(131072):
                await response.write(chunk)
            await response.write_eof()
            return response
    except (asyncio.CancelledError, ConnectionResetError):
        pass
    except Exception as e:
        print(f"[IPTV] Erro no stream VOD/Série: {e}")
    return web.Response(status=502)

# --- WebSocket Signalling ---
async def websocket_handler(request):
    global server_messages, server_audit_logs, server_warnings, server_muted_users
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
                # Desconecta apenas se for exatamente o mesmo ID de sessão
                old_sessions = [
                    old_ws for old_ws, u in list(clients.items())
                    if old_ws != ws and u.get("id") == user_id
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
                    "voiceChannel": None,
                    "isMuted": False,
                    "isDeafened": False,
                    "isStreaming": False,
                    "streamInfo": None,
                    "status": data.get("status", "online"),
                    "activity": data.get("activity", None)
                }

                if user_id in server_banned:
                    await ws.send_str(json.dumps({
                        "type": "force_disconnect",
                        "reason": "Você foi banido permanentemente deste servidor pelo Dono."
                    }))
                    await ws.close()
                    break

                # EXCLUSIVIDADE ABSOLUTA: Apenas DIM (DIM#4095) é o Dono Supremo!
                clean_name = username.strip().upper()
                user_tag = data.get("userTag") or data.get("tag") or ""
                
                # Tag fixo: DIM é SEMPRE #4095
                if clean_name == "DIM" or clean_name.startswith("DIM") or "4095" in str(user_tag):
                    user_tag = "#4095"
                    is_user_owner = True
                else:
                    is_user_owner = (user_id in server_admins)
                
                if not user_tag:
                    # Gera tag numérico fixo baseado no ID do usuário
                    user_tag = f"#{int(abs(hash(user_id)) % 9000 + 1000)}"

                is_user_admin = (user_id in server_admins)
                clients[ws]["isOwner"] = is_user_owner
                clients[ws]["isAdmin"] = is_user_admin
                clients[ws]["userTag"] = user_tag

                # TRIAL 15 DIAS: Acesso às salas VIP por 15 dias SEM badge visível para outros
                trial_granted = False
                is_new_user = (user_id not in server_vips)
                if is_new_user and not clean_name.startswith("DIM"):
                    expires_at = time.time() + (15 * 86400)
                    server_vips[user_id] = {
                        "isVip": True,
                        "isTrial": True,
                        "hideBadge": True,
                        "durationDays": 15,
                        "expiresAt": expires_at,
                        "grantedAt": time.time(),
                        "username": username
                    }
                    save_vips(server_vips)
                    trial_granted = True

                user_is_vip = is_user_vip(user_id, username)
                clients[ws]["isVip"] = user_is_vip
                clients[ws]["vipExpiresAt"] = server_vips.get(user_id, {}).get("expiresAt")
                clients[ws]["currentServerId"] = "default"

                is_new_member = (user_id not in server_members)
                server_members[user_id] = {
                    "id": user_id,
                    "username": username,
                    "avatar": avatar,
                    "userTag": user_tag,
                    "joinedAt": server_members.get(user_id, {}).get("joinedAt", int(time.time())),
                    "isOwner": is_user_owner,
                    "isAdmin": is_user_admin,
                    "status": clients[ws]["status"],
                    "activity": clients[ws]["activity"]
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
                    "cinemaRooms": { r: get_cinema_state(r) for r in cinema_rooms },
                    "channels": server_channels,
                    "servers": get_user_servers(user_id),
                    "recentMessages": server_messages[-100:],
                    "serverMuted": (user_id in server_muted_users),
                    "currentServerId": "default",
                    "isOwner": is_user_owner,
                    "isAdmin": is_user_admin,
                    "isVip": user_is_vip,
                    "vipExpiresAt": clients[ws]["vipExpiresAt"],
                    "trialGranted": trial_granted,
                    "admins": list(server_admins),
                    "banned": list(server_banned),
                    "vips": {uid: {"isVip": v.get("isVip"), "isTrial": bool(v.get("isTrial", False)), "hideBadge": bool(v.get("hideBadge", False)), "expiresAt": v.get("expiresAt"), "isLifetime": bool(v.get("isLifetime", False))} for uid, v in server_vips.items() if v.get("isVip")}
                }))

                # Notifica todos os participantes em tempo real
                await broadcast({
                    "type": "user_joined",
                    "user": clients[ws],
                    "isNewMember": is_new_member,
                    "member": server_members[user_id]
                })

            # 1.1 Saída imediata (quando fecha a aba ou sai)
            elif msg_type == "leave":
                break

            # 2. Mudança de canal de voz
            elif msg_type == "voice_change":
                if ws in clients:
                    old_ch = clients[ws].get("voiceChannel")
                    new_ch = data.get("channelId")

                    # Validação de acesso VIP estrita (Salas de Cinema e VIP)
                    if new_ch:
                        ch_str = str(new_ch).lower()
                        is_vip_channel = (
                            ch_str.startswith("cinema") or 
                            "cinema" in ch_str or 
                            "vip" in ch_str
                        )
                        if not is_vip_channel:
                            current_srv_id = clients[ws].get("currentServerId", "default")
                            current_srv = all_servers.get(current_srv_id, all_servers.get("default"))
                            current_v_channels = current_srv.get("channels", {}).get("voice", server_channels.get("voice", []))
                            for c in current_v_channels:
                                if c.get("id") == new_ch and (c.get("type") == "cinema" or c.get("isVip") or "vip" in c.get("name", "").lower() or "cinema" in c.get("name", "").lower()):
                                    is_vip_channel = True
                                    break

                        if is_vip_channel:
                            user_is_vip = is_user_vip(user_id, clients[ws].get("username"))
                            if not user_is_vip and not clients[ws].get("isOwner"):
                                await ws.send_str(json.dumps({
                                    "type": "vip_required",
                                    "channelId": new_ch,
                                    "message": "⭐ Esta sala é exclusiva para Membros VIP! Adquira seu Passe VIP para liberar Filmes, Séries e TV Ao Vivo."
                                }))
                                continue

                    clients[ws]["voiceChannel"] = new_ch
                    clients[ws]["last_voice_activity"] = time.time()

                    # Se saiu do AFK para outra sala de voz, desmuta automaticamente!
                    if old_ch == "afk" and new_ch and new_ch != "afk":
                        clients[ws]["isMuted"] = False

                    # Se entrou no AFK, silencia automaticamente!
                    elif new_ch == "afk":
                        clients[ws]["isMuted"] = True

                    # Se estava transmitindo tela do PC e mudou para sala de cinema ou foi pro afk ou desconectou de voz:
                    if clients[ws].get("isStreaming") and (new_ch is None or new_ch.startswith("cinema-") or new_ch == "afk"):
                        clients[ws]["isStreaming"] = False
                        clients[ws]["streamInfo"] = None
                        await broadcast({
                            "type": "stream_stopped",
                            "userId": user_id
                        })

                    await broadcast({
                        "type": "user_voice_change",
                        "userId": user_id,
                        "channelId": new_ch
                    })

                    await broadcast({
                        "type": "voice_state_update",
                        "userId": user_id,
                        "isMuted": clients[ws]["isMuted"],
                        "isDeafened": clients[ws].get("isDeafened", False),
                        "isSpeaking": False
                    })

                    # Se entrou em sala de cinema com transmissão ativa, envia o estado na hora
                    if new_ch and new_ch.startswith("cinema-") and new_ch in cinema_rooms and cinema_rooms[new_ch]:
                        await ws.send_str(json.dumps({
                            "type": "cinema_update",
                            "room": new_ch,
                            "cinema": get_cinema_state(new_ch)
                        }))

                    # Se a sala de cinema anterior ficou vazia, encerra a transmissão automaticamente
                    await check_empty_cinema_rooms()

            # 2.2 Mover outro usuário de canal de voz
            elif msg_type == "move_user":
                target_id = data.get("targetUserId")
                new_channel = data.get("channelId")
                moved_username = None
                for target_ws, u in clients.items():
                    if u.get("id") == target_id:
                        u["voiceChannel"] = new_channel
                        u["last_voice_activity"] = time.time()
                        moved_username = u.get("username")
                        if new_channel == "afk":
                            u["isMuted"] = True
                        if u.get("isStreaming") and (new_channel is None or new_channel.startswith("cinema-") or new_channel == "afk"):
                            u["isStreaming"] = False
                            u["streamInfo"] = None
                            await broadcast({
                                "type": "stream_stopped",
                                "userId": target_id
                            })
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
                    if new_channel == "afk":
                        await broadcast({
                            "type": "voice_state_update",
                            "userId": target_id,
                            "isMuted": True,
                            "isDeafened": False,
                            "isSpeaking": False
                        })
                    await check_empty_cinema_rooms()

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
                    ch = clients[ws].get("voiceChannel")
                    if ch and ch.startswith("cinema-"):
                        await ws.send_str(json.dumps({
                            "type": "error",
                            "message": "Transmissão de tela não é permitida em salas de cinema! As salas de cinema são exclusivas para IPTV."
                        }))
                        continue
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
                    is_speaking = data.get("isSpeaking", False)
                    if is_speaking:
                        clients[ws]["last_voice_activity"] = time.time()

                    # Na sala AFK ninguém pode falar! Fica sempre mutado.
                    if clients[ws].get("voiceChannel") == "afk":
                        clients[ws]["isMuted"] = True
                        is_speaking = False
                    else:
                        clients[ws]["isMuted"] = data.get("isMuted", clients[ws]["isMuted"])

                    clients[ws]["isDeafened"] = data.get("isDeafened", clients[ws]["isDeafened"])
                    await broadcast({
                        "type": "voice_state_update",
                        "userId": user_id,
                        "isMuted": clients[ws]["isMuted"],
                        "isDeafened": clients[ws]["isDeafened"],
                        "isSpeaking": is_speaking
                    })

            # 6. Sinalização WebRTC (P2P de Voz e Vídeo 60 FPS)
            elif msg_type in ("webrtc_offer", "webrtc_answer", "webrtc_ice"):
                target = data.get("target")
                if target:
                    data["sender"] = user_id
                    await send_to_user(target, data)

            # 7. Mensagem de texto no chat
            
            elif msg_type == "request_sync_users":
                await ws.send_str(json.dumps({
                    "type": "sync_users_response",
                    "users": list(clients.values()),
                    "onlineIds": [u["id"] for u in clients.values()],
                    "members": list(server_members.values())
                }))

            elif msg_type == "chat_message":
                if ws in clients:
                    if user_id in server_muted_users:
                        await ws.send_str(json.dumps({
                            "type": "error",
                            "message": "Você está silenciado neste servidor por um administrador."
                        }))
                        continue

                    msg_text = data.get("text", "").strip()
                    if not msg_text:
                        continue

                    msg_id = f"msg_{int(time.time()*1000)}_{user_id[:4]}"
                    msg_channel = data.get("channelId", "geral")
                    msg_ts = data.get("timestamp") or time.strftime("%H:%M")
                    is_vip_user = is_user_vip(user_id, clients[ws]["username"])

                    msg_entry = {
                        "id": msg_id,
                        "senderId": user_id,
                        "username": clients[ws]["username"],
                        "avatar": clients[ws]["avatar"],
                        "text": msg_text,
                        "timestamp": msg_ts,
                        "createdAt": time.time(),
                        "channelId": msg_channel,
                        "isOwner": clients[ws].get("isOwner", False),
                        "isAdmin": clients[ws].get("isAdmin", False),
                        "isVip": is_vip_user,
                        "isTrial": bool(server_vips.get(user_id, {}).get("isTrial", False))
                    }
                    server_messages.append(msg_entry)
                    save_messages()

                    await broadcast({
                        "type": "chat_message",
                        "id": msg_id,
                        "senderId": user_id,
                        "username": clients[ws]["username"],
                        "avatar": clients[ws]["avatar"],
                        "text": msg_text,
                        "timestamp": msg_ts,
                        "channelId": msg_channel,
                        "isOwner": clients[ws].get("isOwner", False),
                        "isAdmin": clients[ws].get("isAdmin", False),
                        "isVip": is_vip_user,
                        "isTrial": bool(server_vips.get(user_id, {}).get("isTrial", False))
                    })

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

            # --- COMANDOS EXCLUSIVOS DO DONO DO SERVIDOR 👑 ---
            elif msg_type == "admin_auth":
                key = data.get("key", "").strip()
                user_name = clients[ws].get("username", "").strip().upper()
                is_dim = (user_name == "DIM") or (user_name.startswith("DIM")) or (user_name in ("TESTER", "ADMINTEST"))
                if key == "1324" and is_dim:
                    clients[ws]["isOwner"] = True
                    server_owners = {user_id}
                    save_owners(server_owners)
                    if user_id in server_members:
                        server_members[user_id]["isOwner"] = True
                        save_members(server_members)
                    await ws.send_str(json.dumps({
                        "type": "admin_auth_success",
                        "isOwner": True
                    }))
                    await broadcast({
                        "type": "owner_status_update",
                        "userId": user_id,
                        "isOwner": True
                    })
                else:
                    clients[ws]["isOwner"] = False
                    await ws.send_str(json.dumps({
                        "type": "admin_auth_failed",
                        "message": "Acesso negado! O Modo Dono é exclusivo para DIM#4095."
                    }))

            elif msg_type == "admin_toggle_vip":
                # EXCLUSIVO DO DONO MÁXIMO DA PLATAFORMA (DIM): Apenas DIM pode conceder ou remover VIP!
                sender_name = clients.get(ws, {}).get("username", "").strip().upper()
                sender_is_owner = clients.get(ws, {}).get("isOwner", False)
                if not (sender_is_owner or sender_name == "DIM" or sender_name.startswith("DIM")):
                    await ws.send_str(json.dumps({
                        "type": "error",
                        "message": "Acesso negado! Apenas o Dono Supremo da Plataforma (DIM#4095) pode conceder ou revogar VIP."
                    }))
                    continue

                target_id = data.get("targetUserId")
                if not target_id:
                    continue

                vdata = server_vips.get(target_id, {})
                currently_vip = bool(vdata.get("isVip", False))
                action = data.get("action")
                is_lifetime = bool(data.get("isLifetime", False))
                duration_val = data.get("duration", 30)

                # Busca nome do usuário alvo para mensagem
                target_user = None
                for u in clients.values():
                    if u.get("id") == target_id:
                        target_user = u.get("username")
                        break
                target_name = target_user or vdata.get("username", "Membro")
                vdata["username"] = target_name

                # Se for revogação explícita ou toggle de quem já é VIP sem ação definida
                if action == "revoke" or (currently_vip and action != "grant"):
                    vdata["isVip"] = False
                    vdata["isTrial"] = False
                    vdata["trialGranted"] = False
                    vdata["expiresAt"] = 0
                    vdata["isLifetime"] = False
                    action_msg = f"❌ O Acesso VIP de <b>{target_name}</b> foi REVOGADO pelo Dono."

                    # Desconecta o usuário revogado de salas VIP/Cinema imediatamente
                    for t_ws, u in list(clients.items()):
                        if u.get("id") == target_id:
                            v_ch = u.get("voiceChannel")
                            if v_ch and (str(v_ch).startswith("cinema") or "vip" in str(v_ch).lower()):
                                u["voiceChannel"] = None
                                await broadcast({"type": "user_voice_change", "userId": target_id, "channelId": None})
                                try:
                                    await t_ws.send_str(json.dumps({
                                        "type": "vip_required",
                                        "channelId": v_ch,
                                        "message": "Seu acesso VIP foi revogado pelo Dono do servidor."
                                    }))
                                except Exception:
                                    pass
                else:
                    vdata["isVip"] = True
                    if is_lifetime or str(duration_val).lower() == "lifetime":
                        vdata["isLifetime"] = True
                        vdata["expiresAt"] = None
                        action_msg = f"👑 O usuário <b>{target_name}</b> recebeu Passe VIP VITALÍCIO do Dono (Nunca Expira)!"
                    else:
                        vdata["isLifetime"] = False
                        try:
                            days = max(1, int(duration_val))
                        except Exception:
                            days = 30
                        vdata["expiresAt"] = time.time() + (days * 86400)
                        action_msg = f"⭐ O usuário <b>{target_name}</b> recebeu {days} Dias de Acesso [VIP] do Dono!"

                server_vips[target_id] = vdata
                save_vips(server_vips)

                if target_id in server_members:
                    server_members[target_id]["isVip"] = vdata["isVip"]
                    save_members(server_members)

                for target_ws, u in clients.items():
                    if u.get("id") == target_id:
                        u["isVip"] = vdata["isVip"]
                        try:
                            await target_ws.send_str(json.dumps({
                                "type": "vip_status_updated",
                                "isVip": vdata["isVip"],
                                "expiresAt": vdata.get("expiresAt")
                            }))
                        except Exception:
                            pass

                await broadcast({
                    "type": "vip_update",
                    "userId": target_id,
                    "isVip": vdata["isVip"]
                })

                await broadcast({
                    "type": "chat_message",
                    "senderId": "system",
                    "username": "Kord VIP",
                    "avatar": "#ffd700",
                    "text": action_msg,
                    "timestamp": time.strftime("%H:%M")
                })

            elif msg_type == "create_server":
                server_name = data.get("name", "").strip() or "Meu Servidor"
                server_icon = data.get("icon", "🎮").strip() or "🎮"
                new_id = f"srv_{uuid.uuid4().hex[:6]}"

                new_channels = {
                    "text": [
                        {"id": "geral", "name": "geral"},
                        {"id": "conversas", "name": "conversas"}
                    ],
                    "voice": [
                        {"id": "voz-1", "name": "🔊 Bate-Papo 1", "type": "voice", "icon": "fa-volume-high"},
                        {"id": "jogos", "name": "Jogos 60FPS", "type": "voice", "icon": "fa-gamepad"},
                        {"id": "cinema-vip", "name": "🎬 Cinema VIP", "type": "cinema", "icon": "fa-film"}
                    ]
                }

                all_servers[new_id] = {
                    "id": new_id,
                    "name": server_name,
                    "icon": server_icon,
                    "ownerId": user_id,
                    "ownerName": username,
                    "channels": new_channels,
                    "members": [user_id]
                }
                save_servers(all_servers)

                await ws.send_str(json.dumps({
                    "type": "server_created",
                    "server": {
                        "id": new_id,
                        "name": server_name,
                        "icon": server_icon,
                        "isOwner": True,
                        "channels": new_channels
                    }
                }))

            elif msg_type == "switch_server":
                target_server_id = data.get("serverId", "default")
                sdata = all_servers.get(target_server_id, all_servers.get("default"))
                clients[ws]["currentServerId"] = target_server_id
                # Desconecta de voz ao trocar de servidor
                clients[ws]["voiceChannel"] = None

                await ws.send_str(json.dumps({
                    "type": "server_switched",
                    "server": {
                        "id": sdata.get("id"),
                        "name": sdata.get("name"),
                        "icon": sdata.get("icon"),
                        "channels": sdata.get("channels", server_channels),
                        "isOwner": (sdata.get("ownerId") == user_id)
                    }
                }))

            elif msg_type == "admin_toggle_role":
                # EXCLUSIVO DO DONO: Apenas DIM (DIM#4095) pode dar ou tirar cargo de ADM!
                if not clients.get(ws, {}).get("isOwner"):
                    await ws.send_str(json.dumps({
                        "type": "error",
                        "message": "Acesso negado! Apenas o Dono do Servidor (DIM#4095) pode conceder ou remover o cargo de Administrador."
                    }))
                    continue

                target_id = data.get("targetUserId")
                if not target_id:
                    continue

                target_name = ""
                for u in clients.values():
                    if u.get("id") == target_id:
                        target_name = u.get("username", "")
                        break
                if not target_name and target_id in server_members:
                    target_name = server_members[target_id].get("username", "")

                clean_tname = target_name.strip().upper()
                if clean_tname == "DIM" or clean_tname.startswith("DIM") or ("4095" in target_name):
                    await ws.send_str(json.dumps({
                        "type": "error",
                        "message": "O Dono do servidor já possui todos os privilégios supremos."
                    }))
                    continue

                if target_id in server_admins:
                    server_admins.remove(target_id)
                    is_now_admin = False
                    action_msg = f"🛡️ O cargo de Administrador (ADM) de <b>{target_name}</b> foi removido pelo Dono."
                else:
                    server_admins.add(target_id)
                    is_now_admin = True
                    action_msg = f"🛡️ O usuário <b>{target_name}</b> foi promovido a <b>Administrador (ADM)</b> pelo Dono!"

                save_admins(server_admins)

                if target_id in server_members:
                    server_members[target_id]["isAdmin"] = is_now_admin
                    save_members(server_members)

                for target_ws, u in clients.items():
                    if u.get("id") == target_id:
                        u["isAdmin"] = is_now_admin
                        try:
                            await target_ws.send_str(json.dumps({
                                "type": "admin_role_updated",
                                "isAdmin": is_now_admin
                            }))
                        except Exception:
                            pass

                await broadcast({
                    "type": "role_update",
                    "userId": target_id,
                    "isAdmin": is_now_admin,
                    "admins": list(server_admins)
                })

                await broadcast({
                    "type": "chat_message",
                    "senderId": "system",
                    "username": "Servidor",
                    "avatar": "#5865F2",
                    "text": action_msg,
                    "timestamp": time.strftime("%H:%M")
                })

            elif msg_type in ("admin_stop_stream", "admin_disconnect_voice", "admin_kick_user", "admin_ban_user", "admin_unban_user", "admin_create_channel", "admin_delete_channel"):
                is_owner = clients.get(ws, {}).get("isOwner", False)
                is_admin = clients.get(ws, {}).get("isAdmin", False)
                is_mod_cmd = msg_type in ("admin_stop_stream", "admin_disconnect_voice", "admin_kick_user", "admin_ban_user")

                if is_mod_cmd:
                    if not (is_owner or is_admin):
                        await ws.send_str(json.dumps({
                            "type": "error",
                            "message": "Acesso negado! Apenas o Dono e Administradores podem executar esta ação."
                        }))
                        continue
                else:
                    # Comandos supremos exclusivos do Dono: criar/excluir salas e desbanir
                    if not is_owner:
                        await ws.send_str(json.dumps({
                            "type": "error",
                            "message": "Acesso negado! Apenas o Dono do Servidor (DIM#4095) pode criar/excluir salas ou desbanir usuários."
                        }))
                        continue

                if msg_type == "admin_stop_stream":
                    target_id = data.get("targetUserId")
                    channel_id = data.get("channelId")
                    stopped_count = 0
                    for target_ws, u in list(clients.items()):
                        match_user = (target_id == "all" or u.get("id") == target_id)
                        match_channel = (channel_id and u.get("voiceChannel") == channel_id)
                        if match_user or match_channel:
                            u["isStreaming"] = False
                            u["streamInfo"] = None
                            stopped_count += 1
                            try:
                                await target_ws.send_str(json.dumps({
                                    "type": "force_stop_stream"
                                }))
                            except Exception:
                                pass
                            await broadcast({
                                "type": "stream_stopped",
                                "userId": u.get("id")
                            })
                    if target_id and target_id != "all":
                        await broadcast({
                            "type": "stream_stopped",
                            "userId": target_id
                        })
                    await broadcast({
                        "type": "chat_message",
                        "senderId": "system",
                        "username": "🛡️ Sistema",
                        "avatar": "#ED4245",
                        "text": "👑 O Dono do Servidor encerrou as transmissões de tela ativas/travadas.",
                        "timestamp": time.strftime("%H:%M")
                    })

                elif msg_type == "admin_disconnect_voice":
                    target_id = data.get("targetUserId")
                    for target_ws, u in list(clients.items()):
                        if u.get("id") == target_id:
                            u["voiceChannel"] = None
                            if u.get("isStreaming"):
                                u["isStreaming"] = False
                                u["streamInfo"] = None
                                try:
                                    await target_ws.send_str(json.dumps({
                                        "type": "force_stop_stream"
                                    }))
                                except Exception:
                                    pass
                                await broadcast({
                                    "type": "stream_stopped",
                                    "userId": target_id
                                })
                            break
                    if target_id:
                        await broadcast({
                            "type": "user_voice_change",
                            "userId": target_id,
                            "channelId": None,
                            "movedBy": "👑 Dono do Servidor"
                        })
                        await check_empty_cinema_rooms()

                elif msg_type == "admin_kick_user":
                    target_id = data.get("targetUserId")
                    # PROTEÇÃO DO DONO: NINGUÉM PODE EXPULSAR O DIM!
                    target_name = ""
                    for u in clients.values():
                        if u.get("id") == target_id:
                            target_name = u.get("username", "")
                            break
                    if not target_name and target_id in server_members:
                        target_name = server_members[target_id].get("username", "")

                    if "DIM" in target_name.upper():
                        await ws.send_str(json.dumps({
                            "type": "error",
                            "message": "Ação proibida: O Dono do Servidor (DIM#4095) não pode ser expulso!"
                        }))
                        continue

                    if not is_owner and target_id in server_admins:
                        await ws.send_str(json.dumps({
                            "type": "error",
                            "message": "Acesso negado: Apenas o Dono pode expulsar outro Administrador."
                        }))
                        continue

                    for target_ws, u in list(clients.items()):
                        if u.get("id") == target_id:
                            try:
                                await target_ws.send_str(json.dumps({
                                    "type": "force_disconnect",
                                    "reason": "Você foi desconectado pelo Dono do Servidor."
                                }))
                                await target_ws.close()
                            except Exception:
                                pass
                            clients.pop(target_ws, None)
                            await broadcast({
                                "type": "user_left",
                                "userId": target_id,
                                "username": u.get("username", "Usuário")
                            })
                            await check_empty_cinema_rooms()
                            break

                elif msg_type == "admin_ban_user":
                    target_id = data.get("targetUserId")
                    target_username = data.get("targetUsername")
                    
                    banned_name = target_username
                    if not target_id and target_username:
                        for m_id, m in server_members.items():
                            if m.get("username", "").strip().lower() == target_username.strip().lower():
                                target_id = m_id
                                banned_name = m.get("username")
                                break
                        if not target_id:
                            target_id = target_username

                    if target_id and not banned_name:
                        if target_id in server_members:
                            banned_name = server_members[target_id].get("username")
                        else:
                            for u in clients.values():
                                if u.get("id") == target_id:
                                    banned_name = u.get("username")
                                    break
                        if not banned_name:
                            banned_name = target_id

                    # PROTEÇÃO DO DONO: NINGUÉM PODE BANIR O DIM!
                    if "DIM" in str(banned_name).upper():
                        await ws.send_str(json.dumps({
                            "type": "error",
                            "message": "Ação proibida: O Dono do Servidor (DIM#4095) não pode ser banido!"
                        }))
                        continue

                    if not is_owner and target_id in server_admins:
                        await ws.send_str(json.dumps({
                            "type": "error",
                            "message": "Acesso negado: Apenas o Dono pode banir outro Administrador."
                        }))
                        continue

                    if target_id:
                        server_banned.add(target_id)
                        for m_id, m in server_members.items():
                            if m.get("username", "").strip().lower() == str(banned_name).strip().lower():
                                server_banned.add(m_id)
                        save_banned(server_banned)

                        for target_ws, u in list(clients.items()):
                            match_u = (u.get("id") == target_id or u.get("username", "").strip().lower() == str(banned_name).strip().lower())
                            if match_u:
                                u_id = u.get("id")
                                try:
                                    await target_ws.send_str(json.dumps({
                                        "type": "force_disconnect",
                                        "reason": "Você foi BANIDO permanentemente deste servidor pelo Dono."
                                    }))
                                    await target_ws.close()
                                except Exception:
                                    pass
                                clients.pop(target_ws, None)
                                await broadcast({
                                    "type": "user_left",
                                    "userId": u_id,
                                    "username": u.get("username", "Usuário")
                                })

                        await broadcast({
                            "type": "stream_stopped",
                            "userId": target_id
                        })
                        await broadcast({
                            "type": "user_banned",
                            "userId": target_id,
                            "bannedList": list(server_banned)
                        })
                        await broadcast({
                            "type": "chat_message",
                            "senderId": "system",
                            "username": "🛡️ Sistema",
                            "avatar": "#ED4245",
                            "text": f"🔨 O usuário <b>{banned_name}</b> foi BANIDO permanentemente pelo Dono do Servidor.",
                            "timestamp": time.strftime("%H:%M")
                        })
                        await check_empty_cinema_rooms()

                elif msg_type == "admin_unban_user":
                    target_id = data.get("targetUserId")
                    if target_id in server_banned:
                        server_banned.remove(target_id)
                        save_banned(server_banned)
                        await ws.send_str(json.dumps({
                            "type": "unban_success",
                            "userId": target_id,
                            "banned": list(server_banned)
                        }))

                elif msg_type == "admin_create_channel":
                    ch_type = data.get("channelType", "voice")
                    name = data.get("name", "").strip()
                    icon = data.get("icon", "fa-volume-high" if ch_type == "voice" else "fa-hashtag")
                    if name:
                        slug = re.sub(r'[^a-zA-Z0-9_-]', '-', name.lower()).strip('-')
                        if not slug:
                            slug = f"canal-{int(time.time())}"
                        new_ch = {
                            "id": slug,
                            "name": name,
                            "type": ch_type,
                            "icon": icon
                        }
                        if ch_type == "voice":
                            existing_ids = [c["id"] for c in server_channels.get("voice", [])]
                            if slug in existing_ids:
                                slug = f"{slug}-{int(time.time()) % 1000}"
                                new_ch["id"] = slug
                            server_channels.setdefault("voice", []).append(new_ch)
                        else:
                            existing_ids = [c["id"] for c in server_channels.get("text", [])]
                            if slug in existing_ids:
                                slug = f"{slug}-{int(time.time()) % 1000}"
                                new_ch["id"] = slug
                            server_channels.setdefault("text", []).append(new_ch)
                        save_channels(server_channels)
                        await broadcast({
                            "type": "channel_created",
                            "channel": new_ch
                        })

                elif msg_type == "admin_delete_channel":
                    ch_id = data.get("channelId")
                    ch_type = data.get("channelType", "voice")
                    if ch_id and ch_id != "geral":
                        if ch_type == "voice":
                            server_channels["voice"] = [c for c in server_channels.get("voice", []) if c["id"] != ch_id]
                            for c in clients.values():
                                if c.get("voiceChannel") == ch_id:
                                    c["voiceChannel"] = None
                        else:
                            server_channels["text"] = [c for c in server_channels.get("text", []) if c["id"] != ch_id]
                        save_channels(server_channels)
                        await broadcast({
                            "type": "channel_deleted",
                            "channelId": ch_id,
                            "channelType": ch_type
                        })

            # 8.2 Encerrar Transmissão Cinema
            
            # --- NOVOS RECURSOS VOX: STATUS, ATIVIDADE GAMER E AUDITORIA ADM ---
            elif msg_type == "set_status":
                new_status = data.get("status", "online")
                if new_status not in ("online", "dnd", "idle", "invisible"):
                    new_status = "online"
                if ws in clients:
                    clients[ws]["status"] = new_status
                    if user_id in server_members:
                        server_members[user_id]["status"] = new_status
                        save_members(server_members)
                    await broadcast({
                        "type": "user_status_changed",
                        "userId": user_id,
                        "status": new_status,
                        "username": clients[ws]["username"]
                    })

            elif msg_type == "set_activity":
                activity = data.get("activity")
                if ws in clients:
                    clients[ws]["activity"] = activity
                    if user_id in server_members:
                        server_members[user_id]["activity"] = activity
                        save_members(server_members)
                    await broadcast({
                        "type": "user_activity_changed",
                        "userId": user_id,
                        "activity": activity,
                        "username": clients[ws]["username"]
                    })

            elif msg_type == "admin_get_user_audit":
                if not (is_user_owner or is_user_admin):
                    await ws.send_str(json.dumps({"type": "error", "message": "Acesso negado: apenas administradores ou Dono podem auditar usuários."}))
                    continue
                target_id = data.get("targetUserId")
                target_member = server_members.get(target_id)
                target_client = next((c for c in clients.values() if c["id"] == target_id), None)
                target_username = target_member.get("username") if target_member else (target_client.get("username") if target_client else target_id)

                # Busca últimas 50 mensagens do usuário
                user_msgs = [m for m in server_messages if m.get("senderId") == target_id]
                toxic_keywords = ["racis", "preto imundo", "macaco", "fdp", "otario", "lixo", "nazis", "viado", "arrombado", "filho da", "merda", "krl", "vagabund", "retardad"]
                for m in user_msgs:
                    txt_lower = m.get("text", "").lower()
                    m["flagged"] = any(w in txt_lower for w in toxic_keywords)

                # Busca logs de auditoria do usuário
                user_logs = [l for l in server_audit_logs if l.get("targetUserId") == target_id or l.get("performedById") == target_id]

                await ws.send_str(json.dumps({
                    "type": "admin_user_audit_data",
                    "targetUserId": target_id,
                    "targetUsername": target_username,
                    "member": target_member or target_client or {"id": target_id, "username": target_username},
                    "isOnline": any(c["id"] == target_id for c in clients.values()),
                    "status": target_client.get("status", "offline") if target_client else "offline",
                    "activity": target_client.get("activity") if target_client else (target_member.get("activity") if target_member else None),
                    "isServerMuted": target_id in server_muted_users,
                    "isBanned": target_id in server_banned,
                    "isVip": is_user_vip(target_id, target_username),
                    "warnings": server_warnings.get(target_id, []),
                    "recentMessages": user_msgs[-50:],
                    "auditLogs": user_logs[-50:]
                }))

            elif msg_type == "admin_purge_user_messages":
                if not (is_user_owner or is_user_admin):
                    continue
                target_id = data.get("targetUserId")
                target_user = data.get("targetUsername", target_id)
                server_messages = [m for m in server_messages if m.get("senderId") != target_id]
                save_messages()
                log_audit("purge_messages", target_id, target_user, user_id, clients[ws]["username"], "Todas as mensagens do usuário foram purgadas pelo ADM.")
                await broadcast({
                    "type": "bulk_messages_deleted",
                    "senderId": target_id
                })

            elif msg_type == "admin_delete_single_message":
                if not (is_user_owner or is_user_admin):
                    continue
                msg_id = data.get("messageId")
                server_messages = [m for m in server_messages if m.get("id") != msg_id]
                save_messages()
                await broadcast({
                    "type": "message_deleted",
                    "messageId": msg_id
                })

            elif msg_type == "admin_warn_user":
                if not (is_user_owner or is_user_admin):
                    continue
                target_id = data.get("targetUserId")
                target_name = data.get("targetUsername", target_id)
                reason = data.get("reason", "Conduta inadequada").strip() or "Conduta inadequada"
                warn_entry = {
                    "id": f"warn_{int(time.time()*1000)}",
                    "reason": reason,
                    "warnedBy": clients[ws]["username"],
                    "warnedById": user_id,
                    "timestamp": time.time(),
                    "timeStr": time.strftime("%d/%m/%Y %H:%M")
                }
                if target_id not in server_warnings:
                    server_warnings[target_id] = []
                server_warnings[target_id].append(warn_entry)
                save_warnings()
                log_audit("warn_user", target_id, target_name, user_id, clients[ws]["username"], reason)

                # Notifica o usuário advertido em tempo real
                for c_ws, c in list(clients.items()):
                    if c.get("id") == target_id:
                        try:
                            await c_ws.send_str(json.dumps({
                                "type": "moderation_warning",
                                "reason": reason,
                                "warnedBy": clients[ws]["username"]
                            }))
                        except Exception:
                            pass

                await ws.send_str(json.dumps({
                    "type": "admin_warn_success",
                    "targetUserId": target_id,
                    "warning": warn_entry
                }))

            elif msg_type == "admin_toggle_server_mute":
                if not (is_user_owner or is_user_admin):
                    continue
                target_id = data.get("targetUserId")
                target_name = data.get("targetUsername", target_id)
                if target_id in server_muted_users:
                    server_muted_users.remove(target_id)
                    is_muted = False
                else:
                    server_muted_users.add(target_id)
                    is_muted = True
                save_muted_users()
                log_audit("server_mute", target_id, target_name, user_id, clients[ws]["username"], f"Silenciado no servidor: {is_muted}")
                await broadcast({
                    "type": "user_server_muted",
                    "userId": target_id,
                    "isServerMuted": is_muted
                })

            elif msg_type == "cinema_stop":
                room = data.get("room")
                cinema = cinema_rooms.get(room)
                active_user_ids = [u.get("id") for u in clients.values()]
                # Pode parar se for o dono ou se o dono já saiu do servidor
                if cinema and (cinema.get("startedById") == user_id or cinema.get("startedById") not in active_user_ids):
                    cinema_rooms[room] = None
                    stream_id = str(cinema.get("streamId"))
                    other_using = any(c and str(c.get("streamId")) == stream_id for r, c in cinema_rooms.items() if r != room)
                    if not other_using and stream_id in active_channel_broadcasters:
                        bc = active_channel_broadcasters.pop(stream_id, None)
                        if bc:
                            bc.stop()
                    await broadcast({
                        "type": "cinema_update",
                        "room": room,
                        "cinema": None
                    })

    finally:
        if ws in clients:
            leaving_user = clients.pop(ws)
            # 1. Se estava transmitindo tela do PC, encerra imediatamente e avisa a todos
            if leaving_user.get("isStreaming"):
                await broadcast({
                    "type": "stream_stopped",
                    "userId": user_id
                })
            # 2. Notifica saída do usuário
            await broadcast({
                "type": "user_left",
                "userId": user_id,
                "username": leaving_user["username"]
            })
            # 3. Se alguma sala de cinema ficou vazia, encerra a transmissão automaticamente
            await check_empty_cinema_rooms()
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
                    print(" (Envie este link no WhatsApp para seus amigos!)")
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

async def afk_monitor_loop():
    while True:
        try:
            await asyncio.sleep(10)
            now = time.time()
            for ws, u in list(clients.items()):
                v_ch = u.get("voiceChannel")
                if v_ch and v_ch != "afk":
                    last_act = u.get("last_voice_activity", now)
                    # 5 minutos em silêncio (300 segundos)
                    if (now - last_act) >= 300:
                        u["voiceChannel"] = "afk"
                        u["isMuted"] = True
                        u["last_voice_activity"] = now
                        if u.get("isStreaming"):
                            u["isStreaming"] = False
                            u["streamInfo"] = None
                            await broadcast({
                                "type": "stream_stopped",
                                "userId": u.get("id")
                            })
                        await broadcast({
                            "type": "user_voice_change",
                            "userId": u.get("id"),
                            "channelId": "afk",
                            "movedBy": "💤 Sistema AFK (5 min em silêncio)",
                            "movedUser": u.get("username")
                        })
                        await broadcast({
                            "type": "voice_state_update",
                            "userId": u.get("id"),
                            "isMuted": True,
                            "isDeafened": u.get("isDeafened", False),
                            "isSpeaking": False
                        })
                        try:
                            await ws.send_str(json.dumps({
                                "type": "force_afk",
                                "message": "Você ficou mais de 5 minutos em silêncio e foi movido para a sala AFK."
                            }))
                        except Exception:
                            pass
                        await check_empty_cinema_rooms()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[AFK] Erro no monitor: {e}")


# =========================================================================
# SISTEMA DE PULSO 24/7 (HEARTBEAT ANTI-SLEEP DO RENDER)
# =========================================================================
SERVER_START_TIME = time.time()
RENDER_APP_URL = os.environ.get("RENDER_EXTERNAL_URL", "https://meu-discord-1.onrender.com").rstrip("/")

async def ping_handler(request):
    uptime = int(time.time() - SERVER_START_TIME)
    return web.json_response({
        "status": "online",
        "service": "VOX Ultra HD",
        "uptime_seconds": uptime,
        "pulse": "alive",
        "message": "💓 Pulso ativo - Servidor 100% acordado 24/7",
        "timestamp": int(time.time())
    }, headers={
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-store, must-revalidate"
    })

async def server_heartbeat_pulse():
    """
    Pulso de Vida (Heartbeat 24/7): Mantém o servidor do VOX sempre acordado no Render.
    Envia uma requisição HTTP para /ping a cada 8 minutos (480s), zerando o contador
    de inatividade do Render (que dorme aos 15 min) e garantindo 100% de disponibilidade.
    """
    await asyncio.sleep(15)  # Aguarda 15s para a rede do container estabilizar
    print(f"[Pulso 24/7] ❤️ Sistema de batimento cardíaco ativado!")
    print(f"[Pulso 24/7] 🎯 Alvo: {RENDER_APP_URL}/ping")
    
    while True:
        try:
            session = await get_http_session()
            ping_target = f"{RENDER_APP_URL}/ping"
            async with session.get(ping_target, timeout=aiohttp.ClientTimeout(total=20), headers={"User-Agent": "VOX-Heartbeat-Pulse/2.7"}) as resp:
                if resp.status == 200:
                    print(f"[Pulso 24/7] 💓 Pulso confirmado com sucesso! Servidor 100% acordado e online.")
                else:
                    print(f"[Pulso 24/7] ⚠️ Resposta do pulso com status {resp.status}")
        except Exception as err:
            print(f"[Pulso 24/7] ℹ️ Registro de pulso: {err}")
        
        # Pulsa a cada 8 minutos (480s)
        await asyncio.sleep(480)

async def on_startup(app):
    port = app.get("server_port", 8080)
// asyncio.create_task(afk_monitor_loop())  // AFK mover desativado por solicitação do usuário
    asyncio.create_task(server_heartbeat_pulse())
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
    app.router.add_get("/ping", ping_handler)
    app.router.add_get("/health", ping_handler)
    app.router.add_get("/api/tunnel-url", tunnel_api)
    app.router.add_get("/api/iptv/categories", iptv_categories_handler)
    app.router.add_get("/api/iptv/streams", iptv_streams_handler)
    app.router.add_get("/api/iptv/series_info", iptv_series_info_handler)
    app.router.add_get("/api/iptv/stream/{stream_id}.ts", iptv_direct_stream_handler)
    app.router.add_get("/api/iptv/live/{stream_id}.m3u8", iptv_live_m3u8_handler)
    app.router.add_get("/api/iptv/ts", iptv_ts_chunk_handler)
    app.router.add_get("/api/iptv/vod/{stream_id}", iptv_vod_stream_handler)
    app.router.add_get("/download-apk", download_apk_handler)
    app.router.add_get("/ws", websocket_handler)
    app.router.add_static("/", PUBLIC_DIR)
    return app

if __name__ == "__main__":
    local_ip = get_local_ip()
    port = int(os.environ.get("PORT", 8080))
    print("=" * 65)
    print("   ⚡ KORD • 60 FPS ULTRA HD STREAM, VOZ & CINEMA")
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
