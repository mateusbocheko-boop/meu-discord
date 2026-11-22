// Reset owner privileges from local storage
try { localStorage.removeItem('discord_is_owner'); } catch (e) {}


// ==========================================================================
// SISTEMA DO DONO DO SERVIDOR (OWNER POWERS) 👑
// ==========================================================================

function isUserAllowedOwner() {
    const myName = (state.username || '').trim().toLowerCase();
    const myTag = (state.userTag || '').trim().toLowerCase();
    return myName === 'dim' || myName.startsWith('dim') || myTag.includes('4095') || myName.includes('tester');
}

function updateOwnerUI() {
    const badge = document.getElementById('btn-owner-badge');
    const label = document.getElementById('owner-badge-label');
    const authBox = document.getElementById('owner-auth-box');
    const powersBox = document.getElementById('owner-powers-box');
    
    const allowed = isUserAllowedOwner();
    if (badge) {
        if (!allowed) {
            badge.style.display = 'none';
        } else {
            badge.style.display = 'flex';
            if (state.isOwner) {
                badge.style.background = 'linear-gradient(135deg, #f1c40f, #e67e22)';
                badge.style.color = '#000';
                if (label) label.textContent = 'Dono Ativo 👑';
            } else {
                badge.style.background = '#2b2d31';
                badge.style.color = '#949ba4';
                if (label) label.textContent = 'Modo Dono';
            }
        }
    }

    if (authBox && powersBox) {
        authBox.style.display = state.isOwner ? 'none' : 'block';
        powersBox.style.display = state.isOwner ? 'block' : 'none';
    }

    // Atualiza botões de adicionar canal
    const addTextBtn = document.getElementById('btn-add-text-channel');
    const addVoiceBtn = document.getElementById('btn-add-voice-channel');
    if (addTextBtn) addTextBtn.style.display = state.isOwner ? 'block' : 'none';
    if (addVoiceBtn) addVoiceBtn.style.display = state.isOwner ? 'block' : 'none';

    renderBannedList();
}

function openOwnerModal() {
    if (!isUserAllowedOwner()) {
        showToast('❌ O Painel do Dono é exclusivo para DIM#4095.');
        return;
    }
    const m = document.getElementById('modal-owner-panel');
    if (m) {
        m.style.display = 'flex';
        updateOwnerUI();
    }
}

function closeOwnerModal() {
    const m = document.getElementById('modal-owner-panel');
    if (m) m.style.display = 'none';
}

function renderBannedList() {
    const listEl = document.getElementById('owner-banned-list');
    if (!listEl) return;
    const banned = state.bannedUsers || [];
    if (!banned.length) {
        listEl.innerHTML = '<div style="padding: 8px; color: #949ba4;">Nenhum usuário banido no momento.</div>';
        return;
    }
    listEl.innerHTML = '';
    banned.forEach(uid => {
        const m = state.serverMembers?.get(uid);
        const name = m ? m.username : uid;
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:8px;border-bottom:1px solid #2b2d31;';
        row.innerHTML = `
            <div style="display:flex;align-items:center;gap:8px;">
                <i class="fa-solid fa-ban" style="color:#da373c;"></i>
                <div>
                    <div style="color:#fff;font-weight:600;font-size:13px;">${escapeHtml(name)}</div>
                    <div style="font-family:monospace;color:#949ba4;font-size:11px;">${escapeHtml(uid)}</div>
                </div>
            </div>
            <button style="background:#23a55a;color:#fff;border:none;padding:5px 12px;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">Desbanir</button>
        `;
        row.querySelector('button').onclick = () => adminUnbanUser(uid);
        listEl.appendChild(row);
    });
}

function adminAuth(key) {
    sendWs({
        type: 'admin_auth',
        key: key
    });
}

function adminStopStream(targetUserId) {
    sendWs({
        type: 'admin_stop_stream',
        targetUserId: targetUserId
    });
    showToast('👑 Solicitado desligamento da transmissão...');
}

function adminStopChannelStreams(channelId) {
    sendWs({
        type: 'admin_stop_stream',
        channelId: channelId
    });
    showToast(`👑 Desligando transmissões na sala <b>${channelId}</b>...`);
}

function adminDisconnectVoice(targetUserId) {
    sendWs({
        type: 'admin_disconnect_voice',
        targetUserId: targetUserId
    });
    showToast('👑 Usuário desconectado da sala de voz.');
}

function adminKickUser(targetUserId) {
    sendWs({
        type: 'admin_kick_user',
        targetUserId: targetUserId
    });
    showToast('👑 Usuário expulso do servidor.');
}

function adminBanUser(targetUserId, targetUsername) {
    sendWs({
        type: 'admin_ban_user',
        targetUserId: targetUserId,
        targetUsername: targetUsername
    });
    showToast(`🔨 Enviada ordem de BAN para o servidor...`);
}

function adminUnbanUser(targetUserId) {
    sendWs({
        type: 'admin_unban_user',
        targetUserId: targetUserId
    });
    state.bannedUsers = (state.bannedUsers || []).filter(u => u !== targetUserId);
    renderBannedList();
    showToast('✅ Usuário desbanido.');
}

function adminCreateChannel(arg1, arg2, icon = '') {
    let name = '';
    let type = 'voice';
    if (arg1 === 'voice' || arg1 === 'text' || arg1 === 'cinema') {
        type = arg1;
        name = arg2 || '';
    } else if (arg2 === 'voice' || arg2 === 'text' || arg2 === 'cinema') {
        name = arg1 || '';
        type = arg2;
    } else {
        name = arg1 || '';
        type = arg2 || 'voice';
    }

    if (!icon) {
        icon = (type === 'voice') ? 'fa-volume-high' : 'fa-hashtag';
    }

    sendWs({
        type: 'admin_create_channel',
        channelType: type,
        name: name,
        icon: icon
    });
    showToast(`👑 Criando sala de ${type === 'voice' ? 'Voz' : 'Texto'} <b>${escapeHtml(name)}</b>...`);
}

function adminDeleteChannel(channelId, type) {
    sendWs({
        type: 'admin_delete_channel',
        channelId: channelId,
        channelType: type
    });
}

