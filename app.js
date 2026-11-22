/* ==========================================================================
   DISCORD 60 FPS & 2K STREAM - CLIENT CONTROLLER COMPLETO
   ========================================================================== */

const savedUid = localStorage.getItem('dc_userid');
const currentUid = savedUid || ('user_' + Math.random().toString(36).substring(2, 9));
localStorage.setItem('dc_userid', currentUid);

const state = {
    userId: currentUid,
    username: localStorage.getItem('dc_username') || ('Jogador_' + Math.floor(1000 + Math.random() * 9000)),
    avatarColor: localStorage.getItem('dc_avatar') || '#5865F2',
    userTag: localStorage.getItem('dc_tag') || ('#' + Math.floor(1000 + Math.random() * 9000)),

    currentTextChannel: 'geral',
    currentVoiceChannel: null, // NÃO entra em nenhuma sala de voz automaticamente
    isMuted: false,
    isDeafened: false,
    isStreaming: false,

    streamConfig: {
        resolution: 1440, // 720, 1080, 1440 (2K)
        fps: 60,
        captureAudio: true,
        isolateVoice: true, // Não capturar áudio das salas de voz
        bitrate: 12000 // kbps
    },

    users: new Map(), // userId -> userData
    peerConnections: new Map(), // userId -> RTCPeerConnection
    remoteAudioElements: new Map(), // userId -> HTMLAudioElement
    activeStreams: new Map(), // userId -> { stream, username, info }
    currentlyWatchingUserId: null,

    // Controle individual de volume e mudo local para cada amigo
    userVolumes: new Map(), // userId -> volume (0 a 200)
    userMutedLocally: new Set(), // Set de userIds mutados apenas localmente
    activeContextUserId: null,

    localAudioStream: null,
    localScreenStream: null,
    publicTunnelUrl: null,

    fpsInterval: null,
    micTestStream: null,
    micTestAnalyser: null,
    micTestInterval: null,

    // Estado do IPTV e das 3 Salas de Cinema
    cinemaRooms: { 'cinema-1': null, 'cinema-2': null, 'cinema-3': null },
    hlsInstance: null,
    currentIptvType: 'live',
    currentIptvCategory: null,
    iptvCategories: []
};

// Carrega volumes salvos
try {
    const savedVols = JSON.parse(localStorage.getItem('dc_user_volumes') || '{}');
    Object.entries(savedVols).forEach(([id, vol]) => state.userVolumes.set(id, vol));
} catch (e) {}

// STUN Servers Ultrarrápidos
const rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ],
    iceCandidatePoolSize: 10
};

// Fila de ICE Candidates
const iceQueue = new Map();

function drainIceQueue(userId, pc) {
    if (iceQueue.has(userId)) {
        const queue = iceQueue.get(userId);
        iceQueue.delete(userId);
        queue.forEach(async candidate => {
            try { await pc.addIceCandidate(candidate); } catch (e) {}
        });
    }
}

// --- WebSocket de Sinalização ---
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws`;
let socket = null;

function sendWs(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

function initWebSocket() {
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        console.log('✅ WebSocket Conectado!');
        sendWs({
            type: 'join',
            id: state.userId,
            username: state.username,
            avatar: state.avatarColor
        });
    };

    socket.onmessage = async (event) => {
        try {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        } catch (e) {
            console.error('Erro no parser do socket:', e);
        }
    };

    socket.onclose = () => {
        console.warn('⚠️ Conexão perdida. Reconectando...');
        setTimeout(initWebSocket, 2000);
    };
}

// --- Handlers de Mensagens do Servidor ---
async function handleServerMessage(data) {
    switch (data.type) {
        case 'force_disconnect':
            if (socket) {
                socket.onclose = null;
                socket.close();
            }
            document.body.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#202225;color:#fff;font-family:sans-serif;text-align:center;padding:20px;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:48px;color:#f23f43;margin-bottom:16px;"></i>
                    <h2 style="color:#fff;margin-bottom:10px;font-size:22px;">Sessão Encerrada</h2>
                    <p style="color:#949ba4;margin-bottom:24px;max-width:400px;font-size:14px;line-height:1.5;">${escapeHtml(data.reason || 'Você abriu o Discord em outra aba ou dispositivo.')}</p>
                    <button onclick="location.reload()" style="background:#5865f2;color:#fff;border:none;padding:10px 24px;border-radius:4px;cursor:pointer;font-weight:600;font-size:14px;">Usar esta aba</button>
                </div>
            `;
            break;

        case 'init_state':
            state.users.clear();
            data.users.forEach(u => state.users.set(u.id, u));
            if (data.publicTunnelUrl) {
                state.publicTunnelUrl = data.publicTunnelUrl;
            }
            if (data.cinemaRooms) {
                state.cinemaRooms = data.cinemaRooms;
            }
            renderVoiceUsers();
            break;

        case 'cinema_update':
            if (state.cinemaRooms) {
                state.cinemaRooms[data.room] = data.cinema;
            }
            if (state.currentVoiceChannel === data.room) {
                checkRoomCinemaStream(data.room);
            }
            if (data.cinema) {
                showToast(`🎬 Transmissão iniciada em <b>${data.room}</b>: <b>${escapeHtml(data.cinema.streamName)}</b>`);
            }
            break;

        case 'tunnel_ready':
            state.publicTunnelUrl = data.publicTunnelUrl;
            showToast('🌐 Link público gerado! Clique em "Convidar Amigos".');
            break;

        case 'user_joined':
            state.users.set(data.user.id, data.user);
            renderVoiceUsers();
            addSystemChatMessage(`${data.user.username} entrou no servidor.`);
            if (state.currentVoiceChannel && data.user.voiceChannel === state.currentVoiceChannel) {
                initiatePeerConnection(data.user.id);
            }
            break;

        case 'user_updated':
            const existing = state.users.get(data.user.id);
            if (existing) {
                const oldName = existing.username;
                existing.username = data.user.username;
                existing.avatar = data.user.avatar;
                if (oldName !== data.user.username) {
                    addSystemChatMessage(`<b>${escapeHtml(oldName)}</b> agora se chama <b>${escapeHtml(data.user.username)}</b>.`);
                }
            } else {
                state.users.set(data.user.id, data.user);
            }
            renderVoiceUsers();
            renderStreamTabs();
            break;

        case 'user_left':
            state.users.delete(data.userId);
            removeStream(data.userId);
            closePeerConnection(data.userId);
            renderVoiceUsers();
            addSystemChatMessage(`${data.username} saiu.`);
            break;

        case 'user_voice_change':
            const voiceChannelNames = {
                'geral': '🔊 Geral',
                'jogos-60fps': '🎮 Jogos 60FPS',
                'cinema': '🎬 Cinema & Resenha',
                'competitivo': '🏆 Competitivo / Ranked',
                'bate-papo': '☕ Bate-papo & Chill',
                'afk': '💤 AFK / Ausente'
            };
            const targetChannelName = voiceChannelNames[data.channelId] || data.channelId;

            // Se quem foi movido fui eu mesmo
            if (data.userId === state.userId) {
                if (data.channelId !== state.currentVoiceChannel) {
                    switchVoiceChannel(data.channelId, false);
                    if (data.movedBy) {
                        showToast(`🔊 <b>Você foi movido para a sala ${targetChannelName} por ${escapeHtml(data.movedBy)}!</b>`, 5000);
                    }
                }
            } else {
                const u = state.users.get(data.userId);
                if (u) {
                    u.voiceChannel = data.channelId;
                }
                renderVoiceUsers();
                if (data.channelId === state.currentVoiceChannel) {
                    initiatePeerConnection(data.userId);
                } else {
                    closePeerConnection(data.userId);
                }
                if (data.movedBy && data.movedUser) {
                    showToast(`✈️ <b>${escapeHtml(data.movedUser)}</b> foi movido para <b>${targetChannelName}</b> por <b>${escapeHtml(data.movedBy)}</b>.`, 4000);
                }
            }
            break;

        case 'stream_started':
            const streamer = state.users.get(data.userId);
            if (streamer) {
                streamer.isStreaming = true;
                streamer.streamInfo = data.streamInfo;
            }
            renderVoiceUsers();
            showToast(`🔴 <b>${escapeHtml(data.username)}</b> iniciou uma transmissão 60 FPS!`);
            break;

        case 'stream_stopped':
            const st = state.users.get(data.userId);
            if (st) {
                st.isStreaming = false;
                st.streamInfo = null;
            }
            removeStream(data.userId);
            renderVoiceUsers();
            break;

        case 'chat_message':
            renderChatMessage(data);
            break;

        case 'webrtc_offer':
            await handleWebRTCOffer(data);
            break;

        case 'webrtc_answer':
            await handleWebRTCAnswer(data);
            break;

        case 'webrtc_ice':
            await handleWebRTCIce(data);
            break;
    }
}

