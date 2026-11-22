import os
import sys
import json
import asyncio
import re
import socket
import subprocess
from pathlib import Path
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
CLOUDFLARED_EXE = APP_DIR / "cloudflared.exe"

# Estado do Servidor
clients = {}  # ws -> { id, username, avatar, voiceChannel, isMuted, isDeafened, isStreaming, streamInfo }
public_tunnel_url = None
cloudflared_proc = None

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
    return web.FileResponse(PUBLIC_DIR / "index.html")

async def tunnel_api(request):
    return web.json_response({"publicUrl": public_tunnel_url})

# --- WebSocket Signalling ---
async def websocket_handler(request):
    ws = web.WebSocketResponse(heartbeat=25.0)
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
                clients[ws] = {
                    "id": user_id,
                    "username": data.get("username", f"Usuário_{user_id[:4]}"),
                    "avatar": data.get("avatar", "#5865F2"),
                    "voiceChannel": "geral",
                    "isMuted": False,
                    "isDeafened": False,
                    "isStreaming": False,
                    "streamInfo": None
                }

                # Responde ao usuário com estado inicial e link do túnel
                all_users = list(clients.values())
                await ws.send_str(json.dumps({
                    "type": "init_state",
                    "selfId": user_id,
                    "users": all_users,
                    "publicTunnelUrl": public_tunnel_url
                }))

                # Notifica todos os outros participantes
                await broadcast({
                    "type": "user_joined",
                    "user": clients[ws]
                }, exclude_ws=ws)

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
                    await broadcast({
                        "type": "user_updated",
                        "user": clients[ws]
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