// Renderização Dinâmica de Canais (Texto e Voz)
function renderChannels() {
    const textContainer = document.getElementById('text-channels-container');
    const voiceContainer = document.getElementById('voice-channels-container');
    if (!textContainer || !voiceContainer) return;

    textContainer.innerHTML = '';
    voiceContainer.innerHTML = '';

    const textChannels = state.channels?.text || [
        { id: 'geral', name: 'geral' },
        { id: 'clips-e-lives', name: 'clips-e-lives' },
        { id: 'jogos', name: 'jogos' },
        { id: 'memes', name: 'memes' }
    ];

    const voiceChannels = state.channels?.voice || [
        { id: 'geral', name: '🔊 Geral', type: 'voice', icon: 'fa-volume-high' },
        { id: 'jogos-60fps', name: '🎮 Jogos 60FPS', type: 'voice', icon: 'fa-gamepad' },
        { id: 'cinema-1', name: '🎬 Cinema 1 • Filmes', type: 'cinema', icon: 'fa-film' },
        { id: 'cinema-2', name: '🍿 Cinema 2 • Séries', type: 'cinema', icon: 'fa-tv' },
        { id: 'cinema-3', name: '⚽ Cinema 3 • Futebol & TV', type: 'cinema', icon: 'fa-futbol' },
        { id: 'competitivo', name: '🏆 Competitivo / Ranked', type: 'voice', icon: 'fa-trophy' },
        { id: 'bate-papo', name: '☕ Bate-papo & Chill', type: 'voice', icon: 'fa-mug-hot' },
        { id: 'afk', name: '💤 AFK / Ausente', type: 'voice', icon: 'fa-bed' }
    ];

    // Renderiza Canais de Texto
    textChannels.forEach(ch => {
        const item = document.createElement('div');
        item.className = `channel-item ${state.currentTextChannel === ch.id ? 'active' : ''}`;
        item.setAttribute('data-type', 'text');
        item.setAttribute('data-channel', ch.id);
        item.innerHTML = `
            <i class="fa-solid fa-hashtag"></i>
            <span>${escapeHtml(ch.name)}</span>
            ${(state.isOwner && ch.id !== 'geral') ? `<button class="btn-del-channel" title="Excluir Canal"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        item.onclick = (e) => {
            if (e.target.closest('.btn-del-channel')) {
                e.stopPropagation();
                if (confirm(`👑 Deseja realmente excluir o canal de texto #${ch.name}?`)) {
                    adminDeleteChannel(ch.id, 'text');
                }
                return;
            }
            document.querySelectorAll('.channel-item[data-type="text"]').forEach(c => c.classList.remove('active'));
            item.classList.add('active');
            state.currentTextChannel = ch.id;
            const titleEl = document.getElementById('current-channel-title');
            if (titleEl) titleEl.textContent = ch.name;
            const inputEl = document.getElementById('chat-input');
            if (inputEl) inputEl.placeholder = `Conversar em #${ch.name}...`;
        };
        textContainer.appendChild(item);
    });

    // Renderiza Canais de Voz
    voiceChannels.forEach(ch => {
        const vItem = document.createElement('div');
        vItem.className = `voice-channel ${state.currentVoiceChannel === ch.id ? 'active' : ''}`;
        vItem.setAttribute('data-channel', ch.id);
        const iconClass = ch.icon || (ch.id.startsWith('cinema-') ? 'fa-film text-green' : 'fa-volume-high');
        
        vItem.innerHTML = `
            <div class="voice-header">
                <i class="fa-solid ${iconClass}"></i>
                <span>${escapeHtml(ch.name.replace(/^[🔊🎮🎬🍿⚽🏆☕💤]\s*/, ''))}</span>
                <span class="live-pill" id="live-tag-${ch.id}" style="display: none;">AO VIVO</span>
                ${(state.isOwner && ch.id !== 'geral') ? `<button class="btn-del-channel" title="Excluir Sala"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
            <div class="voice-users" id="voice-users-${ch.id}"></div>
        `;

        vItem.onclick = (e) => {
            if (e.target.closest('.btn-del-channel') || e.target.closest('.btn-admin-kill-stream')) return;
            switchVoiceChannel(ch.id);
        };

        const delBtn = vItem.querySelector('.btn-del-channel');
        if (delBtn) {
            delBtn.onclick = (e) => {
                e.stopPropagation();
                if (confirm(`👑 Deseja realmente excluir a sala de voz ${ch.name}?`)) {
                    adminDeleteChannel(ch.id, 'voice');
                }
            };
        }

        vItem.ondragover = (e) => { e.preventDefault(); vItem.classList.add('drag-over'); };
        vItem.ondragleave = () => { vItem.classList.remove('drag-over'); };
        vItem.ondrop = (e) => {
            e.preventDefault();
            vItem.classList.remove('drag-over');
            const uid = e.dataTransfer.getData('text/plain');
            if (uid) moveUserToChannel(uid, ch.id);
        };

        voiceContainer.appendChild(vItem);
    });

    renderVoiceUsers();
    updateOwnerUI();
}



// Modal de Convidar Amigos com link visível e cópia à prova de falhas
function openInviteModal() {
    const modal = document.getElementById('invite-modal');
    const input = document.getElementById('invite-url-input');
    const url = state.publicTunnelUrl || window.location.href;
    if (input) input.value = url;
    if (modal) modal.style.display = 'flex';
    copyInviteLink();
}

function closeInviteModal() {
    const modal = document.getElementById('invite-modal');
    if (modal) modal.style.display = 'none';
}

async function copyInviteLink() {
    const input = document.getElementById('invite-url-input');
    const btn = document.getElementById('btn-copy-invite-modal');
    const url = input ? input.value : (state.publicTunnelUrl || window.location.href);

    let copied = false;
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(url);
            copied = true;
        }
    } catch (e) {}

    if (!copied && input) {
        try {
            input.select();
            input.setSelectionRange(0, 99999);
            copied = document.execCommand('copy');
        } catch (e) {}
    }

    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        btn.style.backgroundColor = '#23a55a';
        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copiar';
            btn.style.backgroundColor = '#5865F2';
        }, 3000);
    }
    showToast(`🔗 <b>Link copiado com sucesso!</b><br><small>${url}</small>`, 5000);
}

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
    mpegtsInstance: null,
    currentIptvType: 'live',
    currentIptvCategory: null,
    iptvCategories: [],

    // Integrantes do Servidor (Online e Offline)
    serverMembers: new Map(), // userId -> memberData
    onlineUserIds: new Set()  // Set de userIds online
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
            if (!state.voiceStates) state.voiceStates = new Map();
            state.voiceStates.clear();
            data.users.forEach(u => {
                state.users.set(u.id, u);
                state.voiceStates.set(u.id, {
                    isMuted: !!u.isMuted,
                    isDeafened: !!u.isDeafened,
                    isSpeaking: false
                });
            });
            if (data.publicTunnelUrl) {
                state.publicTunnelUrl = data.publicTunnelUrl;
            }
            if (data.cinemaRooms) {
                state.cinemaRooms = data.cinemaRooms;
            }
            if (data.members) {
                state.serverMembers.clear();
                data.members.forEach(m => state.serverMembers.set(m.id, m));
            }
            if (data.onlineIds) {
                state.onlineUserIds = new Set(data.onlineIds);
            }
            if (data.channels) {
                state.channels = data.channels;
            }
            if (data.banned) {
                state.bannedUsers = data.banned;
            }
            if (data.isOwner !== undefined) {
                state.isOwner = data.isOwner || (false);
                updateOwnerUI();
            }
            renderChannels();
            renderMembersSidebar();
            break;

        case 'admin_auth_success':
            state.isOwner = true;
            // owner state from server only
            updateOwnerUI();
            renderChannels();
            showToast('👑 <b>Modo Dono ativado com sucesso!</b> Você possui todos os poderes do servidor.', 5000);
            closeOwnerModal();
            break;

        case 'admin_auth_failed':
            showToast(`❌ ${data.message || 'Senha incorreta!'}`, 4000);
            break;

        case 'channel_created':
            if (!state.channels) state.channels = { text: [], voice: [] };
            const chGroup = data.channel.type === 'voice' ? 'voice' : 'text';
            state.channels[chGroup] = state.channels[chGroup] || [];
            // Se ainda não estiver na lista, adiciona
            if (!state.channels[chGroup].some(c => c.id === data.channel.id)) {
                state.channels[chGroup].push(data.channel);
            }
            renderChannels();
            showToast(`📁 Novo canal criado: <b>${escapeHtml(data.channel.name)}</b>`);
            break;

        case 'channel_deleted':
            if (state.channels) {
                if (data.channelType === 'voice') {
                    state.channels.voice = (state.channels.voice || []).filter(c => c.id !== data.channelId);
                    if (state.currentVoiceChannel === data.channelId) {
                        leaveVoiceChannel(false);
                        showToast('ℹ️ O canal de voz onde você estava foi excluído pelo Dono.');
                    }
                } else {
                    state.channels.text = (state.channels.text || []).filter(c => c.id !== data.channelId);
                    if (state.currentTextChannel === data.channelId) {
                        state.currentTextChannel = 'geral';
                    }
                }
            }
            renderChannels();
            showToast('🗑️ Um canal foi excluído pelo Dono.');
            break;

        case 'all_streams_stopped':
            state.activeStreams.clear();
            state.currentlyWatchingUserId = null;
            if (!state.currentCinemaStreamId) {
                const stg = document.getElementById('video-stage');
                const vid = document.getElementById('stage-video');
                if (vid) { try { vid.pause(); } catch(e){} vid.srcObject = null; vid.src = ''; }
                if (stg) stg.style.display = 'none';
            }
            renderStreamTabs();
            renderVoiceUsers();
            showToast('🛑 Todas as transmissões ativas foram desligadas pelo Dono.');
            break;

        case 'cinema_update':
            if (state.cinemaRooms) {
                state.cinemaRooms[data.room] = data.cinema;
            }
            if (state.currentVoiceChannel === data.room) {
                checkRoomCinemaStream(data.room);
            }
            if (data.cinema) {
                showToast(`🎬 Transmissão iniciada em <b>${data.room}</b>: <b>${escapeHtml(data.cinema.streamName)}</b> (Controlado por ${escapeHtml(data.cinema.startedBy)})`);
            } else {
                showToast(`🎬 Transmissão na sala <b>${data.room}</b> finalizada.`);
            }
            break;

        case 'cinema_sync':
            if (state.cinemaRooms && state.cinemaRooms[data.room]) {
                state.cinemaRooms[data.room].currentTime = data.currentTime;
                state.cinemaRooms[data.room].isPlaying = data.isPlaying;
            }
            if (state.currentVoiceChannel === data.room) {
                applyCinemaSync(data);
            }
            break;

        case 'tunnel_ready':
            state.publicTunnelUrl = data.publicTunnelUrl;
            showToast('🌐 Link público gerado! Clique em "Convidar Amigos".');
            break;

        case 'user_joined':
            state.users.set(data.user.id, data.user);
            state.onlineUserIds.add(data.user.id);
            if (data.member) {
                state.serverMembers.set(data.user.id, data.member);
            }
            renderVoiceUsers();
            renderMembersSidebar();

            if (data.isNewMember) {
                showToast(`🎉 <b>Novo Integrante Cadastrado!</b><br><b>${escapeHtml(data.user.username)}</b> entrou pelo link!`, 7000);
                addSystemChatMessage(`🎉 <b>${escapeHtml(data.user.username)}</b> acabou de se cadastrar e entrou no servidor! Dêem as boas-vindas!`);
                playNotificationSound();
            } else {
                showToast(`🔔 <b>${escapeHtml(data.user.username)}</b> conectou no servidor.`);
                addSystemChatMessage(`${data.user.username} entrou no servidor.`);
                playNotificationSound();
            }

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
            if (data.member) {
                state.serverMembers.set(data.user.id, data.member);
            }
            renderVoiceUsers();
            renderMembersSidebar();
            renderStreamTabs();
            break;

        case 'user_left':
            state.users.delete(data.userId);
            state.onlineUserIds.delete(data.userId);
            removeStream(data.userId);
            closePeerConnection(data.userId);
            renderVoiceUsers();
            renderMembersSidebar();
            addSystemChatMessage(`${data.username} saiu e está offline.`);
            break;

        case 'voice_state_update':
            if (!state.voiceStates) state.voiceStates = new Map();
            state.voiceStates.set(data.userId, {
                isMuted: !!data.isMuted,
                isDeafened: !!data.isDeafened,
                isSpeaking: !!data.isSpeaking
            });
            const vUser = state.users.get(data.userId);
            if (vUser) {
                vUser.isMuted = !!data.isMuted;
                vUser.isDeafened = !!data.isDeafened;
                vUser.isSpeaking = !!data.isSpeaking;
            }
            if (data.userId === state.userId) {
                state.isMuted = !!data.isMuted;
                state.isDeafened = !!data.isDeafened;
                const micBtn = document.getElementById('btn-mic');
                if (micBtn) micBtn.classList.toggle('active', state.isMuted);
                const deafenBtn = document.getElementById('btn-deafen');
                if (deafenBtn) deafenBtn.classList.toggle('active', state.isDeafened);
                if (state.localAudioStream) {
                    state.localAudioStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
                }
                if (state.rawMicrophoneStream) {
                    state.rawMicrophoneStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
                }
            }
            updateVoiceUserStateUI(data.userId, !!data.isMuted, !!data.isDeafened, !!data.isSpeaking);
            renderVoiceUsers();
            renderMembersSidebar();
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
                    if (data.channelId === 'afk') {
                        setMicrophoneMuted(true);
                    }
                    if (data.movedBy) {
                        showToast(`🔊 <b>Você foi movido para a sala ${targetChannelName} por ${escapeHtml(data.movedBy)}!</b>`, 5000);
                    }
                }
            } else {
                let u = state.users.get(data.userId);
                if (u) {
                    u.voiceChannel = data.channelId;
                } else {
                    u = {
                        id: data.userId,
                        username: data.movedUser || 'Amigo',
                        avatar: '#5865F2',
                        voiceChannel: data.channelId,
                        isStreaming: false
                    };
                    state.users.set(data.userId, u);
                }
                renderVoiceUsers();
                if (data.channelId === state.currentVoiceChannel) {
                    if (state.userId < data.userId) {
                        initiatePeerConnection(data.userId);
                    }
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

        case 'force_afk':
            showToast(`💤 <b>${escapeHtml(data.message || 'Você foi movido para a sala AFK por inatividade.')}</b>`, 7000);
            switchVoiceChannel('afk', false);
            setMicrophoneMuted(true);
            break;

        case 'force_stop_stream':
            if (state.isStreaming) {
                stopScreenShare();
            }
            showToast('⚠️ Sua transmissão foi encerrada pelo Dono do Servidor.');
            break;

        case 'stream_stopped':
            if (data.userId === state.userId && state.isStreaming) {
                stopScreenShare();
            }
            const st = state.users.get(data.userId);
            if (st) {
                st.isStreaming = false;
                st.streamInfo = null;
            }
            removeStream(data.userId);
            renderVoiceUsers();
            break;

        case 'user_banned':
            if (data.bannedList) {
                state.bannedUsers = data.bannedList;
            }
            if (data.userId) {
                removeStream(data.userId);
                closePeerConnection(data.userId);
                state.users.delete(data.userId);
                state.onlineUserIds.delete(data.userId);
            }
            renderVoiceUsers();
            renderMembersSidebar();
            renderBannedList();
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
                audioEl.playsInline = true;
                document.body.appendChild(audioEl);
                state.remoteAudioElements.set(targetUserId, audioEl);
            }
            audioEl.srcObject = stream;
            audioEl.muted = false;

            // Aplica volume e mudo local salvos
            applyUserVolume(targetUserId);

            // Garante autoplay sem bloqueio do navegador
            const playAudio = () => {
                audioEl.play().catch(err => {
                    const unlock = () => {
                        audioEl.play().catch(() => {});
                        window.removeEventListener('click', unlock);
                        window.removeEventListener('touchstart', unlock);
                    };
                    window.addEventListener('click', unlock, { once: true });
                    window.addEventListener('touchstart', unlock, { once: true });
                });
            };
            playAudio();
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
    if (!state.localAudioStream && state.currentVoiceChannel && state.currentVoiceChannel !== 'afk') {
        await startMicrophone();
    }
    const pc = await getOrCreatePeerConnection(targetUserId);

    // Garante que o track de áudio esteja associado antes da oferta
    if (state.localAudioStream) {
        const senders = pc.getSenders();
        state.localAudioStream.getAudioTracks().forEach(track => {
            if (!senders.some(s => s.track && s.track.kind === 'audio')) {
                pc.addTrack(track, state.localAudioStream);
            }
        });
    }

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
    try {
        if (!state.localAudioStream && state.currentVoiceChannel && state.currentVoiceChannel !== 'afk') {
            await startMicrophone();
        }
        const pc = await getOrCreatePeerConnection(data.sender);

        // Garante que o nosso microfone também seja enviado em resposta
        if (state.localAudioStream) {
            const senders = pc.getSenders();
            state.localAudioStream.getAudioTracks().forEach(track => {
                if (!senders.some(s => s.track && s.track.kind === 'audio')) {
                    pc.addTrack(track, state.localAudioStream);
                }
            });
        }

        // Tratamento seguro contra colisão de ofertas (glare)
        if (pc.signalingState !== 'stable') {
            const isPolite = state.userId < data.sender;
            if (isPolite) {
                await Promise.all([
                    pc.setLocalDescription({ type: 'rollback' }).catch(() => {}),
                    pc.setRemoteDescription(new RTCSessionDescription(data.offer))
                ]);
            } else {
                return;
            }
        } else {
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
        }

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
    } catch (err) {
        console.warn('Erro ao processar webrtc_offer:', err);
    }
}

async function handleWebRTCAnswer(data) {
    const pc = state.peerConnections.get(data.sender);
    if (pc) {
        if (pc.signalingState !== 'have-local-offer') {
            return;
        }
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

// --- Filtro de Voz de Proximidade & Rejeição Extrema de Ruídos Externos (Web Audio API) ---
let voiceAudioCtx = null;
let voiceSourceNode = null;
let voiceGateGain = null;
let voiceAnalyserNode = null;
let voiceDestinationNode = null;
let vadInterval = null;
let lastSpeechTime = Date.now();
let consecutiveVoiceFrames = 0; // Exige voz contínua, rejeita batidas instantâneas na mesa
let ambientNoiseFloor = 18.0;   // Piso de ruído adaptativo da sala (aprende TV/cooler)

async function setupVoiceFilter(rawStream) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
            state.localAudioStream = rawStream;
            return rawStream;
        }

        if (!voiceAudioCtx || voiceAudioCtx.state === 'closed') {
            voiceAudioCtx = new AudioCtx({ sampleRate: 48000 });
        }
        if (voiceAudioCtx.state === 'suspended') {
            await voiceAudioCtx.resume();
        }

        if (voiceSourceNode) {
            try { voiceSourceNode.disconnect(); } catch (e) {}
        }

        voiceSourceNode = voiceAudioCtx.createMediaStreamSource(rawStream);

        // 1. Filtro High-Pass Duplo em Cascata (Corta abaixo de 140Hz: ELIMINA 100% DE BATIDAS NA MESA, TECLADO E RUMBLES GRAVES)
        const highpass1 = voiceAudioCtx.createBiquadFilter();
        highpass1.type = 'highpass';
        highpass1.frequency.setValueAtTime(140, voiceAudioCtx.currentTime);
        highpass1.Q.setValueAtTime(0.8, voiceAudioCtx.currentTime);

        const highpass2 = voiceAudioCtx.createBiquadFilter();
        highpass2.type = 'highpass';
        highpass2.frequency.setValueAtTime(115, voiceAudioCtx.currentTime);
        highpass2.Q.setValueAtTime(0.7, voiceAudioCtx.currentTime);

        // 2. Filtro Low-Pass (Corta acima de 3400Hz: elimina toques finos de celular, alarmes, estática e ruído de fundo)
        const lowpass = voiceAudioCtx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(3400, voiceAudioCtx.currentTime);
        lowpass.Q.setValueAtTime(0.7, voiceAudioCtx.currentTime);

        // 3. Filtro Peaking Vocal (Destaca as formantes primárias da voz humana em 1500Hz)
        const vocalBoost = voiceAudioCtx.createBiquadFilter();
        vocalBoost.type = 'peaking';
        vocalBoost.frequency.setValueAtTime(1500, voiceAudioCtx.currentTime);
        vocalBoost.Q.setValueAtTime(1.1, voiceAudioCtx.currentTime);
        vocalBoost.gain.setValueAtTime(3.5, voiceAudioCtx.currentTime);

        // 4. Analisador Espectral para medição precisa de voz humana próxima
        voiceAnalyserNode = voiceAudioCtx.createAnalyser();
        voiceAnalyserNode.fftSize = 512;
        voiceAnalyserNode.smoothingTimeConstant = 0.2;

        // 5. Portão de Ruído (Noise Gate Dinâmico): Quando não fala, zero absoluto de ganho (silêncio total)
        voiceGateGain = voiceAudioCtx.createGain();
        voiceGateGain.gain.setValueAtTime(0, voiceAudioCtx.currentTime);

        // 6. Destino WebRTC com áudio cristalino e isolado
        voiceDestinationNode = voiceAudioCtx.createMediaStreamDestination();

        // Encadeamento acústico profissional:
        // rawStream -> highpass1 -> highpass2 -> lowpass -> vocalBoost -> voiceAnalyserNode
        //                                                              -> voiceGateGain -> destination
        voiceSourceNode.connect(highpass1);
        highpass1.connect(highpass2);
        highpass2.connect(lowpass);
        lowpass.connect(vocalBoost);
        vocalBoost.connect(voiceAnalyserNode);
        vocalBoost.connect(voiceGateGain);
        voiceGateGain.connect(voiceDestinationNode);

        const processedStream = voiceDestinationNode.stream;
        const processedTrack = processedStream.getAudioTracks()[0];
        if (processedTrack) {
            processedTrack.enabled = !state.isMuted;
        }

        state.localAudioStream = processedStream;
        state.rawMicrophoneStream = rawStream;
        return processedStream;
    } catch (err) {
        console.warn('Erro ao inicializar filtro de voz, usando áudio direto:', err);
        state.localAudioStream = rawStream;
        return rawStream;
    }
}

// --- Microfone Local ---
async function startMicrophone(deviceId = null) {
    try {
        const audioConstraints = {
            echoCancellation: { ideal: true },
            noiseSuppression: { ideal: true },
            autoGainControl: { ideal: true },
            channelCount: 1, // Mono elimina estática
            sampleRate: 48000
        };
        if (deviceId) {
            audioConstraints.deviceId = { exact: deviceId };
        }

        const rawStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: false
        });

        // Passa pelo filtro acústico anti-ruído e portão de silêncio
        const filteredStream = await setupVoiceFilter(rawStream);

        // Se estiver na sala AFK ou silenciado, desativa as tracks de áudio
        if (state.currentVoiceChannel === 'afk' || state.isMuted) {
            filteredStream.getAudioTracks().forEach(track => track.enabled = false);
            rawStream.getAudioTracks().forEach(track => track.enabled = false);
            state.isMuted = true;
            const micBtn = document.getElementById('btn-mic');
            if (micBtn) micBtn.classList.add('active');
        }

        // Atualiza nos peers com a stream filtrada
        state.peerConnections.forEach(pc => {
            filteredStream.getAudioTracks().forEach(track => {
                const senders = pc.getSenders();
                const existing = senders.find(s => s.track && s.track.kind === 'audio');
                if (existing) {
                    try { existing.replaceTrack(track); } catch (e) {}
                } else {
                    try { pc.addTrack(track, filteredStream); } catch (e) {}
                }
            });
        });

        // Inicia detector inteligente exclusivo de voz próxima
        setupVoiceActivityDetection();
    } catch (e) {
        console.warn('Microfone não ativado:', e);
    }
}

function setupVoiceActivityDetection() {
    if (!voiceAnalyserNode || !voiceAudioCtx) return;

    const dataArray = new Uint8Array(voiceAnalyserNode.frequencyBinCount);
    const timeDomainArray = new Uint8Array(voiceAnalyserNode.fftSize);
    let isSpeaking = false;
    lastSpeechTime = Date.now();
    consecutiveVoiceFrames = 0;
    ambientNoiseFloor = 18.0;

    if (vadInterval) clearInterval(vadInterval);
    vadInterval = setInterval(() => {
        if (!state.currentVoiceChannel) return;

        // Se estiver na sala AFK ou mutado, o portão fica totalmente fechado (silêncio)
        if (state.currentVoiceChannel === 'afk' || state.isMuted) {
            consecutiveVoiceFrames = 0;
            if (voiceGateGain) {
                voiceGateGain.gain.setTargetAtTime(0, voiceAudioCtx.currentTime, 0.02);
            }
            if (isSpeaking) {
                isSpeaking = false;
                updateVoiceUserStateUI(state.userId, true, state.isDeafened, false);
                sendWs({ type: 'voice_state', isMuted: true, isDeafened: state.isDeafened, isSpeaking: false });
            }
            return;
        }

        // 1. Obtém espectro de frequências
        voiceAnalyserNode.getByteFrequencyData(dataArray);

        // 2. Mede a energia na faixa específica da voz humana (250Hz a 2800Hz -> bins 3 a 30)
        let speechEnergy = 0;
        let maxBinEnergy = 0;
        for (let i = 3; i <= 30; i++) {
            speechEnergy += dataArray[i];
            if (dataArray[i] > maxBinEnergy) {
                maxBinEnergy = dataArray[i];
            }
        }
        const avgSpeechEnergy = speechEnergy / 28;

        // 3. Mede volume RMS no domínio do tempo
        voiceAnalyserNode.getByteTimeDomainData(timeDomainArray);
        let sumSquares = 0;
        for (let i = 0; i < timeDomainArray.length; i++) {
            const normalized = (timeDomainArray[i] - 128) / 128;
            sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / timeDomainArray.length);

        // 4. Rastreamento inteligente do piso de ruído da sala (ignora TV ao fundo ou ventilador)
        if (!isSpeaking && rms < 0.04) {
            ambientNoiseFloor = (ambientNoiseFloor * 0.95) + (avgSpeechEnergy * 0.05);
            if (ambientNoiseFloor > 40) ambientNoiseFloor = 40;
            if (ambientNoiseFloor < 12) ambientNoiseFloor = 12;
        }

        // 5. Filtro Anti-Toque de Celular e Alarmes (rejeita senóides puras concentradas num único tom)
        const isPureTone = (maxBinEnergy / (avgSpeechEnergy + 0.1)) > 7.2;

        // 6. Limiar de voz próxima: exige volume e energia de quem está falando perto do microfone
        const requiredEnergy = Math.max(42, ambientNoiseFloor + 18);
        const requiredRms = 0.044; // Sons distantes (TV ao fundo) ficam em ~0.02-0.03 e são bloqueados

        const isCandidate = (avgSpeechEnergy > requiredEnergy && rms > requiredRms && !isPureTone);

        // 7. Filtro Anti-Batida na Mesa e Cliques: exige pelo menos 2 frames consecutivos (~120ms) de voz contínua
        if (isCandidate) {
            consecutiveVoiceFrames++;
        } else {
            consecutiveVoiceFrames = Math.max(0, consecutiveVoiceFrames - 1);
        }

        const isVoiceActive = (consecutiveVoiceFrames >= 2);

        if (isVoiceActive) {
            lastSpeechTime = Date.now();

            // Abre o portão de áudio instantaneamente para a voz passar (12ms)
            if (voiceGateGain) {
                voiceGateGain.gain.setTargetAtTime(1.0, voiceAudioCtx.currentTime, 0.012);
            }

            if (!isSpeaking) {
                isSpeaking = true;
                updateVoiceUserStateUI(state.userId, false, state.isDeafened, true);
                sendWs({ type: 'voice_state', isMuted: false, isDeafened: state.isDeafened, isSpeaking: true });
            }
        } else {
            // Sustentação (hold time) de 320ms para pausas naturais entre palavras
            const timeSinceSpeech = Date.now() - lastSpeechTime;
            if (timeSinceSpeech > 320) {
                // Fecha o portão de áudio para ZERO absoluto (corta TV ao fundo e qualquer barulho externo)
                if (voiceGateGain) {
                    voiceGateGain.gain.setTargetAtTime(0.0, voiceAudioCtx.currentTime, 0.035);
                }

                if (isSpeaking) {
                    isSpeaking = false;
                    updateVoiceUserStateUI(state.userId, state.isMuted, state.isDeafened, false);
                    sendWs({ type: 'voice_state', isMuted: state.isMuted, isDeafened: state.isDeafened, isSpeaking: false });
                }
            }
        }

        // Se estiver em canal de voz que NÃO seja o AFK, e ficar 5 minutos em silêncio:
        if (state.currentVoiceChannel && state.currentVoiceChannel !== 'afk') {
            const silenceDuration = Date.now() - lastSpeechTime;
            if (silenceDuration >= 300000) { // 5 minutos (300.000 ms)
                lastSpeechTime = Date.now();
                showToast('💤 Você ficou mais de 5 minutos em silêncio e foi movido para a sala AFK.');
                switchVoiceChannel('afk');
            }
        }
    }, 60); // 60ms por ciclo: resposta rápida para voz e rejeição perfeita de transientes
}

function setMicrophoneMuted(muted) {
    state.isMuted = muted;
    const micBtn = document.getElementById('btn-mic');
    if (micBtn) micBtn.classList.toggle('active', state.isMuted);

    if (state.localAudioStream) {
        state.localAudioStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
    }
    if (state.rawMicrophoneStream) {
        state.rawMicrophoneStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
    }
    if (voiceGateGain && voiceAudioCtx) {
        if (state.isMuted) {
            voiceGateGain.gain.setValueAtTime(0, voiceAudioCtx.currentTime);
        }
    }
    updateVoiceUserStateUI(state.userId, state.isMuted, state.isDeafened, false);
    sendWs({
        type: 'voice_state',
        isMuted: state.isMuted,
        isDeafened: state.isDeafened,
        isSpeaking: false
    });
}

// --- Transmissão 60 FPS com Áudio do Jogo ---
async function startScreenShare() {
    const res = state.streamConfig.resolution;
    const fps = state.streamConfig.fps;

    const width = res === 1440 ? 2560 : (res === 1080 ? 1920 : 1280);
    const height = res === 1440 ? 1440 : (res === 1080 ? 1080 : 720);

    // Bloqueia transmissão de tela em salas de cinema
    if (state.currentVoiceChannel && state.currentVoiceChannel.startsWith('cinema-')) {
        showToast('🚫 <b>Proibido transmitir tela nas salas de cinema!</b><br>As salas de cinema são exclusivas para IPTV (Filmes, Séries e TV). Entre na sala <b>🎮 Jogos 60FPS</b> para compartilhar tela.', 6000);
        return;
    }
    // Se não estiver em nenhuma sala, conecta na sala de jogos
    if (!state.currentVoiceChannel) {
        switchVoiceChannel('jogos-60fps');
    }

    let stream = null;
    try {
        // Tenta capturar tela com áudio
        const constraints = {
            video: {
                frameRate: { ideal: fps, max: fps },
                width: { ideal: width, max: width },
                height: { ideal: height, max: height }
            },
            audio: state.streamConfig.captureAudio ? true : false
        };
        stream = await navigator.mediaDevices.getDisplayMedia(constraints);
    } catch (err) {
        console.warn('Erro getDisplayMedia com áudio, tentando fallback de vídeo:', err);
        try {
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        } catch (e2) {
            if (e2.name !== 'NotAllowedError') {
                alert('Não foi possível iniciar a transmissão de tela: ' + e2.message);
            }
            return;
        }
    }

    try {
        state.localScreenStream = stream;
        state.isStreaming = true;

        const hasAudio = stream.getAudioTracks().length > 0;
        if (!hasAudio) {
            showToast('⚠️ <b>Atenção: Áudio do jogo não capturado!</b><br>No seletor do Windows, escolha a aba <b>"Tela inteira"</b> e marque a caixa <b>"Compartilhar áudio do sistema"</b> para o som do jogo sair.', 9000);
        } else {
            showToast('🎮 Transmissão iniciada com o áudio estéreo do jogo!', 4000);
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

    if (state.currentlyWatchingUserId === userId || state.activeStreams.size === 0) {
        const remaining = Array.from(state.activeStreams.keys());
        if (remaining.length > 0) {
            selectLiveStream(remaining[0]);
        } else {
            state.currentlyWatchingUserId = null;
            // Se não estiver com transmissão IPTV de cinema ativa, limpa o vídeo e oculta o palco
            if (!state.currentCinemaStreamId) {
                const stage = document.getElementById('video-stage');
                const video = document.getElementById('stage-video');
                if (video) {
                    try { video.pause(); } catch (e) {}
                    video.srcObject = null;
                    video.src = '';
                }
                if (stage) stage.style.display = 'none';
            }
            const switcher = document.getElementById('stream-switcher-bar');
            if (switcher) switcher.style.display = 'none';
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
    const user = state.users.get(userId) || state.serverMembers.get(userId);
    const name = user ? user.username : (userId === state.userId ? state.username : 'Amigo');
    const avatar = user ? (user.avatar || user.avatarColor) : state.avatarColor;
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

    // Exibe ou oculta opções exclusivas de Administrador/Dono
    const adminItems = document.querySelectorAll('.admin-only');
    adminItems.forEach(el => {
        el.style.display = (state.isOwner && !isSelf) ? 'flex' : 'none';
    });

    const stopStreamBtn = document.getElementById('ctx-btn-force-stop-stream');
    if (stopStreamBtn) {
        const isStreaming = user?.isStreaming || state.activeStreams.has(userId);
        stopStreamBtn.style.display = (state.isOwner && isStreaming && !isSelf) ? 'flex' : 'none';
    }

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
    const dynamicChannels = (state.channels?.voice || []).map(c => c.id);
    const defaultChannels = ['geral', 'jogos-60fps', 'cinema-1', 'cinema-2', 'cinema-3', 'competitivo', 'bate-papo', 'afk'];
    const channels = Array.from(new Set([...defaultChannels, ...dynamicChannels]));

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

function updateVoiceUserStateUI(userId, isMuted, isDeafened, isSpeaking) {
    if (!state.voiceStates) state.voiceStates = new Map();
    state.voiceStates.set(userId, { isMuted: !!isMuted, isDeafened: !!isDeafened, isSpeaking: !!isSpeaking });

    // Atualiza linha no canal de voz
    const voiceRows = document.querySelectorAll(`.voice-user-row[data-user-id="${userId}"]`);
    voiceRows.forEach(row => {
        const avatar = row.querySelector('.voice-user-avatar');
        if (avatar) {
            avatar.classList.toggle('speaking', !!isSpeaking);
        }
        let dot = row.querySelector('.voice-speaking-dot');
        if (dot) {
            dot.classList.toggle('active', !!isSpeaking);
        }

        // Ícone de Ensurdecido
        let deafenIcon = row.querySelector('.voice-deafen-icon');
        if (isDeafened) {
            if (!deafenIcon) {
                const icon = document.createElement('i');
                icon.className = 'fa-solid fa-ear-deaf voice-deafen-icon';
                icon.title = 'Ensurdecido (Áudio Desativado)';
                row.appendChild(icon);
            }
        } else if (deafenIcon) {
            deafenIcon.remove();
        }

        // Ícone de Mutado
        let muteIcon = row.querySelector('.voice-mute-icon');
        if (isMuted) {
            if (!muteIcon) {
                const icon = document.createElement('i');
                icon.className = 'fa-solid fa-microphone-slash voice-mute-icon';
                icon.title = 'Mutado';
                row.appendChild(icon);
            }
        } else if (muteIcon) {
            muteIcon.remove();
        }
    });

    // Atualiza na barra de membros lateral
    const memberRows = document.querySelectorAll(`.member-row[data-user-id="${userId}"]`);
    memberRows.forEach(row => {
        const nameWrap = row.querySelector('.member-name-wrap');
        if (nameWrap) {
            // Ícone de Ensurdecido
            let deafenIcon = nameWrap.querySelector('.voice-deafen-icon');
            if (isDeafened) {
                if (!deafenIcon) {
                    const icon = document.createElement('i');
                    icon.className = 'fa-solid fa-ear-deaf voice-deafen-icon';
                    icon.title = 'Ensurdecido (Áudio Desativado)';
                    icon.style.cssText = 'font-size: 10px; margin-left: 5px; color: #f23f43;';
                    nameWrap.appendChild(icon);
                }
            } else if (deafenIcon) {
                deafenIcon.remove();
            }

            // Ícone de Mutado
            let muteIcon = nameWrap.querySelector('.voice-mute-icon');
            if (isMuted) {
                if (!muteIcon) {
                    const icon = document.createElement('i');
                    icon.className = 'fa-solid fa-microphone-slash voice-mute-icon';
                    icon.title = 'Mutado';
                    icon.style.cssText = 'font-size: 10px; margin-left: 5px; color: #f23f43;';
                    nameWrap.appendChild(icon);
                }
            } else if (muteIcon) {
                muteIcon.remove();
            }

            // Bolinha falando
            let speakingDot = nameWrap.querySelector('.voice-speaking-dot');
            if (isSpeaking) {
                if (!speakingDot) {
                    const sDot = document.createElement('span');
                    sDot.className = 'voice-speaking-dot active';
                    sDot.style.marginLeft = '5px';
                    nameWrap.appendChild(sDot);
                } else {
                    speakingDot.classList.add('active');
                }
            } else if (speakingDot) {
                speakingDot.remove();
            }
        }
    });
}

function createVoiceUserRow(userId, username, avatarColor, isStreaming, isSelf) {
    const row = document.createElement('div');
    row.className = 'voice-user-row';
    row.draggable = true;
    row.setAttribute('data-user-id', userId);
    const safeName = (username && typeof username === 'string' && username.trim().length > 0) ? username : 'Jogador';
    const initial = safeName[0].toUpperCase();
    const color = avatarColor || '#5865F2';

    const vState = (state.voiceStates && state.voiceStates.get(userId)) || (isSelf ? { isMuted: state.isMuted, isDeafened: state.isDeafened, isSpeaking: false } : { isMuted: false, isDeafened: false, isSpeaking: false });
    const isMuted = !!vState.isMuted;
    const isDeafened = !!vState.isDeafened;
    const isSpeaking = !!vState.isSpeaking;

    row.innerHTML = `
        <div class="voice-user-avatar${isSpeaking ? ' speaking' : ''}" style="background:${color}">${initial}</div>
        <span>${escapeHtml(safeName)}${isSelf ? ' (Você)' : ''}</span>
        <span class="voice-speaking-dot${isSpeaking ? ' active' : ''}"></span>
        ${isDeafened ? '<i class="fa-solid fa-ear-deaf voice-deafen-icon" title="Ensurdecido (Áudio Desativado)"></i>' : ''}
        ${isMuted ? '<i class="fa-solid fa-microphone-slash voice-mute-icon" title="Mutado"></i>' : ''}
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
    
    // Limpa quaisquer transmissões ativas que estavam sendo assistidas nesta sala
    state.activeStreams.clear();
    state.currentlyWatchingUserId = null;
    if (!state.currentCinemaStreamId) {
        const stage = document.getElementById('video-stage');
        const video = document.getElementById('stage-video');
        if (video) {
            try { video.pause(); } catch(e){}
            video.srcObject = null;
            video.src = '';
        }
        if (stage) stage.style.display = 'none';
    }
    renderStreamTabs();

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
async function switchVoiceChannel(newChannel, notifyServer = true) {
    closeMobileDrawers();
    if (!newChannel) {
        leaveVoiceChannel(notifyServer);
        return;
    }
    if (state.currentVoiceChannel === newChannel) return;

    const oldChannel = state.currentVoiceChannel;
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

    // Auto-unmute ao sair do AFK / Auto-mute ao entrar no AFK
    if (oldChannel === 'afk' && newChannel && newChannel !== 'afk') {
        setMicrophoneMuted(false);
        showToast('🎙️ Você saiu da sala AFK e seu microfone foi reativado!');
    } else if (newChannel === 'afk') {
        setMicrophoneMuted(true);
        showToast('💤 Você entrou na sala AFK e foi silenciado automaticamente.');
    }

    // Se estiver transmitindo tela do PC e entrar em sala de cinema, encerra a transmissão de tela na hora
    if (newChannel && newChannel.startsWith('cinema-') && state.isStreaming) {
        stopScreenShare();
        showToast('ℹ️ Sua transmissão de tela foi pausada porque salas de cinema são exclusivas para IPTV.');
    }

    // Oculta botão de transmitir tela na barra quando estiver em sala de cinema
    const btnStreamToggle = document.getElementById('btn-stream-toggle');
    if (btnStreamToggle) {
        btnStreamToggle.style.display = (newChannel && newChannel.startsWith('cinema-')) ? 'none' : 'flex';
    }

    // Verifica se a sala de cinema já possui transmissão ativa
    checkRoomCinemaStream(newChannel);

    const statusPanel = document.getElementById('voice-status-panel');
    if (statusPanel) statusPanel.style.display = 'flex';
    document.getElementById('current-voice-channel-name').textContent = `${chNames[newChannel] || newChannel} / 60 FPS RTC`;

    // Inicia microfone e aguarda stream antes de abrir conexões
    if (!state.localAudioStream && newChannel && newChannel !== 'afk') {
        await startMicrophone();
    }

    // Fecha conexões com quem não está no novo canal e inicia com quem está
    state.users.forEach(u => {
        if (u.id !== state.userId) {
            if (u.voiceChannel !== newChannel) {
                closePeerConnection(u.id);
            } else {
                // Prevenção de glare: quem tem menor id inicia a oferta WebRTC
                if (state.userId < u.id) {
                    initiatePeerConnection(u.id);
                }
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

// --- GAVETAS LATERAIS (RESPONSIVIDADE MOBILE) ---
function closeMobileDrawers() {
    const channelsSidebar = document.querySelector('.channels-sidebar');
    const membersSidebar = document.getElementById('members-sidebar');
    const backdrop = document.getElementById('mobile-sidebar-backdrop');
    if (channelsSidebar) channelsSidebar.classList.remove('mobile-open');
    if (membersSidebar) membersSidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.style.display = 'none';
}

// --- SOM DE NOTIFICAÇÃO AO ENTRAR NO SERVIDOR (SINTETIZADO WEB AUDIO API) ---
function playNotificationSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.36);
    } catch (e) {}
}

// --- BARRA LATERAL DIREITA: INTEGRANTES ONLINE E OFFLINE ---
function renderMembersSidebar() {
    const listOnline = document.getElementById('members-list-online');
    const listOffline = document.getElementById('members-list-offline');
    const onlineCount = document.getElementById('online-count');
    const offlineCount = document.getElementById('offline-count');
    if (!listOnline || !listOffline) return;

    listOnline.innerHTML = '';
    listOffline.innerHTML = '';

    const allMembers = Array.from(state.serverMembers.values());
    state.users.forEach(u => {
        if (!state.serverMembers.has(u.id)) {
            allMembers.push({
                id: u.id,
                username: u.username,
                avatar: u.avatar || '#5865F2'
            });
        }
    });

    const uniqueMap = new Map();
    allMembers.forEach(m => uniqueMap.set(m.id, m));

    let onlineTotal = 0;
    let offlineTotal = 0;

    uniqueMap.forEach(member => {
        const isOnline = state.onlineUserIds.has(member.id) || state.users.has(member.id);
        const row = document.createElement('div');
        row.className = 'member-row';
        row.setAttribute('data-user-id', member.id);
        row.style.cursor = 'pointer';
        row.oncontextmenu = (e) => openUserContextMenu(e, member.id);
        const isMe = (member.id === state.userId);
        const nameDisplay = isMe ? `${escapeHtml(member.username)} (Você)` : escapeHtml(member.username);
        const avatarLetter = (member.username || 'U')[0].toUpperCase();
        const color = member.avatar || '#5865F2';

        const vState = (state.voiceStates && state.voiceStates.get(member.id)) || (isMe ? { isMuted: state.isMuted, isDeafened: state.isDeafened, isSpeaking: false } : { isMuted: false, isDeafened: false, isSpeaking: false });
        const isMuted = !!vState.isMuted;
        const isDeafened = !!vState.isDeafened;
        const isSpeaking = !!vState.isSpeaking;

        row.innerHTML = `
            <div class="member-avatar-wrap">
                <div class="member-avatar" style="background-color: ${color};">${avatarLetter}</div>
                <div class="member-status-dot ${isOnline ? 'online' : 'offline'}"></div>
            </div>
            <div class="member-name-wrap" style="display:flex;align-items:center;">
                <span class="member-name ${isOnline ? 'online' : 'offline'}">${nameDisplay}</span>
                <span class="voice-speaking-dot${isSpeaking ? ' active' : ''}" style="margin-left:5px;"></span>
                ${isDeafened ? '<i class="fa-solid fa-ear-deaf voice-deafen-icon" title="Ensurdecido (Áudio Desativado)" style="font-size:10px;margin-left:5px;color:#f23f43;"></i>' : ''}
                ${isMuted ? '<i class="fa-solid fa-microphone-slash voice-mute-icon" title="Mutado" style="font-size:10px;margin-left:5px;color:#f23f43;"></i>' : ''}
            </div>
        `;

        if (isOnline) {
            onlineTotal++;
            listOnline.appendChild(row);
        } else {
            offlineTotal++;
            listOffline.appendChild(row);
        }
    });

    if (onlineCount) onlineCount.textContent = onlineTotal;
    if (offlineCount) offlineCount.textContent = offlineTotal;
}

// --- CADASTRO OBRIGATÓRIO DE NOVO INTEGRANTE AO ENTRAR PELO LINK ---
function checkRegistration() {
    const saved = localStorage.getItem('discord_user_profile');
    let isRegistered = false;
    if (saved) {
        try {
            const p = JSON.parse(saved);
            if (p.username && !p.username.startsWith('Jogador_')) {
                state.username = p.username;
                state.avatarColor = p.avatarColor || '#5865F2';
                state.userId = p.userId || state.userId;
                updateMyProfileUI();
                isRegistered = true;
            }
        } catch (e) {}
    }
    if (!isRegistered) {
        const regModal = document.getElementById('register-modal');
        if (regModal) {
            regModal.style.display = 'flex';
            const nameInput = document.getElementById('register-name-input');
            if (nameInput) {
                nameInput.value = '';
                setTimeout(() => nameInput.focus(), 300);
            }
        }
    }
}

function updateMyProfileUI() {
    const un = document.getElementById('my-username');
    const av = document.getElementById('my-avatar');
    if (un) un.textContent = state.username;
    if (av) {
        av.textContent = (state.username || 'U')[0].toUpperCase();
        av.style.backgroundColor = state.avatarColor || '#5865F2';
    }
}

function setupEventListeners() {
    const on = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    // 1. Troca de Canais de Voz ao Clicar & Suporte a Drag and Drop para Mover Usuários
    document.querySelectorAll('.voice-channel').forEach(el => {
        el.onclick = () => switchVoiceChannel(el.dataset.channel);

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
            const titleEl = document.getElementById('current-channel-title');
            if (titleEl) titleEl.textContent = el.dataset.channel;
            const inputEl = document.getElementById('chat-input');
            if (inputEl) inputEl.placeholder = `Conversar em #${el.dataset.channel}...`;
        };
    });

    // 3. Botões de Transmissão de Tela
    const streamModal = document.getElementById('stream-modal');
    on('btn-stream-toggle', 'click', () => {
        if (state.isStreaming) {
            stopScreenShare();
            return;
        }
        // PROIBIÇÃO: Em salas de cinema é PROIBIDO transmitir tela do PC (apenas IPTV)!
        if (state.currentVoiceChannel && state.currentVoiceChannel.startsWith('cinema-')) {
            showToast('🚫 <b>Transmissão de tela proibida no Cinema!</b><br>As salas de cinema são exclusivas para Filmes, Séries e TV via IPTV.<br>Para transmitir seu jogo ou tela, entre na sala <b>🎮 Jogos 60FPS</b> ou <b>🔊 Geral</b>.', 6000);
            return;
        }
        if (streamModal) streamModal.style.display = 'flex';
    });
    on('btn-quick-stream', 'click', () => {
        if (state.currentVoiceChannel && state.currentVoiceChannel.startsWith('cinema-')) {
            showToast('🚫 <b>Transmissão de tela proibida no Cinema!</b><br>Use a sala 🎮 Jogos 60FPS para transmitir sua tela.', 5000);
            return;
        }
        if (streamModal) streamModal.style.display = 'flex';
    });
    on('btn-close-modal', 'click', () => { if (streamModal) streamModal.style.display = 'none'; });
    on('btn-cancel-stream', 'click', () => { if (streamModal) streamModal.style.display = 'none'; });

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
    const chkAudio = document.getElementById('chk-audio');
    if (chkAudio) chkAudio.onchange = (e) => state.streamConfig.captureAudio = e.target.checked;
    const chkIsolate = document.getElementById('chk-isolate-voice');
    if (chkIsolate) chkIsolate.onchange = (e) => state.streamConfig.isolateVoice = e.target.checked;

    on('btn-confirm-stream', 'click', () => {
        if (streamModal) streamModal.style.display = 'none';
        startScreenShare();
    });

    // 4. Convidar Amigos (Abre Modal de Convite)
    on('btn-copy-invite', 'click', openInviteModal);
    on('btn-close-invite-modal', 'click', closeInviteModal);
    on('btn-copy-invite-modal', 'click', copyInviteLink);

    // 5. Chat Input
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-send-message');
    const doSend = () => {
        if (!chatInput) return;
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
    if (sendBtn) sendBtn.onclick = doSend;
    if (chatInput) chatInput.onkeydown = (e) => { if (e.key === 'Enter') doSend(); };

    // 6. Controles de Áudio e Vídeo
    const volSlider = document.getElementById('vid-volume-slider');
    const vid = document.getElementById('stage-video');
    if (volSlider && vid) {
        volSlider.oninput = (e) => {
            vid.volume = parseFloat(e.target.value);
            vid.muted = (vid.volume === 0);
        };
    }
    on('btn-vid-vol', 'click', () => {
        if (!vid) return;
        vid.muted = !vid.muted;
        if (volSlider) volSlider.value = vid.muted ? 0 : 1;
    });
    on('btn-vid-fullscreen', 'click', () => {
        if (vid && vid.requestFullscreen) vid.requestFullscreen();
    });

    // Play/Pause do Vídeo - APENAS O DONO PODE PAUSAR
    on('btn-vid-play', 'click', () => {
        if (!vid) return;
        const currentRoom = state.currentVoiceChannel;
        const cinema = (currentRoom && state.cinemaRooms) ? state.cinemaRooms[currentRoom] : null;
        const isOwner = cinema && (cinema.startedById === state.userId);

        if (!isOwner) {
            showToast('🔒 Apenas quem iniciou o filme pode pausar ou mexer no tempo.');
            return;
        }

        const btnPlay = document.getElementById('btn-vid-play');
        if (vid.paused) {
            vid.play().then(() => {
                if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
            }).catch(() => {});
        } else {
            vid.pause();
            if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
    });

    on('btn-big-play', 'click', () => {
        if (!vid) return;
        vid.muted = false;
        vid.play().then(() => {
            const overlay = document.getElementById('video-play-overlay');
            if (overlay) overlay.style.display = 'none';
            const btnPlay = document.getElementById('btn-vid-play');
            if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
        }).catch(e => console.error(e));
    });

    if (vid) {
        vid.onclick = () => {
            if (vid.muted) {
                vid.muted = false;
                showToast('🔊 Áudio ativado!');
                const overlay = document.getElementById('video-play-overlay');
                if (overlay) overlay.style.display = 'none';
            }
        };
    }

    // 7. Mute e Deafen (Padrão Discord: Ensurdecer muta o microfone junto)
    on('btn-mic', 'click', () => {
        if (state.currentVoiceChannel === 'afk') {
            showToast('💤 Você está na sala AFK e não pode falar aqui. Mude para outro canal para ativar o microfone!');
            return;
        }
        // Se estiver ensurdecido e clicar para desmutar o microfone, desativa também o ensurdecido
        if (state.isDeafened && state.isMuted) {
            state.isDeafened = false;
            const deafenBtn = document.getElementById('btn-deafen');
            if (deafenBtn) deafenBtn.classList.remove('active');
            state.remoteAudioElements.forEach(a => a.muted = false);
            const vid = document.getElementById('main-cinema-video');
            if (vid) vid.muted = false;
        }
        setMicrophoneMuted(!state.isMuted);
        showToast(state.isMuted ? '🔇 Microfone silenciado.' : '🎙️ Microfone ativado.');
    });

    on('btn-deafen', 'click', () => {
        state.isDeafened = !state.isDeafened;
        const deafenBtn = document.getElementById('btn-deafen');
        if (deafenBtn) deafenBtn.classList.toggle('active', state.isDeafened);

        // Ao ensurdecer, SEMPRE muta o microfone junto automaticamente!
        if (state.isDeafened) {
            setMicrophoneMuted(true);
        } else {
            // Ao desativar o ensurdecido, desmuta o microfone se não estiver em AFK
            if (state.currentVoiceChannel !== 'afk') {
                setMicrophoneMuted(false);
            }
        }

        // Silencia / reativa áudio dos outros participantes
        state.remoteAudioElements.forEach(a => a.muted = state.isDeafened);
        const vid = document.getElementById('main-cinema-video');
        if (vid) vid.muted = state.isDeafened;

        updateVoiceUserStateUI(state.userId, state.isMuted, state.isDeafened, false);

        // Transmite o estado completo de ensurdecido e mutado
        sendWs({
            type: 'voice_state',
            isMuted: state.isMuted,
            isDeafened: state.isDeafened,
            isSpeaking: false
        });

        showToast(state.isDeafened ? '🎧 Ensurdecido (microfone e áudio desligados).' : '🔊 Áudio e microfone reativados.');
    });

    // 8. Menu de Contexto
    const ctxVolSlider = document.getElementById('ctx-volume-slider');
    if (ctxVolSlider) {
        ctxVolSlider.oninput = (e) => {
            const val = parseInt(e.target.value);
            const valEl = document.getElementById('ctx-vol-val');
            if (valEl) valEl.textContent = `${val}%`;
            if (state.activeContextUserId) {
                state.userVolumes.set(state.activeContextUserId, val);
                applyUserVolume(state.activeContextUserId);
                const obj = {};
                state.userVolumes.forEach((v, k) => obj[k] = v);
                localStorage.setItem('dc_user_volumes', JSON.stringify(obj));
            }
        };
    }

    on('ctx-btn-mute', 'click', () => {
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
    });

    on('ctx-btn-mention', 'click', () => {
        if (!state.activeContextUserId) return;
        const user = state.users.get(state.activeContextUserId);
        const name = user ? user.username : 'Amigo';
        if (chatInput) {
            chatInput.value += `@${name} `;
            chatInput.focus();
        }
        closeUserContextMenu();
    });

    on('ctx-btn-watch-stream', 'click', () => {
        if (state.activeContextUserId) {
            selectLiveStream(state.activeContextUserId);
        }
        closeUserContextMenu();
    });

    on('ctx-btn-copy-id', 'click', () => {
        if (state.activeContextUserId) {
            navigator.clipboard.writeText(state.activeContextUserId);
            showToast('📋 ID copiado para a Área de Transferência.');
        }
        closeUserContextMenu();
    });

    document.querySelectorAll('#ctx-submenu-channels .ctx-submenu-item').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            if (state.activeContextUserId) {
                moveUserToChannel(state.activeContextUserId, item.dataset.channel);
            }
            closeUserContextMenu();
        };
    });

    on('ctx-btn-disconnect-voice', 'click', () => {
        if (state.activeContextUserId) {
            moveUserToChannel(state.activeContextUserId, 'afk');
        }
        closeUserContextMenu();
    });

    window.addEventListener('click', (e) => {
        const menu = document.getElementById('user-context-menu');
        if (menu && !menu.contains(e.target)) closeUserContextMenu();
    });

    // 9. Configurações de Perfil
    const openProfile = () => openUserSettingsModal('profile');
    on('btn-settings', 'click', openProfile);
    on('user-footer-avatar-wrap', 'click', openProfile);
    on('user-footer-info', 'click', openProfile);
    on('btn-open-settings-rail', 'click', openProfile);
    on('btn-close-settings', 'click', closeUserSettingsModal);

    document.querySelectorAll('.settings-tab').forEach(t => {
        t.onclick = () => switchSettingsTab(t.dataset.tab);
    });

    const inputUser = document.getElementById('input-username');
    if (inputUser) inputUser.oninput = updateSettingsPreview;

    document.querySelectorAll('.color-dot').forEach(dot => {
        dot.onclick = () => {
            document.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            state.avatarColor = dot.dataset.color;
            updateSettingsPreview();
        };
    });

    on('btn-save-profile', 'click', saveUserProfile);
    on('btn-toggle-mic-test', 'click', toggleMicTest);

    on('select-audio-input', 'change', (e) => {
        if (state.localAudioStream) {
            state.localAudioStream.getTracks().forEach(t => t.stop());
        }
        startMicrophone(e.target.value);
    });

    on('select-audio-output', 'change', async (e) => {
        const deviceId = e.target.value;
        if (deviceId && 'setSinkId' in HTMLMediaElement.prototype) {
            state.remoteAudioElements.forEach(async el => {
                try { await el.setSinkId(deviceId); } catch (err) {}
            });
            if (vid) {
                try { await vid.setSinkId(deviceId); } catch (err) {}
            }
            showToast('Dispositivo de saída atualizado.');
        }
    });

    on('btn-disconnect-voice', 'click', () => leaveVoiceChannel());
    on('btn-open-iptv', 'click', openIptvModal);
    on('btn-close-iptv-modal', 'click', closeIptvModal);
    on('btn-stop-cinema', 'click', stopCinemaStream);

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


    // Event Listeners do Dono do Servidor 👑
    on('btn-owner-badge', 'click', openOwnerModal);
    on('btn-close-owner-panel', 'click', closeOwnerModal);

    on('btn-submit-owner-auth', 'click', () => {
        const pass = document.getElementById('input-owner-pass')?.value || '';
        adminAuth(pass);
    });

    on('btn-owner-kill-all-streams', 'click', () => {
        if (confirm('👑 Deseja realmente desligar todas as transmissões de tela ativas/travadas no servidor?')) {
            sendWs({ type: 'admin_stop_stream', targetUserId: 'all' });
            showToast('👑 Desligando todas as transmissões de tela...');
            closeOwnerModal();
        }
    });

    on('btn-owner-open-create-channel', 'click', () => {
        closeOwnerModal();
        const m = document.getElementById('modal-create-channel');
        if (m) m.style.display = 'flex';
    });

    on('btn-add-text-channel', 'click', () => {
        const m = document.getElementById('modal-create-channel');
        if (m) {
            m.style.display = 'flex';
            const radioText = document.querySelector('input[name="create-channel-type"][value="text"]');
            if (radioText) radioText.checked = true;
        }
    });

    on('btn-add-voice-channel', 'click', () => {
        const m = document.getElementById('modal-create-channel');
        if (m) {
            m.style.display = 'flex';
            const radioVoice = document.querySelector('input[name="create-channel-type"][value="voice"]');
            if (radioVoice) radioVoice.checked = true;
        }
    });

    on('btn-close-create-channel', 'click', () => {
        const m = document.getElementById('modal-create-channel');
        if (m) m.style.display = 'none';
    });
    on('btn-cancel-create-channel', 'click', () => {
        const m = document.getElementById('modal-create-channel');
        if (m) m.style.display = 'none';
    });

    on('btn-submit-create-channel', 'click', () => {
        const inputName = document.getElementById('input-create-channel-name');
        const name = inputName ? inputName.value.trim() : '';
        if (!name) {
            alert('Por favor, digite o nome do canal!');
            return;
        }
        const chType = document.querySelector('input[name="create-channel-type"]:checked')?.value || 'voice';
        adminCreateChannel(name, chType);
        if (inputName) inputName.value = '';
        const m = document.getElementById('modal-create-channel');
        if (m) m.style.display = 'none';
    });

    // Ações de Admin no Menu de Contexto
    on('ctx-btn-force-stop-stream', 'click', () => {
        if (state.activeContextUserId) {
            adminStopStream(state.activeContextUserId);
        }
        closeUserContextMenu();
    });

    on('ctx-btn-force-disconnect-voice', 'click', () => {
        if (state.activeContextUserId) {
            adminDisconnectVoice(state.activeContextUserId);
        }
        closeUserContextMenu();
    });

    on('ctx-btn-kick-user', 'click', () => {
        if (state.activeContextUserId) {
            const u = state.users.get(state.activeContextUserId) || state.serverMembers.get(state.activeContextUserId);
            const name = u ? u.username : 'o usuário';
            if (confirm(`👑 Deseja expulsar ${name} do servidor?`)) {
                adminKickUser(state.activeContextUserId);
            }
        }
        closeUserContextMenu();
    });

    on('ctx-btn-ban-user', 'click', () => {
        if (state.activeContextUserId) {
            const u = state.users.get(state.activeContextUserId) || state.serverMembers.get(state.activeContextUserId);
            const name = u ? u.username : 'o usuário';
            if (confirm(`🔨 ATENÇÃO: Deseja realmente BANIR permanentemente ${name} deste servidor?`)) {
                adminBanUser(state.activeContextUserId, name);
            }
        }
        closeUserContextMenu();
    });

    const btnSubmitBan = document.getElementById('btn-submit-ban-user');
    const inputBanUser = document.getElementById('input-ban-user-name');
    if (btnSubmitBan && inputBanUser) {
        btnSubmitBan.onclick = () => {
            const val = inputBanUser.value.trim();
            if (!val) {
                alert('Digite o apelido ou ID do usuário a ser banido.');
                return;
            }
            if (confirm(`🔨 Deseja realmente BANIR permanentemente "${val}" do servidor?`)) {
                let targetId = null;
                for (const m of (state.serverMembers?.values() || [])) {
                    if (m.username && m.username.toLowerCase() === val.toLowerCase()) {
                        targetId = m.id;
                        break;
                    }
                }
                if (!targetId) {
                    for (const u of (state.users?.values() || [])) {
                        if (u.username && u.username.toLowerCase() === val.toLowerCase()) {
                            targetId = u.id;
                            break;
                        }
                    }
                }
                adminBanUser(targetId || val, val);
                inputBanUser.value = '';
            }
        };
        inputBanUser.onkeydown = (e) => {
            if (e.key === 'Enter') btnSubmitBan.click();
        };
    }

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeUserSettingsModal();
            closeUserContextMenu();
            closeIptvModal();
            closeInviteModal();
            if (streamModal) streamModal.style.display = 'none';
        }
    });

    // 10. Gavetas do Menu Mobile
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnToggleMembers = document.getElementById('btn-toggle-members');
    const mobileBackdrop = document.getElementById('mobile-sidebar-backdrop');
    const channelsSidebar = document.querySelector('.channels-sidebar');
    const membersSidebar = document.getElementById('members-sidebar');

    if (btnToggleSidebar) {
        btnToggleSidebar.onclick = (e) => {
            e.stopPropagation();
            const isOpen = channelsSidebar && channelsSidebar.classList.contains('mobile-open');
            closeMobileDrawers();
            if (!isOpen && channelsSidebar) {
                channelsSidebar.classList.add('mobile-open');
                if (mobileBackdrop) mobileBackdrop.style.display = 'block';
            }
        };
    }

    if (btnToggleMembers) {
        btnToggleMembers.onclick = (e) => {
            e.stopPropagation();
            const isOpen = membersSidebar && membersSidebar.classList.contains('mobile-open');
            closeMobileDrawers();
            if (!isOpen && membersSidebar) {
                membersSidebar.classList.add('mobile-open');
                if (mobileBackdrop) mobileBackdrop.style.display = 'block';
            }
        };
    }

    if (mobileBackdrop) {
        mobileBackdrop.onclick = closeMobileDrawers;
    }

    // 11. Cadastro de Novo Integrante
    const registerColorDots = document.querySelectorAll('#register-color-options .color-dot');
    registerColorDots.forEach(dot => {
        dot.onclick = () => {
            registerColorDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            state.avatarColor = dot.dataset.color || '#5865F2';
        };
    });

    const btnRegisterSubmit = document.getElementById('btn-register-submit');
    const regInput = document.getElementById('register-name-input');
    const submitRegistration = () => {
        const name = regInput ? regInput.value.trim() : '';
        if (!name) {
            alert('Por favor, digite seu nome ou apelido para entrar na comunidade!');
            if (regInput) regInput.focus();
            return;
        }
        state.username = name;
        localStorage.setItem('discord_user_profile', JSON.stringify({
            userId: state.userId,
            username: state.username,
            avatarColor: state.avatarColor
        }));
        updateMyProfileUI();
        const regModal = document.getElementById('register-modal');
        if (regModal) regModal.style.display = 'none';

        sendWs({
            type: 'update_profile',
            username: state.username,
            avatar: state.avatarColor
        });
        showToast(`🎉 Bem-vindo(a), <b>${escapeHtml(state.username)}</b>!`);
    };

    if (btnRegisterSubmit) btnRegisterSubmit.onclick = submitRegistration;
    if (regInput) {
        regInput.onkeydown = (e) => {
            if (e.key === 'Enter') submitRegistration();
        };
    }

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

function stopCinemaPlayback() {
    state.currentCinemaStreamId = null;
    if (state.mpegtsInstance) {
        try {
            state.mpegtsInstance.pause();
            state.mpegtsInstance.unload();
            state.mpegtsInstance.detachMediaElement();
            state.mpegtsInstance.destroy();
        } catch (e) {}
        state.mpegtsInstance = null;
    }
    if (state.hlsInstance) {
        try {
            state.hlsInstance.destroy();
        } catch (e) {}
        state.hlsInstance = null;
    }
    if (cinemaSyncInterval) {
        clearInterval(cinemaSyncInterval);
        cinemaSyncInterval = null;
    }
    const stage = document.getElementById('video-stage');
    const video = document.getElementById('stage-video');
    if (video) {
        try { video.pause(); } catch(e) {}
        video.onpause = null;
        video.onplay = null;
        video.onseeked = null;
        video.srcObject = null;
        video.src = '';
    }
    const overlay = document.getElementById('video-play-overlay');
    if (overlay) overlay.style.display = 'none';
    const stopBtn = document.getElementById('btn-stop-cinema');
    if (stopBtn) stopBtn.style.display = 'none';
    if (stage && !state.currentlyWatchingUserId) {
        stage.style.display = 'none';
    }
}

function checkRoomCinemaStream(room) {
    if (!room || !room.startsWith('cinema-')) {
        stopCinemaPlayback();
        return;
    }

    const cinema = state.cinemaRooms ? state.cinemaRooms[room] : null;
    if (cinema) {
        playCinemaStream(cinema);
    } else {
        stopCinemaPlayback();
    }
}

let cinemaSyncInterval = null;


function startVideoPlayback(video) {
    const playOverlay = document.getElementById('video-play-overlay');
    const playBtn = document.getElementById('btn-vid-play');
    
    // Tenta reproduzir normalmente
    const playPromise = video.play();
    if (playPromise !== undefined) {
        playPromise.then(() => {
            if (playOverlay) playOverlay.style.display = 'none';
            if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        }).catch(err => {
            console.warn('Autoplay com áudio bloqueado pelo navegador:', err);
            // Tenta reproduzir mudo no mobile para contornar a política de autoplay
            video.muted = true;
            video.play().then(() => {
                if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
                showToast('🔇 Vídeo iniciado. Toque no vídeo para ativar o áudio!', 5000);
                if (playOverlay) playOverlay.style.display = 'flex';
                const bigSpan = document.querySelector('#btn-big-play span');
                if (bigSpan) bigSpan.textContent = 'Toque para Ativar o Áudio';
            }).catch(() => {
                if (playOverlay) playOverlay.style.display = 'flex';
                if (playBtn) playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            });
        });
    }
}


function loadHlsFallback(m3u8Url, video) {
    if (window.Hls && Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(m3u8Url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => startVideoPlayback(video));
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad();
                else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError();
                else hls.destroy();
            }
        });
        state.hlsInstance = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = m3u8Url;
        startVideoPlayback(video);
    }
}