// --- WebRTC Peer-to-Peer ---
async function getOrCreatePeerConnection(targetUserId) {
    if (state.peerConnections.has(targetUserId)) {
        return state.peerConnections.get(targetUserId);
    }

    const pc = new RTCPeerConnection(rtcConfig);
    state.peerConnections.set(targetUserId, pc);

    // Envia áudio do microfone
    if (state.localAudioStream) {
        state.localAudioStream.getTracks().forEach(track => {
            pc.addTrack(track, state.localAudioStream);
        });
    }

    // Envia tela se estiver transmitindo
    if (state.localScreenStream) {
        state.localScreenStream.getTracks().forEach(track => {
            const sender = pc.addTrack(track, state.localScreenStream);
            if (track.kind === 'video') {
                optimizeSenderBitrate(sender);
            }
        });
    }

    // Candidatos ICE
    pc.onicecandidate = (e) => {
        if (e.candidate) {
            sendWs({
                type: 'webrtc_ice',
                target: targetUserId,
                candidate: e.candidate
            });
        }
    };

    // Recebimento de Áudio e Vídeo 60 FPS
    pc.ontrack = (event) => {
        const stream = event.streams[0] || new MediaStream([event.track]);
        const trackKind = event.track.kind;

        if (trackKind === 'audio') {
            // Elemento de áudio dedicado com controle individual de volume
            let audioEl = state.remoteAudioElements.get(targetUserId);
            if (!audioEl) {
                audioEl = document.createElement('audio');
                audioEl.id = `audio-remote-${targetUserId}`;
                audioEl.autoplay = true;
                document.body.appendChild(audioEl);
                state.remoteAudioElements.set(targetUserId, audioEl);
            }
            audioEl.srcObject = stream;

            // Aplica volume e mudo local salvos
            applyUserVolume(targetUserId);
        }

        if (trackKind === 'video') {
            const user = state.users.get(targetUserId);
            const name = user ? user.username : 'Amigo';
            addStream(targetUserId, stream, name, user ? user.streamInfo : null);
        }
    };

    pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            closePeerConnection(targetUserId);
        }
    };

    return pc;
}

function closePeerConnection(userId) {
    if (state.peerConnections.has(userId)) {
        try { state.peerConnections.get(userId).close(); } catch (e) {}
        state.peerConnections.delete(userId);
    }
    iceQueue.delete(userId);
    const audioEl = state.remoteAudioElements.get(userId);
    if (audioEl) {
        audioEl.remove();
        state.remoteAudioElements.delete(userId);
    }
}

async function initiatePeerConnection(targetUserId) {
    const pc = await getOrCreatePeerConnection(targetUserId);
    const offer = await pc.createOffer();
    const enhanced = new RTCSessionDescription({
        type: offer.type,
        sdp: enhanceSDP(offer.sdp)
    });
    await pc.setLocalDescription(enhanced);

    sendWs({
        type: 'webrtc_offer',
        target: targetUserId,
        offer: enhanced
    });
}

async function handleWebRTCOffer(data) {
    const pc = await getOrCreatePeerConnection(data.sender);
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    drainIceQueue(data.sender, pc);

    const answer = await pc.createAnswer();
    const enhanced = new RTCSessionDescription({
        type: answer.type,
        sdp: enhanceSDP(answer.sdp)
    });
    await pc.setLocalDescription(enhanced);

    sendWs({
        type: 'webrtc_answer',
        target: data.sender,
        answer: enhanced
    });
}

async function handleWebRTCAnswer(data) {
    const pc = state.peerConnections.get(data.sender);
    if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        drainIceQueue(data.sender, pc);
    }
}

async function handleWebRTCIce(data) {
    const pc = state.peerConnections.get(data.sender);
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
        if (!iceQueue.has(data.sender)) {
            iceQueue.set(data.sender, []);
        }
        if (data.candidate) {
            iceQueue.get(data.sender).push(new RTCIceCandidate(data.candidate));
        }
        return;
    }
    if (data.candidate) {
        try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) {}
    }
}

async function optimizeSenderBitrate(sender) {
    try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
        }
        params.encodings[0].maxBitrate = state.streamConfig.bitrate * 1000;
        params.encodings[0].maxFramerate = state.streamConfig.fps;
        params.encodings[0].priority = 'high';
        params.encodings[0].networkPriority = 'high';
        await sender.setParameters(params);
    } catch (e) {}
}

function enhanceSDP(sdp) {
    const b = state.streamConfig.bitrate;
    return sdp.replace(/a=mid:video\r\n/g, `a=mid:video\r\nb=AS:${b}\r\nb=TIAS:${b * 1000}\r\n`);
}