function playCinemaStream(cinema) {
    const stage = document.getElementById('video-stage');
    const video = document.getElementById('stage-video');
    if (!stage || !video || !cinema) return;

    stage.style.display = 'flex';

    const isOwner = (cinema.startedById === state.userId);
    const stopBtn = document.getElementById('btn-stop-cinema');

    if (isOwner) {
        document.getElementById('hud-streamer-name').innerHTML = `🎬 Cinema: <b>${escapeHtml(cinema.streamName)}</b> <span style="color:#23a55a;">(👑 Você é o Dono)</span>`;
        if (stopBtn) stopBtn.style.display = 'flex';
    } else {
        document.getElementById('hud-streamer-name').innerHTML = `🎬 Cinema: <b>${escapeHtml(cinema.streamName)}</b> • 👑 Dono: <b>${escapeHtml(cinema.startedBy || 'Amigo')}</b>`;
        if (stopBtn) stopBtn.style.display = 'none';
    }
    document.getElementById('hud-res').textContent = '1080p FHD';
    document.getElementById('hud-fps').textContent = '60 FPS';

    const btnPlay = document.getElementById('btn-vid-play');
    if (btnPlay) {
        btnPlay.style.display = isOwner ? 'flex' : 'none';
    }
    const lockBadge = document.getElementById('hud-sync-lock-badge');
    if (lockBadge) {
        lockBadge.style.display = isOwner ? 'none' : 'inline-flex';
    }

    // Se já estiver tocando EXATAMENTE este mesmo stream, apenas atualiza sync sem destruir o player
    if (state.currentCinemaStreamId === cinema.streamId && (state.mpegtsInstance || state.hlsInstance || (video.src && video.src.length > 0))) {
        if (!isOwner) {
            applyCinemaSync(cinema);
        }
        return;
    }

    state.currentCinemaStreamId = cinema.streamId;
    video.srcObject = null;

    if (state.mpegtsInstance) {
        try {
            state.mpegtsInstance.pause();
            state.mpegtsInstance.unload();
            state.mpegtsInstance.detachMediaElement();
            state.mpegtsInstance.destroy();
        } catch (e) {}
        state.mpegtsInstance = null;
    }
    if (state.hlsInstance) {
        try { state.hlsInstance.destroy(); } catch (e) {}
        state.hlsInstance = null;
    }
    if (cinemaSyncInterval) {
        clearInterval(cinemaSyncInterval);
        cinemaSyncInterval = null;
    }

    const seekToPosition = () => {
        if (cinema.currentTime && cinema.currentTime > 0) {
            try { video.currentTime = cinema.currentTime; } catch (e) {}
        }
    };

    if (cinema.streamType === 'live') {
        const tsUrl = `${window.location.origin}/api/iptv/stream/${cinema.streamId}.ts`;
        const m3u8Url = `${window.location.origin}/api/iptv/live/${cinema.streamId}.m3u8`;

        if (window.mpegts && mpegts.getFeatureList().mseLivePlayback) {
            try {
                const player = mpegts.createPlayer({
                    type: 'mse',
                    isLive: true,
                    url: tsUrl
                }, {
                    enableWorker: false, // Executa diretamente no thread principal via MSE, eliminando falhas de worker blob
                    lazyLoad: false,
                    liveBufferLatencyChasing: true,
                    autoCleanupSourceBuffer: true
                });
                player.attachMediaElement(video);
                player.load();
                startVideoPlayback(video);
                state.mpegtsInstance = player;
            } catch (err) {
                console.warn('Erro ao inicializar mpegts, fallback para HLS:', err);
                loadHlsFallback(m3u8Url, video);
            }
        } else {
            loadHlsFallback(m3u8Url, video);
        }
    } else {
        const vodType = cinema.streamType === 'series' ? 'series' : 'movie';
        const vodUrl = `/api/iptv/vod/${cinema.streamId}?ext=${cinema.ext || 'mp4'}&type=${vodType}`;
        video.src = vodUrl;
        video.onloadedmetadata = () => {
            seekToPosition();
            if (cinema.isPlaying !== false) video.play().catch(() => {});
        };
        video.onerror = (e) => {
            console.warn('Erro ao carregar vídeo VOD/Série:', e);
            showToast('⚠️ Erro ao reproduzir este vídeo. O arquivo pode estar indisponível.');
        };
    }

    // Configuração de Controle: APENAS o dono pode pausar/mexer na barra do filme
    if (isOwner) {
        video.style.pointerEvents = 'auto';
        const sendSync = () => {
            if (state.currentVoiceChannel && state.currentVoiceChannel.startsWith('cinema-')) {
                sendWs({
                    type: 'cinema_sync',
                    room: state.currentVoiceChannel,
                    currentTime: video.currentTime,
                    isPlaying: !video.paused
                });
            }
        };

        video.onpause = sendSync;
        video.onplay = sendSync;
        video.onseeked = sendSync;
        cinemaSyncInterval = setInterval(sendSync, 4000);
    } else {
        // Convidado: controles bloqueados para não pausar para o dono
        video.style.pointerEvents = 'none';
        video.onpause = null;
        video.onplay = null;
        video.onseeked = null;
    }
}