// --- Microfone Local ---
async function startMicrophone(deviceId = null) {
    try {
        const audioConstraints = {
            echoCancellation: document.getElementById('chk-echo-cancellation')?.checked ?? true,
            noiseSuppression: document.getElementById('chk-noise-suppression')?.checked ?? true,
            autoGainControl: true
        };
        if (deviceId) {
            audioConstraints.deviceId = { exact: deviceId };
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: false
        });
        state.localAudioStream = stream;

        // Atualiza nos peers
        state.peerConnections.forEach(pc => {
            stream.getAudioTracks().forEach(track => pc.addTrack(track, stream));
        });
    } catch (e) {
        console.warn('Microfone não ativado:', e);
    }
}

// --- Transmissão 60 FPS com ISOLAMENTO DE ÁUDIO ---
async function startScreenShare() {
    const res = state.streamConfig.resolution;
    const fps = state.streamConfig.fps;

    const width = res === 1440 ? 2560 : (res === 1080 ? 1920 : 1280);
    const height = res === 1440 ? 1440 : (res === 1080 ? 1080 : 720);

    // Configurações com isolamento de áudio das salas de voz
    const constraints = {
        video: {
            frameRate: { ideal: fps, max: fps },
            width: { ideal: width, max: width },
            height: { ideal: height, max: height }
        },
        audio: state.streamConfig.captureAudio ? {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            channelCount: 2,
            sampleRate: 48000
        } : false,
        // Evita captura em loop do próprio navegador/aba onde os amigos estão falando
        selfBrowserSurface: 'exclude',
        systemAudio: 'include',
        surfaceSwitching: 'include'
    };

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
        state.localScreenStream = stream;
        state.isStreaming = true;

        const hasAudio = stream.getAudioTracks().length > 0;
        if (state.streamConfig.captureAudio && !hasAudio) {
            showToast('💡 Dica: Para capturar som do jogo sem a voz dos amigos, selecione a <b>Janela do Jogo</b> e marque <b>"Compartilhar áudio"</b>.', 7000);
        } else if (hasAudio) {
            showToast('🎮 Transmissão 60 FPS iniciada com isolamento de áudio do sistema!', 4000);
        }

        addStream(state.userId, stream, state.username + ' (Você)', {
            resolution: `${res}p`,
            fps: fps
        });

        const btn = document.getElementById('btn-stream-toggle');
        btn.classList.add('streaming');
        document.getElementById('btn-stream-text').textContent = 'Parar Tela';

        // Envia para os peers com renegociação
        for (const [targetId, pc] of state.peerConnections.entries()) {
            stream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, stream);
                if (track.kind === 'video') optimizeSenderBitrate(sender);
            });
            try {
                if (pc.signalingState === 'stable') {
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    sendWs({
                        type: 'webrtc_offer',
                        target: targetId,
                        offer: offer
                    });
                }
            } catch (e) {}
        }

        sendWs({
            type: 'screen_start',
            streamInfo: { resolution: `${res}p`, fps: fps }
        });

        stream.getVideoTracks()[0].onended = () => stopScreenShare();

    } catch (e) {
        if (e.name !== 'NotAllowedError') {
            alert('Não foi possível iniciar a transmissão: ' + e.message);
        }
    }
}

function stopScreenShare() {
    if (state.localScreenStream) {
        state.localScreenStream.getTracks().forEach(t => t.stop());
        state.localScreenStream = null;
    }
    state.isStreaming = false;

    const btn = document.getElementById('btn-stream-toggle');
    btn.classList.remove('streaming');
    document.getElementById('btn-stream-text').textContent = 'Transmitir Tela';

    removeStream(state.userId);
    sendWs({ type: 'screen_stop' });
}

// --- SELETOR DE MÚLTIPLAS LIVES (ESCOLHER QUAL ASSISTIR) ---
function addStream(userId, stream, username, info) {
    state.activeStreams.set(userId, { stream, username, info });
    renderStreamTabs();
    if (!state.currentlyWatchingUserId || state.currentlyWatchingUserId === userId) {
        selectLiveStream(userId);
    }
}

function removeStream(userId) {
    state.activeStreams.delete(userId);
    renderStreamTabs();

    if (state.currentlyWatchingUserId === userId) {
        const remaining = Array.from(state.activeStreams.keys());
        if (remaining.length > 0) {
            selectLiveStream(remaining[0]);
        } else {
            state.currentlyWatchingUserId = null;
            document.getElementById('video-stage').style.display = 'none';
            document.getElementById('stream-switcher-bar').style.display = 'none';
            stopFpsCounter();
        }
    }
}

function selectLiveStream(userId) {
    const item = state.activeStreams.get(userId);
    if (!item) return;

    state.currentlyWatchingUserId = userId;
    const stage = document.getElementById('video-stage');
    const video = document.getElementById('stage-video');

    stage.style.display = 'flex';
    video.srcObject = item.stream;
    video.muted = (userId === state.userId);

    video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => {});
    });

    document.getElementById('hud-streamer-name').textContent = `Transmitido por: ${item.username}`;
    document.getElementById('hud-res').textContent = item.info ? `${item.info.resolution}` : '1440p (2K)';
    document.getElementById('hud-fps').textContent = item.info ? `${item.info.fps}.0 FPS` : '60.0 FPS';

    startFpsCounter(video);
    renderStreamTabs();
}

function renderStreamTabs() {
    const bar = document.getElementById('stream-switcher-bar');
    const container = document.getElementById('stream-tabs-container');

    if (state.activeStreams.size === 0) {
        bar.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    bar.style.display = 'flex';
    container.innerHTML = '';

    state.activeStreams.forEach((item, uid) => {
        const isActive = (uid === state.currentlyWatchingUserId);
        const btn = document.createElement('button');
        btn.className = `stream-tab-btn ${isActive ? 'active' : ''}`;
        btn.innerHTML = `
            <span class="stream-dot"></span>
            <span>${escapeHtml(item.username)}</span>
            ${isActive ? '<span style="font-size:10px;opacity:0.8;">(Assistindo)</span>' : ''}
        `;
        btn.onclick = () => selectLiveStream(uid);
        container.appendChild(btn);
    });
}

function startFpsCounter(videoElement) {
    stopFpsCounter();
    let frameCount = 0;
    let lastTime = performance.now();

    const checkFrame = () => {
        if ('requestVideoFrameCallback' in videoElement) {
            videoElement.requestVideoFrameCallback(() => {
                frameCount++;
                const now = performance.now();
                if (now - lastTime >= 1000) {
                    const fps = ((frameCount * 1000) / (now - lastTime)).toFixed(1);
                    const el = document.getElementById('hud-fps');
                    if (el) el.textContent = `${fps} FPS`;
                    frameCount = 0;
                    lastTime = now;
                }
                if (state.currentlyWatchingUserId) checkFrame();
            });
        }
    };
    checkFrame();
}

function stopFpsCounter() {
    if (state.fpsInterval) {
        clearInterval(state.fpsInterval);
        state.fpsInterval = null;
    }
}

// --- MENU DE CONTEXTO DO DISCORD (BOTÃO DIREITO NO AMIGO) ---
function openUserContextMenu(e, userId) {
    e.preventDefault();
    e.stopPropagation();

    state.activeContextUserId = userId;
    const user = state.users.get(userId);
    const name = user ? user.username : (userId === state.userId ? state.username : 'Amigo');
    const avatar = user ? user.avatar : state.avatarColor;
    const isSelf = (userId === state.userId);

    const menu = document.getElementById('user-context-menu');
    document.getElementById('ctx-username').textContent = name + (isSelf ? ' (Você)' : '');
    document.getElementById('ctx-tag').textContent = isSelf ? state.userTag : (user?.userTag || '#6060');
    const av = document.getElementById('ctx-user-avatar');
    av.textContent = name[0].toUpperCase();
    av.style.backgroundColor = avatar;

    // Slider de volume (0 a 200%)
    const currentVol = state.userVolumes.get(userId) ?? 100;
    const volSlider = document.getElementById('ctx-volume-slider');
    volSlider.value = currentVol;
    document.getElementById('ctx-vol-val').textContent = `${currentVol}%`;

    // Mudo local
    const isMutedLocally = state.userMutedLocally.has(userId);
    document.getElementById('ctx-mute-text').textContent = isMutedLocally ? 'Desmutar para você' : 'Silenciar para você';

    // Opção de assistir live se estiver transmitindo
    const watchBtn = document.getElementById('ctx-btn-watch-stream');
    watchBtn.style.display = state.activeStreams.has(userId) ? 'flex' : 'none';

    // Posiciona menu na tela sem vazar das bordas
    menu.style.display = 'flex';
    const menuWidth = 230;
    const menuHeight = 280;
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;

    menu.style.left = `${Math.max(10, x)}px`;
    menu.style.top = `${Math.max(10, y)}px`;
}

function closeUserContextMenu() {
    const menu = document.getElementById('user-context-menu');
    if (menu) menu.style.display = 'none';
    state.activeContextUserId = null;
}

function applyUserVolume(userId) {
    const audioEl = state.remoteAudioElements.get(userId);
    if (!audioEl) return;

    if (state.userMutedLocally.has(userId)) {
        audioEl.muted = true;
    } else {
        audioEl.muted = false;
        const vol = (state.userVolumes.get(userId) ?? 100) / 100;
        audioEl.volume = Math.min(1.0, Math.max(0, vol));
    }
}

// --- RENDERIZAÇÃO DOS USUÁRIOS NAS SALAS DE VOZ ---
function renderVoiceUsers() {
    const channels = ['geral', 'jogos-60fps', 'cinema-1', 'cinema-2', 'cinema-3', 'competitivo', 'bate-papo', 'afk'];

    channels.forEach(ch => {
        const container = document.getElementById(`voice-users-${ch}`);
        const tag = document.getElementById(`live-tag-${ch}`);
        if (!container) return;

        container.innerHTML = '';
        let hasLive = false;

        // Renderiza usuário local se estiver neste canal
        if (state.currentVoiceChannel === ch) {
            const rowSelf = createVoiceUserRow(state.userId, state.username, state.avatarColor, state.isStreaming, true);
            container.appendChild(rowSelf);
            if (state.isStreaming) hasLive = true;
        }

        // Renderiza amigos
        state.users.forEach(u => {
            if (u.id !== state.userId && u.voiceChannel === ch) {
                const row = createVoiceUserRow(u.id, u.username, u.avatar, u.isStreaming, false);
                container.appendChild(row);
                if (u.isStreaming) hasLive = true;
            }
        });

        if (tag) tag.style.display = hasLive ? 'block' : 'none';
    });
}

function createVoiceUserRow(userId, username, avatarColor, isStreaming, isSelf) {
    const row = document.createElement('div');
    row.className = 'voice-user-row';
    row.draggable = true;
    row.setAttribute('data-user-id', userId);
    row.innerHTML = `
        <div class="voice-user-avatar" style="background:${avatarColor}">${username[0].toUpperCase()}</div>
        <span>${escapeHtml(username)}${isSelf ? ' (Você)' : ''}</span>
        ${isStreaming ? '<span class="live-pill" style="margin-left:auto;font-size:9px;">LIVE 60FPS</span>' : ''}
    `;

    // DRAG AND DROP - Arrastar usuário entre salas
    row.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', userId);
        e.dataTransfer.effectAllowed = 'move';
    };

    // CLIQUE COM BOTÃO DIREITO -> ABRE MENU DO DISCORD
    row.oncontextmenu = (e) => openUserContextMenu(e, userId);

    // Duplo clique se estiver transmitindo foca na live
    if (isStreaming) {
        row.ondblclick = () => selectLiveStream(userId);
    }

    return row;
}

// Mover outro usuário de canal de voz (Opção solicitada)
function moveUserToChannel(userId, newChannel) {
    if (!userId || !newChannel) return;

    const voiceChannelNames = {
        'geral': '🔊 Geral',
        'jogos-60fps': '🎮 Jogos 60FPS',
        'cinema-1': '🎬 Cinema 1 • Filmes',
        'cinema-2': '🍿 Cinema 2 • Séries',
        'cinema-3': '⚽ Cinema 3 • Futebol & TV',
        'competitivo': '🏆 Competitivo / Ranked',
        'bate-papo': '☕ Bate-papo & Chill',
        'afk': '💤 AFK / Ausente'
    };

    if (userId === state.userId) {
        switchVoiceChannel(newChannel);
        return;
    }

    const user = state.users.get(userId);
    const name = user ? user.username : 'Amigo';

    sendWs({
        type: 'move_user',
        targetUserId: userId,
        channelId: newChannel
    });

    showToast(`Movendo <b>${escapeHtml(name)}</b> para <b>${voiceChannelNames[newChannel] || newChannel}</b>...`);
}

// Sair da Sala de Voz (Desconectar)
function leaveVoiceChannel(notifyServer = true) {
    if (!state.currentVoiceChannel) return;

    state.currentVoiceChannel = null;
    document.querySelectorAll('.voice-channel').forEach(el => {
        el.classList.remove('active');
    });

    const statusPanel = document.getElementById('voice-status-panel');
    if (statusPanel) statusPanel.style.display = 'none';

    // Fecha conexões P2P de voz
    state.users.forEach(u => closePeerConnection(u.id));

    // Para microfone
    if (state.localAudioStream) {
        state.localAudioStream.getTracks().forEach(t => t.stop());
        state.localAudioStream = null;
    }

    // Se estiver transmitindo tela, encerra a transmissão
    if (state.isStreaming) {
        stopScreenShare();
    }

    if (notifyServer) {
        sendWs({
            type: 'voice_change',
            channelId: null
        });
    }

    renderVoiceUsers();
    showToast('Desconectado da sala de voz.');
}