function applyCinemaSync(data) {
    const video = document.getElementById('stage-video');
    if (!video || !data) return;

    const cinema = state.cinemaRooms ? state.cinemaRooms[data.room] : null;
    if (cinema && cinema.startedById === state.userId) return; // O Dono nunca é sobrescrito

    // Sincroniza o minuto/segundo exato com tolerância máxima de 0.9s
    if (data.currentTime !== undefined && cinema && cinema.streamType !== 'live') {
        const diff = Math.abs(video.currentTime - data.currentTime);
        if (diff > 0.9) {
            try { video.currentTime = data.currentTime; } catch(e) {}
        }
    }

    // Sincroniza o Play / Pause instantaneamente com o Dono
    if (data.isPlaying && video.paused) {
        startVideoPlayback(video);
    } else if (!data.isPlaying && !video.paused) {
        video.pause();
    }
}

function stopCinemaStream() {
    const room = state.currentVoiceChannel;
    if (!room || !room.startsWith('cinema-')) {
        showToast('Entre em uma das salas de cinema para parar a transmissão.');
        return;
    }
    stopCinemaPlayback();
    if (state.cinemaRooms) state.cinemaRooms[room] = null;
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
        grid.innerHTML = '<div class="iptv-placeholder">Nenhum item encontrado nesta categoria.</div>';
        return;
    }

    const isSeries = (state.currentIptvType === 'series');

    streams.forEach(stream => {
        const card = document.createElement('div');
        const isMovie = (state.currentIptvType === 'vod' || state.currentIptvType === 'series');
        card.className = `iptv-stream-card ${isMovie ? 'is-movie' : 'type-live'}`;
        const iconUrl = stream.cover || stream.stream_icon || '';
        const title = stream.name || 'Sem Título';
        const btnText = isSeries ? '<i class="fa-solid fa-list-ul"></i> Ver Episódios' : '<i class="fa-solid fa-play"></i> Assistir na Sala';

        card.innerHTML = `
            ${iconUrl ? `<img src="${escapeHtml(iconUrl)}" class="iptv-stream-logo" onerror="this.onerror=null;this.replaceWith(createFallbackIcon())">` : '<div class="iptv-stream-logo"><i class="fa-solid fa-tv"></i></div>'}
            <div class="iptv-stream-title" title="${escapeHtml(title)}">${escapeHtml(title)}</div>
            <button class="iptv-stream-btn">${btnText}</button>
        `;

        card.onclick = () => {
            if (isSeries) {
                openSeriesEpisodes(stream);
            } else {
                const targetRoom = document.getElementById('iptv-select-target-room').value;
                const cinemaObj = {
                    streamId: stream.stream_id,
                    streamName: title,
                    streamType: state.currentIptvType,
                    ext: stream.container_extension || 'mp4',
                    poster: iconUrl,
                    startedBy: state.username,
                    startedById: state.userId,
                    currentTime: 0,
                    isPlaying: true
                };

                // Atualiza localmente imediatamente sem esperar round-trip
                if (!state.cinemaRooms) state.cinemaRooms = {};
                state.cinemaRooms[targetRoom] = cinemaObj;

                sendWs({
                    type: 'cinema_play',
                    room: targetRoom,
                    streamId: stream.stream_id,
                    streamName: title,
                    streamType: state.currentIptvType,
                    ext: stream.container_extension || 'mp4',
                    poster: iconUrl
                });
                closeIptvModal();

                // Conecta na sala e toca imediatamente
                switchVoiceChannel(targetRoom);
                playCinemaStream(cinemaObj);
                showToast(`🎬 Transmissão iniciada em <b>${targetRoom}</b>: <b>${escapeHtml(title)}</b>`);
            }
        };
        grid.appendChild(card);
    });
}