// Trocar de Canal de Voz
function switchVoiceChannel(newChannel, notifyServer = true) {
    if (!newChannel) {
        leaveVoiceChannel(notifyServer);
        return;
    }
    if (state.currentVoiceChannel === newChannel) return;

    state.currentVoiceChannel = newChannel;
    document.querySelectorAll('.voice-channel').forEach(el => {
        el.classList.toggle('active', el.dataset.channel === newChannel);
    });

    const chNames = {
        'geral': '🔊 Geral',
        'jogos-60fps': '🎮 Jogos 60FPS',
        'cinema-1': '🎬 Cinema 1 • Filmes',
        'cinema-2': '🍿 Cinema 2 • Séries',
        'cinema-3': '⚽ Cinema 3 • Futebol & TV',
        'competitivo': '🏆 Competitivo / Ranked',
        'bate-papo': '☕ Bate-papo & Chill',
        'afk': '💤 AFK / Ausente'
    };

    // Verifica se a sala de cinema já possui transmissão ativa
    checkRoomCinemaStream(newChannel);

    const statusPanel = document.getElementById('voice-status-panel');
    if (statusPanel) statusPanel.style.display = 'flex';
    document.getElementById('current-voice-channel-name').textContent = `${chNames[newChannel] || newChannel} / 60 FPS RTC`;

    // Inicia microfone apenas se ainda não estiver iniciado
    if (!state.localAudioStream) {
        startMicrophone();
    }

    // Fecha conexões com quem não está no novo canal e inicia com quem está
    state.users.forEach(u => {
        if (u.id !== state.userId) {
            if (u.voiceChannel !== newChannel) {
                closePeerConnection(u.id);
            } else {
                initiatePeerConnection(u.id);
            }
        }
    });

    if (notifyServer) {
        sendWs({
            type: 'voice_change',
            channelId: newChannel
        });
    }

    renderVoiceUsers();
    showToast(`Entrou no canal de voz: <b>${chNames[newChannel] || newChannel}</b>`);
}

// --- CONFIGURAÇÕES DO USUÁRIO & PERFIL ---
function openUserSettingsModal(tabName = 'profile') {
    const modal = document.getElementById('user-settings-modal');
    modal.style.display = 'flex';

    // Preenche campos
    document.getElementById('input-username').value = state.username;
    updateSettingsPreview();
    switchSettingsTab(tabName);
    loadAudioDevices();
}

function closeUserSettingsModal() {
    document.getElementById('user-settings-modal').style.display = 'none';
    stopMicTest();
}

function switchSettingsTab(tabName) {
    document.querySelectorAll('.settings-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.settings-page').forEach(p => {
        p.classList.toggle('active', p.id === `tab-page-${tabName}`);
    });
}

function updateSettingsPreview() {
    const inputVal = document.getElementById('input-username').value.trim() || state.username;
    document.getElementById('settings-preview-name').textContent = inputVal;
    document.getElementById('settings-preview-tag').textContent = state.userTag;
    const av = document.getElementById('settings-preview-avatar');
    av.textContent = inputVal[0].toUpperCase();
    av.style.backgroundColor = state.avatarColor;
}

function saveUserProfile() {
    const newName = document.getElementById('input-username').value.trim();
    if (newName && newName !== state.username) {
        state.username = newName;
        localStorage.setItem('dc_username', newName);
    }

    localStorage.setItem('dc_avatar', state.avatarColor);

    // Atualiza UI própria
    document.getElementById('my-username').textContent = state.username;
    const myAv = document.getElementById('my-avatar');
    myAv.textContent = state.username[0].toUpperCase();
    myAv.style.backgroundColor = state.avatarColor;

    // Notifica o servidor e todos os amigos conectados
    sendWs({
        type: 'update_profile',
        username: state.username,
        avatar: state.avatarColor
    });

    renderVoiceUsers();
    renderStreamTabs();
    closeUserSettingsModal();
    showToast(`✅ Perfil atualizado! Seu nome agora é <b>${escapeHtml(state.username)}</b>.`);
}

// Dispositivos de Áudio (Microfone e Fone)
async function loadAudioDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputSelect = document.getElementById('select-audio-input');
        const outputSelect = document.getElementById('select-audio-output');

        inputSelect.innerHTML = '<option value="">Microfone Padrão do Sistema</option>';
        outputSelect.innerHTML = '<option value="">Dispositivo Padrão do Sistema</option>';

        devices.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.deviceId;
            opt.textContent = d.label || (d.kind === 'audioinput' ? `Microfone ${inputSelect.length}` : `Alto-falante ${outputSelect.length}`);

            if (d.kind === 'audioinput') {
                inputSelect.appendChild(opt);
            } else if (d.kind === 'audiooutput') {
                outputSelect.appendChild(opt);
            }
        });
    } catch (e) {}
}