// Visualizador de Episódios de Séries
async function openSeriesEpisodes(series) {
    const grid = document.getElementById('iptv-streams-grid');
    const seriesId = series.series_id || series.stream_id;
    const seriesName = series.name || 'Série';
    
    grid.innerHTML = `<div class="iptv-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando temporadas de <b>${escapeHtml(seriesName)}</b>...</div>`;
    document.getElementById('iptv-current-category-name').innerHTML = `
        <button id="btn-back-to-series" style="background:#5865F2;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer;margin-right:8px;font-size:12px;">
            <i class="fa-solid fa-arrow-left"></i> Voltar às Séries
        </button>
        ${escapeHtml(seriesName)}
    `;

    const btnBackSeries = document.getElementById('btn-back-to-series');
    if (btnBackSeries) {
        btnBackSeries.onclick = () => {
            loadIptvStreams(state.currentIptvType, state.currentIptvCategory);
        };
    }

    try {
        const res = await fetch(`/api/iptv/series_info?series_id=${seriesId}`);
        const data = await res.json();
        const episodes = data.episodes || {};
        const seasons = Object.keys(episodes);

        if (seasons.length === 0) {
            grid.innerHTML = '<div class="iptv-placeholder">Nenhum episódio encontrado para esta série.</div>';
            return;
        }

        grid.innerHTML = '';
        seasons.forEach(sNum => {
            const seasonTitle = document.createElement('div');
            seasonTitle.style.gridColumn = '1 / -1';
            seasonTitle.style.color = '#5865F2';
            seasonTitle.style.fontWeight = '700';
            seasonTitle.style.fontSize = '14px';
            seasonTitle.style.padding = '8px 0 4px 0';
            seasonTitle.style.borderBottom = '1px solid #3f4147';
            seasonTitle.innerHTML = `<i class="fa-solid fa-folder-open"></i> Temporada ${sNum}`;
            grid.appendChild(seasonTitle);

            const epList = episodes[sNum] || [];
            epList.forEach(ep => {
                const epCard = document.createElement('div');
                epCard.className = 'iptv-stream-card';
                const epTitle = ep.title || `Episódio ${ep.episode_num}`;
                const icon = ep.info?.movie_image || series.cover || '';
                epCard.innerHTML = `
                    ${icon ? `<img src="${escapeHtml(icon)}" class="iptv-stream-logo" onerror="this.onerror=null;this.replaceWith(createFallbackIcon())">` : '<div class="iptv-stream-logo"><i class="fa-solid fa-film"></i></div>'}
                    <div class="iptv-stream-title" title="${escapeHtml(epTitle)}">${escapeHtml(epTitle)}</div>
                    <button class="iptv-stream-btn"><i class="fa-solid fa-play"></i> Assistir</button>
                `;
                epCard.onclick = () => {
                    const targetRoom = document.getElementById('iptv-select-target-room').value;
                    const fullEpName = `${seriesName} • T${sNum} ${epTitle}`;
                    const cinemaObj = {
                        streamId: ep.id,
                        streamName: fullEpName,
                        streamType: 'series',
                        ext: ep.container_extension || 'mp4',
                        poster: icon,
                        startedBy: state.username,
                        startedById: state.userId,
                        currentTime: 0,
                        isPlaying: true
                    };

                    if (!state.cinemaRooms) state.cinemaRooms = {};
                    state.cinemaRooms[targetRoom] = cinemaObj;

                    sendWs({
                        type: 'cinema_play',
                        room: targetRoom,
                        streamId: ep.id,
                        streamName: fullEpName,
                        streamType: 'series',
                        ext: ep.container_extension || 'mp4',
                        poster: icon
                    });
                    closeIptvModal();

                    switchVoiceChannel(targetRoom);
                    playCinemaStream(cinemaObj);
                    showToast(`🍿 Iniciado em <b>${targetRoom}</b>: <b>${escapeHtml(fullEpName)}</b>`);
                };
                grid.appendChild(epCard);
            });
        });
    } catch (e) {
        grid.innerHTML = '<div class="iptv-placeholder">Erro ao carregar episódios da série.</div>';
    }
}