// Teste de Microfone em Tempo Real com Barra Verde
async function toggleMicTest() {
    const btn = document.getElementById('btn-toggle-mic-test');
    if (state.micTestStream) {
        stopMicTest();
        btn.textContent = 'Vamos testar';
        btn.classList.remove('testing');
    } else {
        try {
            const selectedMicId = document.getElementById('select-audio-input').value;
            const constraints = { audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            state.micTestStream = stream;

            btn.textContent = 'Parar Teste';
            btn.classList.add('testing');

            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const analyser = audioCtx.createAnalyser();
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 256;

            const buffer = new Uint8Array(analyser.frequencyBinCount);
            const fill = document.getElementById('mic-test-fill');

            state.micTestInterval = setInterval(() => {
                analyser.getByteFrequencyData(buffer);
                let sum = 0;
                for (let i = 0; i < buffer.length; i++) sum += buffer[i];
                const avg = sum / buffer.length;
                const pct = Math.min(100, Math.round((avg / 80) * 100));
                fill.style.width = `${pct}%`;
            }, 40);

        } catch (e) {
            alert('Não foi possível acessar o microfone para teste: ' + e.message);
        }
    }
}

function stopMicTest() {
    if (state.micTestInterval) {
        clearInterval(state.micTestInterval);
        state.micTestInterval = null;
    }
    if (state.micTestStream) {
        state.micTestStream.getTracks().forEach(t => t.stop());
        state.micTestStream = null;
    }
    const fill = document.getElementById('mic-test-fill');
    if (fill) fill.style.width = '0%';
    const btn = document.getElementById('btn-toggle-mic-test');
    if (btn) {
        btn.textContent = 'Vamos testar';
        btn.classList.remove('testing');
    }
}

// --- CHAT DE TEXTO ---
function addSystemChatMessage(text) {
    const list = document.getElementById('messages-list');
    const msg = document.createElement('div');
    msg.className = 'system-message';
    msg.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${text}</span>`;
    list.appendChild(msg);
    list.scrollTop = list.scrollHeight;
}

function renderChatMessage(data) {
    const list = document.getElementById('messages-list');
    const row = document.createElement('div');
    row.className = 'chat-message-row';
    const time = data.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    row.innerHTML = `
        <div class="chat-avatar" style="background:${data.avatar}">${data.username[0].toUpperCase()}</div>
        <div class="chat-content">
            <div>
                <span class="chat-author" style="cursor:pointer;">${escapeHtml(data.username)}</span>
                <span class="chat-time">${time}</span>
            </div>
            <div class="chat-text">${escapeHtml(data.text)}</div>
        </div>
    `;

    // Clique com botão direito no autor da mensagem
    row.querySelector('.chat-author').oncontextmenu = (e) => openUserContextMenu(e, data.senderId);

    list.appendChild(row);
    list.scrollTop = list.scrollHeight;
}

function showToast(text, duration = 4000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = text;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// --- SETUP GERAL DOS EVENT LISTENERS ---
function setupEventListeners() {
    // 1. Troca de Canais de Voz ao Clicar & Suporte a Drag and Drop para Mover Usuários
    document.querySelectorAll('.voice-channel').forEach(el => {
        el.onclick = () => switchVoiceChannel(el.dataset.channel);

        // DRAG AND DROP: Permite arrastar qualquer usuário para esta sala
        el.ondragover = (e) => {
            e.preventDefault();
            el.classList.add('drag-over');
        };
        el.ondragleave = () => {
            el.classList.remove('drag-over');
        };
        el.ondrop = (e) => {
            e.preventDefault();
            el.classList.remove('drag-over');
            const uid = e.dataTransfer.getData('text/plain');
            if (uid) {
                moveUserToChannel(uid, el.dataset.channel);
            }
        };
    });

    // 2. Troca de Canais de Texto
    document.querySelectorAll('.channel-item[data-type="text"]').forEach(el => {
        el.onclick = () => {
            document.querySelectorAll('.channel-item[data-type="text"]').forEach(c => c.classList.remove('active'));
            el.classList.add('active');
            state.currentTextChannel = el.dataset.channel;
            document.getElementById('current-channel-title').textContent = el.dataset.channel;
            document.getElementById('chat-input').placeholder = `Conversar em #${el.dataset.channel}...`;
        };
    });

    // 3. Botões de Transmissão de Tela
    const streamModal = document.getElementById('stream-modal');
    document.getElementById('btn-stream-toggle').onclick = () => {
        if (state.isStreaming) stopScreenShare();
        else streamModal.style.display = 'flex';
    };
    document.getElementById('btn-quick-stream').onclick = () => {
        streamModal.style.display = 'flex';
    };
    document.getElementById('btn-close-modal').onclick = () => streamModal.style.display = 'none';
    document.getElementById('btn-cancel-stream').onclick = () => streamModal.style.display = 'none';

    // Opções do modal de stream
    document.querySelectorAll('#opt-resolution .opt-card').forEach(c => {
        c.onclick = () => {
            document.querySelectorAll('#opt-resolution .opt-card').forEach(x => x.classList.remove('active'));
            c.classList.add('active');
            state.streamConfig.resolution = parseInt(c.dataset.res);
        };
    });
    document.querySelectorAll('#opt-fps .opt-card').forEach(c => {
        c.onclick = () => {
            document.querySelectorAll('#opt-fps .opt-card').forEach(x => x.classList.remove('active'));
            c.classList.add('active');
            state.streamConfig.fps = parseInt(c.dataset.fps);
        };
    });
    document.getElementById('chk-audio').onchange = (e) => state.streamConfig.captureAudio = e.target.checked;
    document.getElementById('chk-isolate-voice').onchange = (e) => state.streamConfig.isolateVoice = e.target.checked;

    document.getElementById('btn-confirm-stream').onclick = () => {
        streamModal.style.display = 'none';
        startScreenShare();
    };

    // 4. Convidar Amigos (Copiar Link)
    document.getElementById('btn-copy-invite').onclick = async () => {
        const url = state.publicTunnelUrl || window.location.href;
        try {
            await navigator.clipboard.writeText(url);
            showToast(`🔗 <b>Link público copiado!</b><br>Envie para seus amigos:<br><small>${url}</small>`, 6000);
        } catch (e) {
            prompt('Copie o link abaixo para seus amigos:', url);
        }
    };

    // 5. Chat Input
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-send-message');
    const doSend = () => {
        const text = chatInput.value.trim();
        if (text) {
            sendWs({
                type: 'chat_message',
                text: text,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });
            chatInput.value = '';
        }
    };
    sendBtn.onclick = doSend;
    chatInput.onkeydown = (e) => { if (e.key === 'Enter') doSend(); };

    // 6. Controles de Áudio da Tela
    const volSlider = document.getElementById('vid-volume-slider');
    const vid = document.getElementById('stage-video');
    volSlider.oninput = (e) => {
        vid.volume = parseFloat(e.target.value);
        vid.muted = (vid.volume === 0);
    };
    document.getElementById('btn-vid-vol').onclick = () => {
        vid.muted = !vid.muted;
        volSlider.value = vid.muted ? 0 : 1;
    };
    document.getElementById('btn-vid-fullscreen').onclick = () => {
        if (vid.requestFullscreen) vid.requestFullscreen();
    };

    // 7. Mute e Deafen
    document.getElementById('btn-mic').onclick = () => {
        state.isMuted = !state.isMuted;
        document.getElementById('btn-mic').classList.toggle('active', state.isMuted);
        if (state.localAudioStream) {
            state.localAudioStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
        }
        showToast(state.isMuted ? '🔇 Microfone silenciado.' : '🎙️ Microfone ativado.');
    };

    document.getElementById('btn-deafen').onclick = () => {
        state.isDeafened = !state.isDeafened;
        document.getElementById('btn-deafen').classList.toggle('active', state.isDeafened);
        state.remoteAudioElements.forEach(a => a.muted = state.isDeafened);
        vid.muted = state.isDeafened;
        showToast(state.isDeafened ? '🎧 Áudio ensurdecido.' : '🔊 Áudio reativado.');
    };

    // 8. MENU DE CONTEXTO DO DISCORD (LISTENERS)
    const ctxVolSlider = document.getElementById('ctx-volume-slider');
    ctxVolSlider.oninput = (e) => {
        const val = parseInt(e.target.value);
        document.getElementById('ctx-vol-val').textContent = `${val}%`;
        if (state.activeContextUserId) {
            state.userVolumes.set(state.activeContextUserId, val);
            applyUserVolume(state.activeContextUserId);
            // Salva preferência
            const obj = {};
            state.userVolumes.forEach((v, k) => obj[k] = v);
            localStorage.setItem('dc_user_volumes', JSON.stringify(obj));
        }
    };

    document.getElementById('ctx-btn-mute').onclick = () => {
        if (!state.activeContextUserId) return;
        const uid = state.activeContextUserId;
        if (state.userMutedLocally.has(uid)) {
            state.userMutedLocally.delete(uid);
            showToast('🔊 Usuário desmutado para você.');
        } else {
            state.userMutedLocally.add(uid);
            showToast('🔇 Usuário silenciado para você.');
        }
        applyUserVolume(uid);
        closeUserContextMenu();
    };

    document.getElementById('ctx-btn-mention').onclick = () => {
        if (!state.activeContextUserId) return;
        const user = state.users.get(state.activeContextUserId);
        const name = user ? user.username : 'Amigo';
        chatInput.value += `@${name} `;
        chatInput.focus();
        closeUserContextMenu();
    };

    document.getElementById('ctx-btn-watch-stream').onclick = () => {
        if (state.activeContextUserId) {
            selectLiveStream(state.activeContextUserId);
        }
        closeUserContextMenu();
    };

    document.getElementById('ctx-btn-copy-id').onclick = () => {
        if (state.activeContextUserId) {
            navigator.clipboard.writeText(state.activeContextUserId);
            showToast('📋 ID copiado para a Área de Transferência.');
        }
        closeUserContextMenu();
    };

    // Mover usuário através do submenu do botão direito
    document.querySelectorAll('#ctx-submenu-channels .ctx-submenu-item').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            if (state.activeContextUserId) {
                const targetChannel = item.dataset.channel;
                moveUserToChannel(state.activeContextUserId, targetChannel);
            }
            closeUserContextMenu();
        };
    });

    document.getElementById('ctx-btn-disconnect-voice').onclick = () => {
        if (state.activeContextUserId) {
            moveUserToChannel(state.activeContextUserId, 'afk');
        }
        closeUserContextMenu();
    };

    // Fecha menu de contexto ao clicar em qualquer outro lugar
    window.addEventListener('click', (e) => {
        const menu = document.getElementById('user-context-menu');
        if (menu && !menu.contains(e.target)) closeUserContextMenu();
    });

    // 9. CONFIGURAÇÕES DO USUÁRIO (MODAL DISCORD)
    document.getElementById('btn-settings').onclick = () => openUserSettingsModal('profile');
    document.getElementById('user-footer-avatar-wrap').onclick = () => openUserSettingsModal('profile');
    document.getElementById('user-footer-info').onclick = () => openUserSettingsModal('profile');
    document.getElementById('btn-open-settings-rail').onclick = () => openUserSettingsModal('profile');
    document.getElementById('btn-close-settings').onclick = closeUserSettingsModal;

    document.querySelectorAll('.settings-tab').forEach(t => {
        t.onclick = () => switchSettingsTab(t.dataset.tab);
    });

    document.getElementById('input-username').oninput = updateSettingsPreview;

    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.onclick = () => {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            state.avatarColor = dot.dataset.color;
            updateSettingsPreview();
        };
    });

    document.getElementById('btn-save-profile').onclick = saveUserProfile;
    document.getElementById('btn-toggle-mic-test').onclick = toggleMicTest;

    // Dispositivo de Entrada de Áudio
    document.getElementById('select-audio-input').onchange = (e) => {
        if (state.localAudioStream) {
            state.localAudioStream.getTracks().forEach(t => t.stop());
        }
        startMicrophone(e.target.value);
    };

    // Dispositivo de Saída de Áudio (setSinkId)
    document.getElementById('select-audio-output').onchange = async (e) => {
        const deviceId = e.target.value;
        if (deviceId && 'setSinkId' in HTMLMediaElement.prototype) {
            state.remoteAudioElements.forEach(async el => {
                try { await el.setSinkId(deviceId); } catch (err) {}
            });
            const vid = document.getElementById('stage-video');
            if (vid) {
                try { await vid.setSinkId(deviceId); } catch (err) {}
            }
            showToast('Dispositivo de saída atualizado.');
        }
    };

    // Desconectar da sala de voz
    const btnDisc = document.getElementById('btn-disconnect-voice');
    if (btnDisc) btnDisc.onclick = () => leaveVoiceChannel();

    // Botões IPTV e Cinema
    const btnIptv = document.getElementById('btn-open-iptv');
    if (btnIptv) btnIptv.onclick = openIptvModal;
    const btnCloseIptv = document.getElementById('btn-close-iptv-modal');
    if (btnCloseIptv) btnCloseIptv.onclick = closeIptvModal;
    const btnStopCinema = document.getElementById('btn-stop-cinema');
    if (btnStopCinema) btnStopCinema.onclick = stopCinemaStream;

    document.querySelectorAll('.iptv-type-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.iptv-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadIptvCategories(btn.dataset.type);
        };
    });

    const iptvSearch = document.getElementById('iptv-search-input');
    if (iptvSearch) {
        let timer = null;
        iptvSearch.oninput = (e) => {
            clearTimeout(timer);
            const q = e.target.value.trim().toLowerCase();
            timer = setTimeout(() => {
                const cards = document.querySelectorAll('.iptv-stream-card');
                cards.forEach(c => {
                    const title = c.querySelector('.iptv-stream-title')?.textContent?.toLowerCase() || '';
                    c.style.display = title.includes(q) ? 'flex' : 'none';
                });
            }, 250);
        };
    }

    // Fechar modais com tecla ESC
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeUserSettingsModal();
            closeUserContextMenu();
            closeIptvModal();
            document.getElementById('stream-modal').style.display = 'none';
        }
    });

    // Desconecta e sai imediatamente ao fechar a aba
    window.addEventListener('beforeunload', () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            sendWs({ type: 'leave', userId: state.userId });
            socket.close();
        }
    });
    window.addEventListener('pagehide', () => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
    });
}