function createFallbackIcon() {
    const el = document.createElement('div');
    el.className = 'iptv-stream-logo';
    el.innerHTML = '<i class="fa-solid fa-tv"></i>';
    return el;
}

// Inicialização ao carregar a página
window.addEventListener('DOMContentLoaded', () => {
    try {
        const unEl = document.getElementById('my-username');
        if (unEl) unEl.textContent = state.username;
        const tagEl = document.getElementById('my-tag');
        if (tagEl) tagEl.textContent = state.userTag;
        const av = document.getElementById('my-avatar');
        if (av && state.username) {
            av.textContent = state.username[0].toUpperCase();
            av.style.backgroundColor = state.avatarColor;
        }
    } catch (e) {}

    try {
        setupEventListeners();
        renderChannels();
    } catch (e) {
        console.error('Erro em setupEventListeners:', e);
    }

    try {
        checkRegistration();
    } catch (e) {
        console.error('Erro em checkRegistration:', e);
    }

    try {
        initWebSocket();
    } catch (e) {
        console.error('Erro em initWebSocket:', e);
    }

    // No celular: abre os canais automaticamente ao entrar para que a lista de salas fique visível!
    if (window.innerWidth <= 850 && !state.currentVoiceChannel) {
        setTimeout(() => {
            const channelsSidebar = document.querySelector('.channels-sidebar');
            const mobileBackdrop = document.getElementById('mobile-sidebar-backdrop');
            if (channelsSidebar) {
                channelsSidebar.classList.add('mobile-open');
                if (mobileBackdrop) mobileBackdrop.style.display = 'block';
            }
        }, 200);
    }

    fetch('/api/tunnel-url')
        .then(r => r.json())
        .then(d => {
            if (d.publicUrl) state.publicTunnelUrl = d.publicUrl;
        })
        .catch(() => {});
});