// --- CONTROLE DE TRANSMISSÃO IPTV NAS 3 SALAS DE CINEMA ---
function checkRoomCinemaStream(room) {
    const stopBtn = document.getElementById('btn-stop-cinema');
    if (!room || !room.startsWith('cinema-')) {
        if (state.hlsInstance) {
            state.hlsInstance.destroy();
            state.hlsInstance = null;
        }
        if (stopBtn) stopBtn.style.display = 'none';
        return;
    }

    const cinema = state.cinemaRooms ? state.cinemaRooms[room] : null;
    if (cinema) {
        playCinemaStream(cinema);
        if (stopBtn) stopBtn.style.display = 'flex';
    } else {
        if (state.hlsInstance) {
            state.hlsInstance.destroy();
            state.hlsInstance = null;
        }
        const stage = document.getElementById('video-stage');
        const video = document.getElementById('stage-video');
        if (video) {
            video.pause();
            video.srcObject = null;
            video.src = '';
        }
        if (stage && !state.currentlyWatchingUserId) {
            stage.style.display = 'none';
        }
        if (stopBtn) stopBtn.style.display = 'none';
    }
}

function playCinemaStream(cinema) {
    const stage = document.getElementById('video-stage');
    const video = document.getElementById('stage-video');
    if (!stage || !video) return;

    stage.style.display = 'flex';
    video.srcObject = null;

    document.getElementById('hud-streamer-name').textContent = `🎬 Cinema IPTV: ${cinema.streamName}`;
    document.getElementById('hud-res').textContent = '1080p FHD';
    document.getElementById('hud-fps').textContent = '60 FPS';

    if (state.hlsInstance) {
        state.hlsInstance.destroy();
        state.hlsInstance = null;
    }

    if (cinema.streamType === 'live') {
        const streamUrl = `/api/iptv/live/${cinema.streamId}.m3u8`;
        if (window.Hls && Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true
            });
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(() => {});
            });
            state.hlsInstance = hls;
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = streamUrl;
            video.play().catch(() => {});
        }
    } else {
        const vodUrl = `/api/iptv/vod/${cinema.streamId}?ext=${cinema.ext || 'mp4'}`;
        video.src = vodUrl;
        video.play().catch(() => {});
    }

    const stopBtn = document.getElementById('btn-stop-cinema');
    if (stopBtn) stopBtn.style.display = 'flex';
}

function stopCinemaStream() {
    const room = state.currentVoiceChannel;
    if (!room || !room.startsWith('cinema-')) {
        showToast('Entre em uma das salas de cinema para parar a transmissão.');
        return;
    }
    sendWs({
        type: 'cinema_stop',
        room: room
    });
}

function openIptvModal() {
    const modal = document.getElementById('iptv-modal');
    modal.style.display = 'flex';
    if (state.currentVoiceChannel && state.currentVoiceChannel.startsWith('cinema-')) {
        document.getElementById('iptv-select-target-room').value = state.currentVoiceChannel;
    }
    loadIptvCategories(state.currentIptvType);
}

function closeIptvModal() {
    document.getElementById('iptv-modal').style.display = 'none';
}

async function loadIptvCategories(type = 'live') {
    state.currentIptvType = type;
    const catList = document.getElementById('iptv-categories-list');
    catList.innerHTML = '<div class="iptv-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando categorias...</div>';
    
    try {
        const res = await fetch(`/api/iptv/categories?type=${type}`);
        const data = await res.json();
        state.iptvCategories = data;
        renderIptvCategories(data);
        if (data.length > 0) {
            loadIptvStreams(type, data[0].category_id, data[0].category_name);
        }
    } catch (e) {
        catList.innerHTML = '<div class="iptv-placeholder">Erro ao carregar categorias.</div>';
    }
}

function renderIptvCategories(categories) {
    const catList = document.getElementById('iptv-categories-list');
    catList.innerHTML = '';
    categories.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'iptv-cat-item';
        item.dataset.catId = cat.category_id;
        item.innerHTML = `
            <span>${escapeHtml(cat.category_name)}</span>
            <span class="iptv-cat-count">${cat.stream_count ?? ''}</span>
        `;
        item.onclick = () => {
            document.querySelectorAll('.iptv-cat-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            loadIptvStreams(state.currentIptvType, cat.category_id, cat.category_name);
        };
        catList.appendChild(item);
    });
    if (catList.firstElementChild) catList.firstElementChild.classList.add('active');
}

async function loadIptvStreams(type, categoryId, categoryName = '') {
    state.currentIptvCategory = categoryId;
    document.getElementById('iptv-current-category-name').textContent = categoryName || 'Canais / Conteúdos';
    const grid = document.getElementById('iptv-streams-grid');
    grid.innerHTML = '<div class="iptv-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando streams...</div>';

    try {
        const res = await fetch(`/api/iptv/streams?type=${type}&category_id=${categoryId}`);
        const streams = await res.json();
        document.getElementById('iptv-streams-count').textContent = `${streams.length} itens`;
        renderIptvStreams(streams);
    } catch (e) {
        grid.innerHTML = '<div class="iptv-placeholder">Erro ao carregar canais desta categoria.</div>';
    }
}

function renderIptvStreams(streams) {
    const grid = document.getElementById('iptv-streams-grid');
    grid.innerHTML = '';
    if (!streams || streams.length === 0) {
        grid.innerHTML = '<div class="iptv-placeholder">Nenhum canal encontrado nesta categoria.</div>';
        return;
    }

    streams.forEach(stream => {
        const card = document.createElement('div');
        card.className = 'iptv-stream-card';
        const iconUrl = stream.stream_icon || '';
        card.innerHTML = `
            ${iconUrl ? `<img src="${escapeHtml(iconUrl)}" class="iptv-stream-logo" onerror="this.onerror=null;this.replaceWith(createFallbackIcon())">` : '<div class="iptv-stream-logo"><i class="fa-solid fa-tv"></i></div>'}
            <div class="iptv-stream-title" title="${escapeHtml(stream.name)}">${escapeHtml(stream.name)}</div>
            <button class="iptv-stream-btn"><i class="fa-solid fa-play"></i> Assistir na Sala</button>
        `;
        card.onclick = () => {
            const targetRoom = document.getElementById('iptv-select-target-room').value;
            sendWs({
                type: 'cinema_play',
                room: targetRoom,
                streamId: stream.stream_id,
                streamName: stream.name,
                streamType: state.currentIptvType,
                ext: stream.container_extension || 'mp4',
                poster: stream.stream_icon || ''
            });
            closeIptvModal();
            if (state.currentVoiceChannel !== targetRoom) {
                switchVoiceChannel(targetRoom);
            }
            showToast(`Transmissão iniciada em <b>${targetRoom}</b>: <b>${escapeHtml(stream.name)}</b>`);
        };
        grid.appendChild(card);
    });
}

function createFallbackIcon() {
    const el = document.createElement('div');
    el.className = 'iptv-stream-logo';
    el.innerHTML = '<i class="fa-solid fa-tv"></i>';
    return el;
}

// Inicialização ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('my-username').textContent = state.username;
    document.getElementById('my-tag').textContent = state.userTag;
    const av = document.getElementById('my-avatar');
    av.textContent = state.username[0].toUpperCase();
    av.style.backgroundColor = state.avatarColor;

    setupEventListeners();
    initWebSocket();
    // NÃO inicia microfone aqui: só inicia ao entrar em uma sala de voz!

    fetch('/api/tunnel-url')
        .then(r => r.json())
        .then(d => {
            if (d.publicUrl) state.publicTunnelUrl = d.publicUrl;
        })
        .catch(() => {});
});
