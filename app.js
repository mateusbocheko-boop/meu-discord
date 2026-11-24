document.title = 'VOX';
// Reset owner privileges from local storage
try { localStorage.removeItem('discord_is_owner'); } catch (e) {}


// ==========================================================================
// SISTEMA DO DONO DO SERVIDOR (OWNER POWERS) 👑
// ==========================================================================

function getUserAvatarUrl(userId, fallbackObj = null) {
    if (userId === state.userId && state.avatarUrl) return state.avatarUrl;
    const u = state.users ? state.users.get(userId) : null;
    if (u && u.avatarUrl) return u.avatarUrl;
    const m = state.serverMembers ? state.serverMembers.get(userId) : null;
    if (m && m.avatarUrl) return m.avatarUrl;
    if (fallbackObj && fallbackObj.avatarUrl) return fallbackObj.avatarUrl;
    return '';
}

function renderAvatarInnerHtml(name, avatarUrl) {
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('data:image/')) {
        return `<img src="${avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
    }
    return ((name || 'U')[0] || 'U').toUpperCase();
}

function applyAvatarToElement(el, name, color, avatarUrl) {
    if (!el) return;
    el.style.backgroundColor = color || '#5865F2';
    el.style.overflow = 'hidden';
    if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('data:image/')) {
        el.innerHTML = `<img src="${avatarUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
    } else {
        el.textContent = ((name || 'U')[0] || 'U').toUpperCase();
    }
}

function getVipBadgeHtml(userId, fallbackData = null) {
    const sVip = state.vips ? state.vips.get(userId) : null;
    const isVip = !!(sVip?.isVip || fallbackData?.isVip);
    if (!isVip) return '';

    const isTrial = !!(sVip?.isTrial || fallbackData?.isTrial);
    const hideBadge = !!(sVip?.hideBadge);
    if (isTrial && hideBadge) return ''; // Trial 15D sem selo visível

    const isLifetime = !!(sVip?.isLifetime || fallbackData?.isLifetime);
    if (isLifetime) {
        return `<span class="badge-vip badge-vip-diamond" title="VIP Diamante (Vitalício)" style="background:linear-gradient(135deg,#38bdf8,#818cf8);color:#04101f;font-size:9.5px;font-weight:900;padding:2px 6px;border-radius:4px;margin-left:5px;display:inline-flex;align-items:center;gap:3px;box-shadow:0 0 8px rgba(56,189,248,0.55);"><i class="fa-solid fa-gem" style="font-size:9px;color:#04101f;"></i> DIAMANTE</span>`;
    }

    let days = (sVip && typeof sVip.durationDays === 'number') ? sVip.durationDays : null;
    if (days === null) {
        const exp = sVip?.expiresAt || fallbackData?.expiresAt;
        if (exp) {
            days = Math.max(0, Math.ceil((exp - (Date.now() / 1000)) / 86400));
        } else {
            days = 30;
        }
    }

    if (days >= 60) {
        return `<span class="badge-vip badge-vip-gold" title="VIP Ouro (${days} dias)" style="background:linear-gradient(135deg,#ffd700,#f59e0b);color:#1a1000;font-size:9.5px;font-weight:900;padding:2px 6px;border-radius:4px;margin-left:5px;display:inline-flex;align-items:center;gap:3px;box-shadow:0 0 8px rgba(255,215,0,0.5);"><i class="fa-solid fa-crown" style="font-size:9px;color:#1a1000;"></i> OURO</span>`;
    }
    if (days >= 30) {
        return `<span class="badge-vip badge-vip-silver" title="VIP Prata (${days} dias)" style="background:linear-gradient(135deg,#f1f5f9,#94a3b8);color:#0f172a;font-size:9.5px;font-weight:900;padding:2px 6px;border-radius:4px;margin-left:5px;display:inline-flex;align-items:center;gap:3px;box-shadow:0 0 8px rgba(203,213,225,0.45);"><i class="fa-solid fa-crown" style="font-size:9px;color:#0f172a;"></i> PRATA</span>`;
    }
    return `<span class="badge-vip badge-vip-bronze" title="VIP Bronze (${days} dias)" style="background:linear-gradient(135deg,#e09145,#9a5018);color:#ffffff;font-size:9.5px;font-weight:900;padding:2px 6px;border-radius:4px;margin-left:5px;display:inline-flex;align-items:center;gap:3px;box-shadow:0 0 6px rgba(205,127,50,0.5);"><i class="fa-solid fa-crown" style="font-size:9px;color:#ffffff;"></i> BRONZE</span>`;
}

function isUserAllowedOwner() {
    if (state.isOwner) return true;
    const myName = (state.username || '').trim().toLowerCase();
    const myTag = (state.userTag || '').trim().toLowerCase();
    const allowed = myName === 'dim' || myName.startsWith('dim') || myTag.includes('4095');
    if (allowed) state.isOwner = true;
    return allowed;
}

function hasCurrentServerOwnerPowers() {
    if (state.currentServerId && state.currentServerId !== 'default') {
        return !!state.isCurrentServerOwner;
    }
    return isUserAllowedOwner();
}

function updateOwnerUI() {
    const badge = document.getElementById('btn-owner-badge');
    const label = document.getElementById('owner-badge-label');
    const authBox = document.getElementById('owner-auth-box');
    const powersBox = document.getElementById('owner-powers-box');
    
    const isCustomSrv = state.currentServerId && state.currentServerId !== 'default';
    const canManageServer = hasCurrentServerOwnerPowers();
    if (badge) {
        if (!canManageServer) {
            badge.style.display = 'none';
        } else {
            badge.style.display = 'flex';
            badge.style.background = 'linear-gradient(135deg, #f1c40f, #e67e22)';
            badge.style.color = '#000';
            if (label) label.textContent = isCustomSrv ? 'Dono da Sala 👑' : 'Dono Ativo 👑';
        }
    }

    if (authBox && powersBox) {
        authBox.style.display = canManageServer ? 'none' : 'block';
        powersBox.style.display = canManageServer ? 'block' : 'none';
    }

    // Atualiza botões de adicionar canal (dono do servidor atual pode criar/excluir canais)
    const addTextBtn = document.getElementById('btn-add-text-channel');
    const addVoiceBtn = document.getElementById('btn-add-voice-channel');
    if (addTextBtn) addTextBtn.style.display = canManageServer ? 'block' : 'none';
    if (addVoiceBtn) addVoiceBtn.style.display = canManageServer ? 'block' : 'none';

    // Mantém o botão IPTV/Cinema visível tanto no servidor principal quanto nos servidores particulares (mesmo sistema VIP do VOX)
    const iptvBtn = document.getElementById('btn-open-iptv');
    if (iptvBtn) iptvBtn.style.display = '';

    // Botão do Dono do servidor particular para trocar a foto do servidor (salva na nuvem)
    let srvPhotoBtn = document.getElementById('btn-server-change-photo');
    let srvPhotoInput = document.getElementById('input-server-change-photo');
    const brandHeader = document.querySelector('.kord-brand-header') || document.querySelector('.kord-brand-title')?.parentElement;
    if (!srvPhotoBtn && brandHeader) {
        srvPhotoInput = document.createElement('input');
        srvPhotoInput.type = 'file';
        srvPhotoInput.id = 'input-server-change-photo';
        srvPhotoInput.accept = 'image/*';
        srvPhotoInput.style.display = 'none';
        srvPhotoInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file || !state.currentServerId || state.currentServerId === 'default') return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const size = 128;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    const minDim = Math.min(img.width, img.height);
                    const sx = (img.width - minDim) / 2;
                    const sy = (img.height - minDim) / 2;
                    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                    const iconUrl = canvas.toDataURL('image/jpeg', 0.82);
                    sendWs({ type: 'update_server_icon', serverId: state.currentServerId, iconUrl });
                    showToast('📷 Foto do servidor atualizada e salva na nuvem!');
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            srvPhotoInput.value = '';
        });
        document.body.appendChild(srvPhotoInput);

        srvPhotoBtn = document.createElement('button');
        srvPhotoBtn.id = 'btn-server-change-photo';
        srvPhotoBtn.title = 'Alterar foto do servidor';
        srvPhotoBtn.style.cssText = 'display:none;background:#5865F2;color:#fff;border:none;border-radius:4px;padding:3px 7px;font-size:11px;font-weight:700;cursor:pointer;margin-left:auto;align-items:center;gap:4px;';
        srvPhotoBtn.innerHTML = '<i class="fa-solid fa-camera"></i>';
        srvPhotoBtn.onclick = (e) => {
            e.stopPropagation();
            if (srvPhotoInput) srvPhotoInput.click();
        };
        brandHeader.appendChild(srvPhotoBtn);
    }
    if (srvPhotoBtn) {
        srvPhotoBtn.style.display = (isCustomSrv && (hasCurrentServerOwnerPowers() || state.isOwner)) ? 'inline-flex' : 'none';
    }

    // Botão exclusivo do Mestre (DIM) para excluir qualquer servidor particular criado
    let delSrvBtn = document.getElementById('btn-master-delete-server');
    if (!delSrvBtn && brandHeader) {
        delSrvBtn = document.createElement('button');
        delSrvBtn.id = 'btn-master-delete-server';
        delSrvBtn.title = 'Excluir este servidor permanentemente (Exclusivo do Mestre)';
        delSrvBtn.style.cssText = 'display:none;background:#da373c;color:#fff;border:none;border-radius:4px;padding:3px 7px;font-size:11px;font-weight:700;cursor:pointer;margin-left:4px;align-items:center;gap:4px;';
        delSrvBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
        delSrvBtn.onclick = (e) => {
            e.stopPropagation();
            if (!state.isOwner || !state.currentServerId || state.currentServerId === 'default') return;
            const srvObj = (state.userServers || []).find(s => s.id === state.currentServerId);
            const srvName = srvObj ? srvObj.name : state.currentServerId;
            if (confirm(`🧙‍♂️ MESTRE: Deseja excluir PERMANENTEMENTE o servidor "${srvName}"?`)) {
                sendWs({ type: 'admin_delete_server', serverId: state.currentServerId });
            }
        };
        brandHeader.appendChild(delSrvBtn);
    }
    if (delSrvBtn) {
        delSrvBtn.style.display = (state.isOwner && isCustomSrv) ? 'inline-flex' : 'none';
    }

    renderBannedList();
}

function openOwnerModal() {
    if (!hasCurrentServerOwnerPowers()) {
        showToast('❌ O Painel do Dono é exclusivo para o Dono deste servidor.');
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
        { id: 'competitivo', name: '🏆 Competitivo / Ranked', type: 'voice', icon: 'fa-trophy' },
        { id: 'bate-papo', name: '☕ Bate-papo & Chill', type: 'voice', icon: 'fa-mug-hot' },
        { id: 'afk', name: '💤 AFK / Ausente', type: 'voice', icon: 'fa-bed' },
        { id: 'cinema-1', name: '🎬 Cinema 1 • Filmes', type: 'cinema', icon: 'fa-film', isVip: true },
        { id: 'cinema-2', name: '🍿 Cinema 2 • Séries', type: 'cinema', icon: 'fa-tv', isVip: true },
        { id: 'cinema-3', name: '⚽ Cinema 3 • Futebol & TV', type: 'cinema', icon: 'fa-futbol', isVip: true },
        { id: 'cinema-4', name: '🎞️ Cinema 4 • Lançamentos', type: 'cinema', icon: 'fa-clapperboard', isVip: true },
        { id: 'cinema-5', name: '👑 Cinema 5 • VIP Extra', type: 'cinema', icon: 'fa-crown', isVip: true }
    ];

    // Renderiza Canais de Texto
    textChannels.forEach(ch => {
        const item = document.createElement('div');
        item.className = `channel-item ${state.currentTextChannel === ch.id ? 'active' : ''}`;
        item.setAttribute('data-type', 'text');
        item.setAttribute('data-channel', ch.id);
        const canDelText = hasCurrentServerOwnerPowers() && ch.id !== 'geral' && ch.id !== `${state.currentServerId}_geral`;
        item.innerHTML = `
            <i class="fa-solid fa-hashtag"></i>
            <span>${escapeHtml(ch.name)}</span>
            ${canDelText ? `<button class="btn-del-channel" title="Excluir Canal"><i class="fa-solid fa-xmark"></i></button>` : ''}
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
        
        const canDelVoice = hasCurrentServerOwnerPowers() && ch.id !== 'geral';
        const isCinemaVip = ch.id.includes('cinema-') || ch.type === 'cinema' || ch.isVip;
        const vipTagHtml = isCinemaVip
            ? `<span class="cinema-vip-badge" title="Sala Exclusiva VIP" style="background:linear-gradient(135deg,#ffd700,#f59e0b);color:#000;font-size:9px;font-weight:900;padding:2px 6px;border-radius:4px;margin-left:auto;margin-right:4px;display:inline-flex;align-items:center;gap:3px;flex-shrink:0;box-shadow:0 0 8px rgba(255,215,0,0.45);"><i class="fa-solid fa-crown" style="font-size:9px;color:#000;"></i> VIP</span>`
            : '';
        vItem.innerHTML = `
            <div class="voice-header" style="display:flex;align-items:center;gap:6px;width:100%;">
                <i class="fa-solid ${iconClass}"${isCinemaVip ? ' style="color:#ffd700;flex-shrink:0;"' : ' style="flex-shrink:0;"'}></i>
                <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(ch.name.replace(/^[\ufffd\?🔊🎮🎬🍿⚽🏆☕💤🎞️👑\s]+/g, '').trim() || ch.name)}</span>
                ${vipTagHtml}
                <span class="live-pill" id="live-tag-${ch.id}" style="display: none;">AO VIVO</span>
                ${canDelVoice ? `<button class="btn-del-channel" title="Excluir Sala"><i class="fa-solid fa-xmark"></i></button>` : ''}
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



// Modal de Convidar Amigos com link específico do servidor atual (igual ao Discord)
function openInviteModal() {
    const modal = document.getElementById('invite-modal');
    const input = document.getElementById('invite-url-input');
    const baseUrl = (state.publicTunnelUrl || window.location.origin).replace(/\/$/, '');
    let url = baseUrl;
    if (state.currentServerId && state.currentServerId !== 'default') {
        const srvObj = (state.userServers || []).find(s => s.id === state.currentServerId);
        const code = (srvObj && srvObj.inviteCode) ? srvObj.inviteCode : state.currentServerId;
        url = `${baseUrl}/?invite=${encodeURIComponent(code)}`;
    }
    if (input) input.value = url;
    if (modal) modal.style.display = 'flex';
    copyInviteLink();
}

function closeInviteModal() {
    const modal = document.getElementById('invite-modal');
    if (modal) modal.style.display = 'none';
}

// --- MODAL DE INSTALAÇÃO DO APP (PWA / CELULAR E PC) ---
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showToast('🎉 Kord instalado com sucesso no seu dispositivo!');
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then((reg) => {
            reg.update();
        }).catch(() => {});
    });
}

function openInstallModal() {
    const modal = document.getElementById('install-modal');
    if (modal) modal.style.display = 'flex';
}

function closeInstallModal() {
    const modal = document.getElementById('install-modal');
    if (modal) modal.style.display = 'none';
}

function triggerPwaInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult && choiceResult.outcome === 'accepted') {
                showToast('🚀 Instalando aplicativo Kord...');
            }
            deferredPrompt = null;
            closeInstallModal();
        });
    } else {
        showToast('ℹ️ Siga o passo a passo na tela para instalar o Kord no seu navegador ou celular.', 6000);
    }
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
   KORD - CLIENT CONTROLLER COMPLETO
   ========================================================================== */

const savedUid = localStorage.getItem('vox_userid') || localStorage.getItem('dc_userid');
const currentUid = savedUid || ('user_' + Math.random().toString(36).substring(2, 9));
localStorage.setItem('vox_userid', currentUid);
localStorage.setItem('dc_userid', currentUid);

let savedUsername = (localStorage.getItem('vox_username') || localStorage.getItem('dc_username') || '').trim();
let savedTag = localStorage.getItem('vox_user_tag') || localStorage.getItem('dc_tag') || '';

// REGRA ABSOLUTA DE TAG FIXO: DIM É SEMPRE #4095
if (savedUsername.toUpperCase() === 'DIM' || savedUsername.toUpperCase().startsWith('DIM')) {
    savedTag = '#4095';
}

if (!savedTag) {
    savedTag = '#' + Math.floor(1000 + Math.random() * 9000);
}

localStorage.setItem('vox_user_tag', savedTag);
localStorage.setItem('dc_tag', savedTag);

const isDimUser = (savedUsername.toUpperCase() === 'DIM' || savedUsername.toUpperCase().startsWith('DIM') || savedTag.includes('4095'));

const state = {
    userId: currentUid,
    username: savedUsername || ('Jogador_' + savedTag.replace('#', '')),
    avatarColor: localStorage.getItem('dc_avatar') || '#5865F2',
    userTag: savedTag,
    isOwner: isDimUser,

    currentTextChannel: 'geral',
    currentVoiceChannel: null, // NÃO entra em nenhuma sala de voz automaticamente
    isMuted: false,
    isDeafened: false,
    isStreaming: false,

    streamConfig: {
        resolution: 1080, // 720, 1080, 1440 (2K)
        fps: 60,
        captureAudio: true,
        isolateVoice: true, // Não capturar áudio das salas de voz
        bitrate: 8000 // kbps
    },

    users: new Map(), // userId -> userData
    peerConnections: new Map(), // userId -> RTCPeerConnection
    remoteAudioElements: new Map(), // userId -> HTMLAudioElement
    activeStreams: new Map(), // userId -> { stream, username, info }
    currentlyWatchingUserId: null,
    isWatchingStream: true,
    serverAdmins: new Set(),
    isAdmin: false,

    // Controle individual de volume e mudo local para cada amigo
    userVolumes: new Map(), // userId -> volume (0 a 200)
    userMutedLocally: new Set(), // Set de userIds mutados apenas localmente
    activeContextUserId: null,
    isVip: false,
    vipExpiresAt: null,
    vips: new Map(),
    userServers: [],
    currentServerId: 'default',

    localAudioStream: null,
    localScreenStream: null,
    publicTunnelUrl: null,

    fpsInterval: null,
    micTestStream: null,
    micTestAnalyser: null,
    micTestInterval: null,

    // Estado do IPTV e das 3 Salas de Cinema
    cinemaRooms: { 'cinema-1': null, 'cinema-2': null, 'cinema-3': null, 'cinema-4': null, 'cinema-5': null },
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

function send(data) { sendWs(data); }
function sendWs(data) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

function initWebSocket() {
    socket = new WebSocket(wsUrl);

function getOrCreateVoxDeviceId() {
    let devId = null;
    try { devId = localStorage.getItem('vox_device_id'); } catch (e) {}
    if (!devId) {
        const match = document.cookie.match(/(?:^|;\s*)vox_dev_id=([^;]+)/);
        if (match) devId = decodeURIComponent(match[1]);
    }
    if (!devId) {
        devId = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    try { localStorage.setItem('vox_device_id', devId); } catch (e) {}
    try { document.cookie = `vox_dev_id=${encodeURIComponent(devId)}; max-age=31536000; path=/; SameSite=Lax`; } catch (e) {}
    return devId;
}

function computeVoxDeviceFingerprint() {
    try {
        let gpu = '';
        try {
            const c = document.createElement('canvas');
            const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
            if (gl) {
                const dbg = gl.getExtension('WEBGL_debug_renderer_info');
                gpu = dbg ? (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
            }
        } catch (e) {}

        let canvasSig = '';
        try {
            const c2 = document.createElement('canvas');
            c2.width = 160; c2.height = 30;
            const ctx = c2.getContext('2d');
            if (ctx) {
                ctx.textBaseline = 'top';
                ctx.font = '14px Arial';
                ctx.fillStyle = '#f60';
                ctx.fillRect(10, 1, 62, 20);
                ctx.fillStyle = '#069';
                ctx.fillText('VOX-FP-60FPS', 2, 10);
                canvasSig = c2.toDataURL().slice(-64);
            }
        } catch (e) {}

        const raw = [
            navigator.platform || '',
            navigator.hardwareConcurrency || '',
            navigator.deviceMemory || '',
            navigator.language || '',
            `${screen.width}x${screen.height}x${screen.colorDepth}`,
            Intl.DateTimeFormat().resolvedOptions().timeZone || '',
            gpu,
            canvasSig
        ].join('|');

        // Hash determinístico FNV-1a 64-bit (duas passadas de 32-bit)
        let h1 = 0x811c9dc5, h2 = 0x01000193;
        for (let i = 0; i < raw.length; i++) {
            const ch = raw.charCodeAt(i);
            h1 ^= ch;
            h1 = Math.imul(h1, 0x01000193);
            h2 ^= ch;
            h2 = Math.imul(h2, 0x85ebca6b);
        }
        return 'fp_' + (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
    } catch (e) {
        return '';
    }
}

    socket.onopen = () => {
        console.log('✅ WebSocket Conectado!');
        sendWs({
            type: 'join',
            id: state.userId,
            username: state.username,
            avatar: state.avatarColor,
            avatarUrl: state.avatarUrl || (() => { try { return localStorage.getItem('vox_avatar_url') || ''; } catch (e) { return ''; } })(),
            bannerUrl: state.bannerUrl || (() => { try { return localStorage.getItem('vox_banner_url') || ''; } catch (e) { return ''; } })(),
            userTag: state.userTag,
            tag: state.userTag,
            voiceChannel: state.currentVoiceChannel || null,
            isMuted: !!state.isMuted,
            isDeafened: !!state.isDeafened,
            isStreaming: !!state.isStreaming,
            streamInfo: state.isStreaming ? { resolution: `${state.streamConfig.resolution}p`, fps: state.streamConfig.fps } : null,
            currentServerId: state.currentServerId || 'default',
            status: state.userStatus || 'online',
            activity: state.userActivity || null,
            deviceId: getOrCreateVoxDeviceId(),
            deviceFingerprint: computeVoxDeviceFingerprint()
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
            if (data.selfId) state.userId = data.selfId;
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
                const meMem = state.serverMembers.get(state.userId);
                if (meMem && meMem.avatarUrl && !state.avatarUrl) {
                    state.avatarUrl = meMem.avatarUrl;
                    try { localStorage.setItem('vox_avatar_url', state.avatarUrl); } catch (e) {}
                    updateMyProfileUI();
                }
                if (meMem && meMem.bannerUrl && !state.bannerUrl) {
                    state.bannerUrl = meMem.bannerUrl;
                    try { localStorage.setItem('vox_banner_url', state.bannerUrl); } catch (e) {}
                }
            }
            if (data.onlineIds) {
                state.onlineUserIds = new Set(data.onlineIds);
                // Remove transmissões fantasma de usuários que não estão mais online/transmitindo após reinício do servidor
                for (const uid of Array.from(state.activeStreams.keys())) {
                    if (uid === state.userId && state.isStreaming) continue;
                    const uObj = state.users.get(uid);
                    if (!state.onlineUserIds.has(uid) || !uObj || !uObj.isStreaming) {
                        removeStream(uid);
                    }
                }
            }
            if (data.channels) {
                state.channels = data.channels;
            }
            if (data.banned) {
                state.bannedUsers = data.banned;
            }
            if (data.admins) {
                state.serverAdmins = new Set(data.admins);
            }
            if (data.isAdmin !== undefined) {
                state.isAdmin = !!data.isAdmin;
            }
            if (data.isVip !== undefined) {
                state.isVip = !!data.isVip;
            }
            if (data.vipExpiresAt) {
                state.vipExpiresAt = data.vipExpiresAt;
            }
            if (data.vips) {
                state.vips = new Map(Object.entries(data.vips));
            }
            if (data.servers) {
                state.userServers = data.servers;
                renderUserServers();
            }
            if (data.trialGranted) {
                setTimeout(() => {
                    showToast('🎉 Parabéns! Você ganhou 15 Dias de Acesso VIP Grátis para curtir Cinema, Filmes e TV Ao Vivo!', 9000);
                }, 1000);
            }
            if (data.isOwner !== undefined) {
                state.isOwner = data.isOwner || (false);
                updateOwnerUI();
            }
            renderChannels();
            renderMembersSidebar();
            // Auto-entrada em servidor particular via link de convite (?invite=CODIGO)
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const invCode = urlParams.get('invite');
                if (invCode) {
                    sendWs({ type: 'join_server_invite', inviteCode: invCode });
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (e) {}
            break;

        case 'vip_guest_pass':
            state.vipGuestRoom = data.room || null;
            if (data.room && data.message) {
                showToast(data.message, 7000);
            }
            break;

        case 'vip_required':
            stopCinemaPlayback();
            openVipModal();
            if (state.currentVoiceChannel === data.channelId) {
                leaveVoiceChannel(false);
            }
            showToast('⭐ ' + (data.message || 'Esta sala é exclusiva para Membros VIP!'), 6000);
            break;

        case 'vip_update':
            if (!state.vips) state.vips = new Map();
            if (data.isVip) {
                state.vips.set(data.userId, {
                    isVip: true,
                    isTrial: !!data.isTrial,
                    hideBadge: !!data.hideBadge,
                    isLifetime: !!data.isLifetime,
                    durationDays: data.durationDays ?? null,
                    expiresAt: data.expiresAt ?? null
                });
            } else {
                state.vips.delete(data.userId);
            }
            // Sincroniza objetos nos mapas locais de membros e usuários
            const sm = state.serverMembers.get(data.userId);
            if (sm) sm.isVip = !!data.isVip;
            const su = state.users.get(data.userId);
            if (su) su.isVip = !!data.isVip;

            if (data.userId === state.userId) {
                state.isVip = !!data.isVip;
            }
            showToast(data.isVip ? '⭐ Selo VIP ativado para o usuário!' : '⭐ Selo VIP removido com sucesso!');
            renderMembersSidebar();
            renderVoiceUsers();
            break;

        case 'vip_status_updated':
            state.isVip = !!data.isVip;
            state.vipExpiresAt = data.expiresAt;
            renderMembersSidebar();
            if (data.isVip) {
                showToast('👑 Seu Acesso VIP foi ativado com sucesso! Aproveite todas as salas de Cinema e Filmes!');
            }
            break;

        case 'server_created':
            if (data.server) {
                state.userServers.push(data.server);
                renderUserServers();
                switchServer(data.server.id);
                showToast(`🎉 Servidor "${data.server.name}" criado com sucesso!`);
            }
            break;

        case 'servers_list_updated':
            if (Array.isArray(data.servers)) {
                state.userServers = data.servers;
                renderUserServers();
            }
            break;

        case 'server_joined':
            if (Array.isArray(data.servers)) {
                state.userServers = data.servers;
            }
            if (data.server) {
                state.currentServerId = data.server.id;
                state.isCurrentServerOwner = !!data.server.isOwner;
                state.isCurrentServerAdmin = !!data.server.isAdmin;
                state.currentServerOwnerId = data.server.ownerId || null;
                state.currentServerMemberIds = Array.isArray(data.server.memberIds) ? new Set(data.server.memberIds) : null;
                state.currentServerMemberProfiles = Array.isArray(data.server.memberProfiles) ? data.server.memberProfiles : [];
                state.currentServerAdmins = new Set(data.server.admins || []);
                state.bannedUsers = data.server.banned || [];
                if (state.currentVoiceChannel) {
                    leaveVoiceChannel(false);
                }
                const brandTitle = document.querySelector('.kord-brand-title');
                if (brandTitle) brandTitle.textContent = (data.server.name || 'VOX').toUpperCase();
                if (data.server.channels) {
                    state.channels = data.server.channels;
                    const firstText = (data.server.channels.text || [])[0];
                    if (firstText) {
                        state.currentTextChannel = firstText.id;
                        const titleEl = document.getElementById('current-channel-title');
                        if (titleEl) titleEl.textContent = firstText.name;
                        const inputEl = document.getElementById('chat-input');
                        if (inputEl) inputEl.placeholder = `Conversar em #${firstText.name}...`;
                    }
                    renderChannels();
                }
                const chatBox = document.getElementById('messages-list') || document.getElementById('chat-messages');
                if (chatBox) {
                    chatBox.innerHTML = '';
                    if (Array.isArray(data.messages)) {
                        data.messages.forEach(m => renderChatMessage(m));
                    }
                }
                renderUserServers();
                renderMembersSidebar();
                updateOwnerUI();
                showToast(`🎉 Você entrou no servidor "${escapeHtml(data.server.name)}" pelo convite!`);
            }
            break;

        case 'server_switched':
            if (data.server) {
                state.currentServerId = data.server.id;
                state.isCurrentServerOwner = !!data.server.isOwner;
                state.isCurrentServerAdmin = !!data.server.isAdmin;
                state.currentServerOwnerId = data.server.ownerId || null;
                state.currentServerMemberIds = (data.server.id !== 'default' && Array.isArray(data.server.memberIds))
                    ? new Set(data.server.memberIds)
                    : null;
                state.currentServerMemberProfiles = (data.server.id !== 'default' && Array.isArray(data.server.memberProfiles))
                    ? data.server.memberProfiles
                    : [];
                state.currentServerAdmins = (data.server.id !== 'default') ? new Set(data.server.admins || []) : new Set();
                state.bannedUsers = data.server.banned || [];
                if (state.currentVoiceChannel) {
                    leaveVoiceChannel(false);
                }
                const brandTitle = document.querySelector('.kord-brand-title');
                if (brandTitle) brandTitle.textContent = (data.server.name || 'VOX').toUpperCase();
                if (data.server.channels) {
                    state.channels = data.server.channels;
                    const firstText = (data.server.channels.text || [])[0];
                    if (firstText) {
                        state.currentTextChannel = firstText.id;
                        const titleEl = document.getElementById('current-channel-title');
                        if (titleEl) titleEl.textContent = firstText.name;
                        const inputEl = document.getElementById('chat-input');
                        if (inputEl) inputEl.placeholder = `Conversar em #${firstText.name}...`;
                    }
                    renderChannels();
                }
                const chatBox = document.getElementById('messages-list') || document.getElementById('chat-messages');
                if (chatBox) {
                    chatBox.innerHTML = '';
                    if (Array.isArray(data.messages)) {
                        data.messages.forEach(m => renderChatMessage(m));
                    }
                }
                renderUserServers();
                renderMembersSidebar();
                updateOwnerUI();
                const inspectSuffix = data.server.isInspectOnly ? ' (Modo Inspetor — invisível)' : (data.server.isOwner && data.server.id !== 'default' ? ' (Você é o Dono 👑)' : '');
                showToast(`🔄 Você entrou no servidor "${escapeHtml(data.server.name)}"${inspectSuffix}`);
            }
            break;

        case 'role_update':
            if (!state.serverAdmins) state.serverAdmins = new Set();
            if (data.admins) {
                state.serverAdmins = new Set(data.admins);
            } else if (data.isAdmin) {
                state.serverAdmins.add(data.userId);
            } else {
                state.serverAdmins.delete(data.userId);
            }
            if (data.userId === state.userId) {
                state.isAdmin = !!data.isAdmin;
            }
            const rUser = state.users.get(data.userId);
            if (rUser) rUser.isAdmin = !!data.isAdmin;
            const rMember = state.serverMembers.get(data.userId);
            if (rMember) rMember.isAdmin = !!data.isAdmin;
            renderVoiceUsers();
            renderMembersSidebar();
            break;

        case 'admin_role_updated':
            state.isAdmin = !!data.isAdmin;
            showToast(data.isAdmin ? '🛡️ <b>Você agora é Administrador do servidor!</b>' : '🛡️ <b>Seu cargo de Administrador foi removido.</b>', 5000);
            renderVoiceUsers();
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
            if (data.serverId && data.serverId !== state.currentServerId) break;
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
            if (data.serverId && data.serverId !== state.currentServerId) break;
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
                playDiscordVoiceJoinSound();
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
            const leavingUser = state.users.get(data.userId);
            if (leavingUser && state.currentVoiceChannel && leavingUser.voiceChannel === state.currentVoiceChannel) {
                playDiscordVoiceLeaveSound();
            }
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
                if (typeof updateMicDeafenButtonsUI === 'function') updateMicDeafenButtonsUI();
                if (state.localAudioStream) {
                    state.localAudioStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
                }
                if (state.rawMicrophoneStream) {
                    state.rawMicrophoneStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
                }
                if (state.peerConnections) {
                    state.peerConnections.forEach(pc => {
                        pc.getSenders().forEach(s => {
                            if (s.track && s.track.kind === 'audio') s.track.enabled = !state.isMuted;
                        });
                    });
                }
                if (typeof applyDeafenToAllAudio === 'function') applyDeafenToAllAudio();
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
                const prevChannel = u ? u.voiceChannel : null;
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

                if (state.currentVoiceChannel) {
                    if (data.channelId === state.currentVoiceChannel && prevChannel !== state.currentVoiceChannel) {
                        playDiscordVoiceJoinSound();
                    } else if (prevChannel === state.currentVoiceChannel && data.channelId !== state.currentVoiceChannel) {
                        playDiscordVoiceLeaveSound();
                    }
                }

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

        case 'stream_updated':
            const updStreamer = state.users.get(data.userId);
            if (updStreamer) {
                updStreamer.streamInfo = data.streamInfo;
            }
            const activeSt = state.activeStreams.get(data.userId);
            if (activeSt && data.streamInfo) {
                activeSt.info = data.streamInfo;
                if (state.currentlyWatchingUserId === data.userId) {
                    const resBadge = document.getElementById('hud-res');
                    if (resBadge) resBadge.textContent = `${data.streamInfo.resolution || '1080p'}`;
                    const fpsBadge = document.getElementById('hud-fps');
                    if (fpsBadge) fpsBadge.textContent = `${data.streamInfo.fps || 60}.0 FPS`;
                }
            }
            renderVoiceUsers();
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

        
        case 'user_status_changed': {
            const u = state.users.get(data.userId) || state.serverMembers.get(data.userId);
            if (u) u.status = data.status;
            if (state.serverMembers.has(data.userId)) {
                state.serverMembers.get(data.userId).status = data.status;
            }
            renderMembersSidebar();
            break;
        }

        case 'user_activity_changed': {
            const u = state.users.get(data.userId) || state.serverMembers.get(data.userId);
            if (u) u.activity = data.activity;
            // Garante atualização em ambos os mapas
            if (state.users.has(data.userId)) {
                state.users.get(data.userId).activity = data.activity;
            }
            if (state.serverMembers.has(data.userId)) {
                state.serverMembers.get(data.userId).activity = data.activity;
            }
            // Se não existe em nenhum mapa ainda, criar entrada mínima em state.users
            if (!state.users.has(data.userId) && !state.serverMembers.has(data.userId)) {
                state.users.set(data.userId, { id: data.userId, username: data.username, activity: data.activity });
            }
            renderMembersSidebar();
            break;
        }

        case 'admin_user_audit_data':
            renderUserAuditModal(data);
            break;

        case 'admin_warn_success':
            if (typeof showToast === 'function') showToast('Advertência aplicada com sucesso!', 'warning');
            if (state.activeAuditUserId === data.targetUserId) {
                sendWs({ type: 'admin_get_user_audit', targetUserId: data.targetUserId });
            }
            break;

        case 'moderation_warning':
            alert(`⚠️ ADVERTÊNCIA DA ADMINISTRAÇÃO VOX:\n\nMotivo: ${data.reason}\nAplicada por: ${data.warnedBy}\n\nPor favor, mantenha uma postura respeitosa para evitar suspensão da conta.`);
            break;

        case 'bulk_messages_deleted': {
            const list = document.getElementById('messages-list');
            if (list) {
                const rows = list.querySelectorAll(`.chat-message-row[data-sender-id="${data.senderId}"]`);
                rows.forEach(r => r.remove());
            }
            if (typeof showToast === 'function') showToast('Mensagens purgadas pelo administrador.', 'info');
            if (state.activeAuditUserId === data.senderId) {
                sendWs({ type: 'admin_get_user_audit', targetUserId: data.senderId });
            }
            break;
        }

        case 'message_deleted': {
            const msgEl = document.querySelector(`.chat-message-row[data-message-id="${data.messageId}"]`);
            if (msgEl) msgEl.remove();
            break;
        }

        case 'user_server_muted':
            if (data.userId === state.userId) {
                state.isServerMuted = data.isServerMuted;
                if (data.isServerMuted) {
                    alert('Você foi silenciado no servidor por um administrador para manter a ordem.');
                } else {
                    if (typeof showToast === 'function') showToast('Você foi desmutado no servidor.', 'success');
                }
            }
            if (state.activeAuditUserId === data.userId) {
                sendWs({ type: 'admin_get_user_audit', targetUserId: data.userId });
            }
            break;

        
        case 'sync_users_response':
            if (data.users && Array.isArray(data.users)) {
                data.users.forEach(u => state.users.set(u.id, u));
            }
            if (data.onlineIds && Array.isArray(data.onlineIds)) {
                state.onlineUserIds = new Set(data.onlineIds);
            }
            if (data.members && Array.isArray(data.members)) {
                data.members.forEach(m => state.serverMembers.set(m.id, m));
            }
            renderMembersSidebar();
            renderVoiceUsers();
            break;

        case 'chat_message':
            if (data.serverId && data.serverId !== state.currentServerId) break;
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
            audioEl.muted = state.isDeafened || state.userMutedLocally.has(targetUserId);

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

function getOptimalBitrate(res, fps) {
    const is60 = fps >= 60;
    if (res >= 1440) return is60 ? 12000 : 7500;
    if (res >= 1080) return is60 ? 8000 : 4500;
    return is60 ? 4500 : 2500;
}

function preferHardwareVideoCodec(pc) {
    try {
        if (typeof RTCRtpSender === 'undefined' || !RTCRtpSender.getCapabilities) return;
        const caps = RTCRtpSender.getCapabilities('video');
        if (!caps || !caps.codecs) return;
        // Prioriza H264 (aceleração por GPU NVENC/AMD/QuickSync) e depois VP8 para manter 60 FPS sem travar o jogo
        const h264 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/h264');
        const vp8 = caps.codecs.filter(c => c.mimeType.toLowerCase() === 'video/vp8');
        const others = caps.codecs.filter(c => c.mimeType.toLowerCase() !== 'video/h264' && c.mimeType.toLowerCase() !== 'video/vp8');
        const ordered = [...h264, ...vp8, ...others];
        pc.getTransceivers().forEach(t => {
            if (t.sender && t.sender.track && t.sender.track.kind === 'video' && typeof t.setCodecPreferences === 'function') {
                try { t.setCodecPreferences(ordered); } catch (e) {}
            }
        });
    } catch (e) {}
}

async function optimizeSenderBitrate(sender) {
    try {
        const res = state.streamConfig.resolution || 1080;
        const fps = state.streamConfig.fps || 60;
        const bitrateKbps = getOptimalBitrate(res, fps);
        state.streamConfig.bitrate = bitrateKbps;

        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
            params.encodings = [{}];
        }
        // maintain-framerate impede o navegador de derrubar o FPS para 10-15 em cenas com movimento rápido (jogos)
        params.degradationPreference = 'maintain-framerate';
        params.encodings[0].maxBitrate = bitrateKbps * 1000;
        params.encodings[0].maxFramerate = fps;
        params.encodings[0].scaleResolutionDownBy = 1.0;
        params.encodings[0].priority = 'high';
        params.encodings[0].networkPriority = 'high';
        await sender.setParameters(params);
    } catch (e) {}
}

function enhanceSDP(sdp) {
    if (!sdp) return sdp;
    const b = getOptimalBitrate(state.streamConfig.resolution || 1080, state.streamConfig.fps || 60);
    const startB = Math.min(4000, Math.round(b * 0.6));
    const minB = 1500;
    const lines = sdp.split('\r\n');
    const out = [];
    let inVideo = false;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.startsWith('m=video')) {
            inVideo = true;
            out.push(line);
            continue;
        }
        if (line.startsWith('m=')) {
            inVideo = false;
            out.push(line);
            continue;
        }
        if (inVideo && line.startsWith('c=IN')) {
            out.push(line);
            out.push(`b=AS:${b}`);
            out.push(`b=TIAS:${b * 1000}`);
            continue;
        }
        if (inVideo && line.startsWith('a=fmtp:') && !line.includes('x-google-max-bitrate')) {
            line += `;x-google-min-bitrate=${minB};x-google-start-bitrate=${startB};x-google-max-bitrate=${b}`;
        }
        out.push(line);
    }
    return out.join('\r\n');
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

        // 1. High-Pass suave em 80Hz (Corta apenas ronco de mesa, vibração e ruído de 60Hz da rede elétrica, sem tirar o corpo da voz)
        const highpass = voiceAudioCtx.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.setValueAtTime(80, voiceAudioCtx.currentTime);
        highpass.Q.setValueAtTime(0.7, voiceAudioCtx.currentTime);

        // 2. Low-Pass em 10.500Hz (Corta chiado de alta frequência mantendo 100% da inteligibilidade das consoantes)
        const lowpass = voiceAudioCtx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.setValueAtTime(10500, voiceAudioCtx.currentTime);
        lowpass.Q.setValueAtTime(0.7, voiceAudioCtx.currentTime);

        // 3. Realce de Presença e Articulação Vocal em 2.800Hz (+2.5dB sutil para voz aberta e definida)
        const vocalClarity = voiceAudioCtx.createBiquadFilter();
        vocalClarity.type = 'peaking';
        vocalClarity.frequency.setValueAtTime(2800, voiceAudioCtx.currentTime);
        vocalClarity.Q.setValueAtTime(1.0, voiceAudioCtx.currentTime);
        vocalClarity.gain.setValueAtTime(2.5, voiceAudioCtx.currentTime);

        // 4. Compressor de Voz de Estúdio: normaliza quem fala baixo e impede estouros/distorções
        const compressor = voiceAudioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-24, voiceAudioCtx.currentTime);
        compressor.knee.setValueAtTime(15, voiceAudioCtx.currentTime);
        compressor.ratio.setValueAtTime(3.0, voiceAudioCtx.currentTime);
        compressor.attack.setValueAtTime(0.005, voiceAudioCtx.currentTime);
        compressor.release.setValueAtTime(0.12, voiceAudioCtx.currentTime);

        // 5. Analisador Espectral para medição precisa de energia vocal
        voiceAnalyserNode = voiceAudioCtx.createAnalyser();
        voiceAnalyserNode.fftSize = 512;
        voiceAnalyserNode.smoothingTimeConstant = 0.25;

        // 6. Expansor / Portão Suave de Áudio (Inicia ABERTO em 1.0 para nunca engolir as primeiras palavras)
        voiceGateGain = voiceAudioCtx.createGain();
        voiceGateGain.gain.setValueAtTime(1.0, voiceAudioCtx.currentTime);

        // 7. Destino WebRTC
        voiceDestinationNode = voiceAudioCtx.createMediaStreamDestination();

        // Encadeamento acústico de estúdio:
        // rawStream -> highpass (80Hz) -> lowpass (10.5kHz) -> vocalClarity (2.8kHz) -> compressor -> voiceAnalyserNode
        //                                                                                           -> voiceGateGain -> destination
        voiceSourceNode.connect(highpass);
        highpass.connect(lowpass);
        lowpass.connect(vocalClarity);
        vocalClarity.connect(compressor);
        compressor.connect(voiceAnalyserNode);
        compressor.connect(voiceGateGain);
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
        console.warn('Erro ao inicializar filtro de voz, usando áudio nativo:', err);
        state.localAudioStream = rawStream;
        return rawStream;
    }
}

function setupVoiceActivityDetection() {
    if (!voiceAnalyserNode || !voiceAudioCtx) return;

    const dataArray = new Uint8Array(voiceAnalyserNode.frequencyBinCount);
    const timeDomainArray = new Uint8Array(voiceAnalyserNode.fftSize);
    let isSpeaking = false;
    lastSpeechTime = Date.now();
    ambientNoiseFloor = 14.0;

    if (vadInterval) clearInterval(vadInterval);
    vadInterval = setInterval(() => {
        if (!state.currentVoiceChannel) return;

        // Se estiver na sala AFK ou mutado, silêncio absoluto
        if (state.currentVoiceChannel === 'afk' || state.isMuted) {
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

        // 2. Mede a energia na faixa da fala humana (100Hz a 4000Hz -> bins 1 a 42)
        let speechEnergy = 0;
        for (let i = 1; i <= 42; i++) {
            speechEnergy += dataArray[i];
        }
        const avgSpeechEnergy = speechEnergy / 42;

        // 3. Mede volume RMS no domínio do tempo
        voiceAnalyserNode.getByteTimeDomainData(timeDomainArray);
        let sumSquares = 0;
        for (let i = 0; i < timeDomainArray.length; i++) {
            const normalized = (timeDomainArray[i] - 128) / 128;
            sumSquares += normalized * normalized;
        }
        const rms = Math.sqrt(sumSquares / timeDomainArray.length);

        // 4. Rastreamento inteligente do piso de ruído constante (ex: ventilador/cooler)
        if (!isSpeaking && rms < 0.02) {
            ambientNoiseFloor = (ambientNoiseFloor * 0.95) + (avgSpeechEnergy * 0.05);
            if (ambientNoiseFloor > 35) ambientNoiseFloor = 35;
            if (ambientNoiseFloor < 8) ambientNoiseFloor = 8;
        }

        // 5. Limiar natural e sensível de voz humana próxima:
        // Qualquer pessoa falando em tom normal perto do mic gera RMS > 0.016 e energia acima do ruído.
        const isVoiceCandidate = (rms > 0.016 && avgSpeechEnergy > (ambientNoiseFloor + 8));

        if (isVoiceCandidate) {
            lastSpeechTime = Date.now();

            // Abre o ganho totalmente de forma transparente
            if (voiceGateGain) {
                voiceGateGain.gain.setTargetAtTime(1.0, voiceAudioCtx.currentTime, 0.008);
            }

            if (!isSpeaking) {
                isSpeaking = true;
                updateVoiceUserStateUI(state.userId, false, state.isDeafened, true);
                sendWs({ type: 'voice_state', isMuted: false, isDeafened: state.isDeafened, isSpeaking: true });
            }
        } else {
            // Sustentação (hold time) de 420ms para pausas naturais entre palavras e respiração
            const timeSinceSpeech = Date.now() - lastSpeechTime;
            if (timeSinceSpeech > 420) {
                // Expansor suave: reduz o ruído de fundo para 0.03 (-30dB) sem cortar o áudio com tranco
                if (voiceGateGain) {
                    voiceGateGain.gain.setTargetAtTime(0.03, voiceAudioCtx.currentTime, 0.04);
                }

                if (isSpeaking) {
                    isSpeaking = false;
                    updateVoiceUserStateUI(state.userId, state.isMuted, state.isDeafened, false);
                    sendWs({ type: 'voice_state', isMuted: state.isMuted, isDeafened: state.isDeafened, isSpeaking: false });
                }
            }
        }

        // AFK mover desativado – o usuário não será mais movido automaticamente para a sala AFK.
        // Mantido aqui apenas para referência.

    }, 50);
}

// --- Microfone Local ---
async function startMicrophone(deviceId = null) {
    try {
        const audioConstraints = {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
            googEchoCancellation: true,
            googAutoGainControl: true,
            googNoiseSuppression: true,
            googHighpassFilter: true,
            googTypingNoiseDetection: true,
            googAudioMirroring: false
        };
        if (deviceId) {
            audioConstraints.deviceId = { exact: deviceId };
        }

        const rawStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: false
        });

        // Passa pelo filtro acústico anti-ruído de estúdio e compressor
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

        // Inicia detector inteligente de voz próxima
        setupVoiceActivityDetection();
    } catch (e) {
        console.warn('Microfone não ativado:', e);
    }
}

function updateMicDeafenButtonsUI() {
    const micBtn = document.getElementById('btn-mic');
    if (micBtn) {
        micBtn.classList.toggle('active', !!state.isMuted);
        micBtn.title = state.isMuted ? 'Ativar Microfone' : 'Silenciar Microfone';
        micBtn.innerHTML = state.isMuted
            ? '<i class="fa-solid fa-microphone-slash"></i>'
            : '<i class="fa-solid fa-microphone"></i>';
    }
    const deafenBtn = document.getElementById('btn-deafen');
    if (deafenBtn) {
        deafenBtn.classList.toggle('active', !!state.isDeafened);
        deafenBtn.title = state.isDeafened ? 'Reativar Áudio' : 'Ensurdecer';
        deafenBtn.innerHTML = state.isDeafened
            ? '<i class="fa-solid fa-volume-xmark"></i>'
            : '<i class="fa-solid fa-headphones"></i>';
    }
}

function applyDeafenToAllAudio() {
    state.remoteAudioElements.forEach((audioEl, uid) => {
        audioEl.muted = state.isDeafened || state.userMutedLocally.has(uid);
    });
    const vid = document.getElementById('main-cinema-video');
    if (vid) vid.muted = !!state.isDeafened;
    document.querySelectorAll('audio').forEach(a => {
        if (state.isDeafened) {
            a.muted = true;
        }
    });
}

function setMicrophoneMuted(muted) {
    state.isMuted = !!muted;
    updateMicDeafenButtonsUI();

    if (state.localAudioStream) {
        state.localAudioStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
    }
    if (state.rawMicrophoneStream) {
        state.rawMicrophoneStream.getAudioTracks().forEach(t => t.enabled = !state.isMuted);
    }
    if (state.peerConnections) {
        state.peerConnections.forEach(pc => {
            pc.getSenders().forEach(s => {
                if (s.track && s.track.kind === 'audio') {
                    s.track.enabled = !state.isMuted;
                }
            });
        });
    }
    if (voiceGateGain && voiceAudioCtx) {
        try {
            if (!state.isMuted && voiceAudioCtx.state === 'suspended') {
                voiceAudioCtx.resume().catch(() => {});
            }
            voiceGateGain.gain.cancelScheduledValues(voiceAudioCtx.currentTime);
            voiceGateGain.gain.setValueAtTime(state.isMuted ? 0 : 1.0, voiceAudioCtx.currentTime);
        } catch (e) {}
    }

    if (!state.voiceStates) state.voiceStates = new Map();
    state.voiceStates.set(state.userId, {
        isMuted: state.isMuted,
        isDeafened: state.isDeafened,
        isSpeaking: false
    });
    const me = state.users.get(state.userId);
    if (me) {
        me.isMuted = state.isMuted;
        me.isDeafened = state.isDeafened;
        me.isSpeaking = false;
    }

    updateVoiceUserStateUI(state.userId, state.isMuted, state.isDeafened, false);
    renderVoiceUsers();
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
        // Captura de tela com áudio automático pré-marcado e alta fidelidade 48kHz + prioridade de movimento (60 FPS)
        const constraints = {
            video: {
                frameRate: { ideal: fps, min: Math.min(30, fps), max: fps },
                width: { ideal: width, max: width },
                height: { ideal: height, max: height },
                cursor: 'always'
            },
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: 2,
                sampleRate: 48000,
                suppressLocalAudioPlayback: false
            },
            systemAudio: 'include',
            windowAudio: 'window',
            selfBrowserSurface: 'include',
            surfaceSwitching: 'include'
        };
        try {
            stream = await navigator.mediaDevices.getDisplayMedia(constraints);
        } catch (errAudio) {
            console.warn('Fallback getDisplayMedia constraints simples:', errAudio);
            stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: { ideal: fps, max: fps },
                    width: { ideal: width, max: width },
                    height: { ideal: height, max: height }
                },
                audio: true,
                systemAudio: 'include'
            });
        }
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
        // CRUCIAL PARA JOGOS 60 FPS: informa ao navegador para priorizar fluidez (motion) ao invés de texto estático (detail)
        const vTrack = stream.getVideoTracks()[0];
        if (vTrack && 'contentHint' in vTrack) {
            vTrack.contentHint = 'motion';
        }

        state.localScreenStream = stream;
        state.isStreaming = true;
        state.streamConfig.bitrate = getOptimalBitrate(res, fps);

        // Garante que a transmissão SEMPRE venha com áudio
        let hasAudio = stream.getAudioTracks().length > 0;
        if (!hasAudio && state.localAudioStream && state.localAudioStream.getAudioTracks().length > 0) {
            try {
                // Injeta automaticamente o áudio do microfone para a transmissão não ficar muda
                const micTrack = state.localAudioStream.getAudioTracks()[0].clone();
                stream.addTrack(micTrack);
                hasAudio = true;
                showToast('🎮 Transmissão iniciada com seu áudio incluído automaticamente!', 4000);
            } catch (e) {
                console.warn('Não foi possível anexar áudio secundário:', e);
            }
        }
        if (hasAudio) {
            showToast(`🎮 Transmissão ${res}p ${fps} FPS iniciada com áudio estéreo ativo!`, 4000);
        } else {
            showToast(`🎮 Transmissão ${res}p ${fps} FPS iniciada!`, 3000);
        }

        addStream(state.userId, stream, state.username + ' (Você)', {
            resolution: `${res}p`,
            fps: fps
        });

        const btn = document.getElementById('btn-stream-toggle');
        if (btn) btn.classList.add('streaming');
        const btnText = document.getElementById('btn-stream-text');
        if (btnText) btnText.textContent = 'Parar Tela';
        ['btn-stream-edit', 'btn-hud-edit-stream', 'btn-vc-edit-stream'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'inline-flex';
        });
        const hudRes = document.getElementById('hud-res');
        if (hudRes) hudRes.textContent = `${res}p`;
        const hudBitrate = document.getElementById('hud-bitrate');
        if (hudBitrate) hudBitrate.textContent = `${(state.streamConfig.bitrate / 1000).toFixed(1)} Mbps`;

        // Envia para os peers com renegociação, codec de hardware (H264/VP8) e SDP otimizado
        for (const [targetId, pc] of state.peerConnections.entries()) {
            stream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, stream);
                if (track.kind === 'video') optimizeSenderBitrate(sender);
            });
            preferHardwareVideoCodec(pc);
            try {
                if (pc.signalingState === 'stable') {
                    const offer = await pc.createOffer();
                    const optimizedOffer = { type: offer.type, sdp: enhanceSDP(offer.sdp) };
                    await pc.setLocalDescription(optimizedOffer);
                    sendWs({
                        type: 'webrtc_offer',
                        target: targetId,
                        offer: optimizedOffer
                    });
                }
            } catch (e) {}
        }

        sendWs({
            type: 'screen_start',
            streamInfo: { resolution: `${res}p`, fps: fps }
        });

        if (vTrack) vTrack.onended = () => stopScreenShare();

    } catch (e) {
        if (e.name !== 'NotAllowedError') {
            alert('Não foi possível iniciar a transmissão: ' + e.message);
        }
    }
}

function openStreamModal(editMode = false) {
    const streamModal = document.getElementById('stream-modal');
    if (!streamModal) return;

    // Sincroniza cards de resolução e FPS com a configuração atual
    document.querySelectorAll('#opt-resolution .opt-card').forEach(c => {
        c.classList.toggle('active', parseInt(c.dataset.res) === state.streamConfig.resolution);
    });
    document.querySelectorAll('#opt-fps .opt-card').forEach(c => {
        c.classList.toggle('active', parseInt(c.dataset.fps) === state.streamConfig.fps);
    });

    const titleEl = document.getElementById('stream-modal-title');
    const confirmBtn = document.getElementById('btn-confirm-stream');
    const switchBtn = document.getElementById('btn-switch-screen-source');

    if (editMode && state.isStreaming) {
        if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-sliders"></i> Editar Transmissão Ao Vivo';
        if (confirmBtn) confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> Aplicar Sem Desligar';
        if (switchBtn) switchBtn.style.display = 'inline-flex';
    } else {
        if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-display"></i> Transmissão de Tela em 60 FPS';
        if (confirmBtn) confirmBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Começar a Transmitir (60 FPS)';
        if (switchBtn) switchBtn.style.display = 'none';
    }

    streamModal.style.display = 'flex';
}

async function updateLiveStreamSettings() {
    if (!state.isStreaming || !state.localScreenStream) return;

    const res = state.streamConfig.resolution || 1080;
    const fps = state.streamConfig.fps || 60;
    const width = res === 1440 ? 2560 : (res === 1080 ? 1920 : 1280);
    const height = res === 1440 ? 1440 : (res === 1080 ? 1080 : 720);
    state.streamConfig.bitrate = getOptimalBitrate(res, fps);

    const vTrack = state.localScreenStream.getVideoTracks()[0];
    if (vTrack) {
        if ('contentHint' in vTrack) vTrack.contentHint = 'motion';
        try {
            await vTrack.applyConstraints({
                width: { ideal: width, max: width },
                height: { ideal: height, max: height },
                frameRate: { ideal: fps, min: Math.min(30, fps), max: fps }
            });
        } catch (err) {
            console.warn('Fallback applyConstraints:', err);
            try {
                await vTrack.applyConstraints({ frameRate: { ideal: fps, max: fps } });
            } catch (e2) {}
        }
    }

    // Atualiza bitrate, framerate e degradationPreference em todos os peers sem derrubar a live!
    for (const pc of state.peerConnections.values()) {
        for (const sender of pc.getSenders()) {
            if (sender.track && sender.track.kind === 'video') {
                await optimizeSenderBitrate(sender);
            }
        }
    }

    const newInfo = { resolution: `${res}p`, fps: fps };
    const mySt = state.activeStreams.get(state.userId);
    if (mySt) mySt.info = newInfo;
    if (state.currentlyWatchingUserId === state.userId) {
        const resBadge = document.getElementById('hud-res');
        if (resBadge) resBadge.textContent = `${res}p`;
        const brBadge = document.getElementById('hud-bitrate');
        if (brBadge) brBadge.textContent = `${(state.streamConfig.bitrate / 1000).toFixed(1)} Mbps`;
        const fpsBadge = document.getElementById('hud-fps');
        if (fpsBadge) fpsBadge.textContent = `${fps}.0 FPS`;
    }

    sendWs({
        type: 'screen_update',
        streamInfo: newInfo
    });

    showToast(`⚡ Live atualizada para <b>${res}p ${fps} FPS</b> sem desligar!`, 4000);
}

async function switchLiveScreenSource() {
    if (!state.isStreaming || !state.localScreenStream) {
        startScreenShare();
        return;
    }

    const res = state.streamConfig.resolution || 1080;
    const fps = state.streamConfig.fps || 60;
    const width = res === 1440 ? 2560 : (res === 1080 ? 1920 : 1280);
    const height = res === 1440 ? 1440 : (res === 1080 ? 1080 : 720);
    state.streamConfig.bitrate = getOptimalBitrate(res, fps);

    let newStream = null;
    try {
        newStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                frameRate: { ideal: fps, min: Math.min(30, fps), max: fps },
                width: { ideal: width, max: width },
                height: { ideal: height, max: height },
                cursor: 'always'
            },
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false,
                channelCount: 2,
                sampleRate: 48000,
                suppressLocalAudioPlayback: false
            },
            systemAudio: 'include',
            windowAudio: 'window',
            selfBrowserSurface: 'include',
            surfaceSwitching: 'include'
        });
    } catch (err) {
        if (err.name !== 'NotAllowedError') {
            showToast('❌ Não foi possível trocar a janela da live: ' + err.message);
        }
        return;
    }

    const oldStream = state.localScreenStream;
    const newVideoTrack = newStream.getVideoTracks()[0];
    const newAudioTrack = newStream.getAudioTracks()[0] || null;
    if (newVideoTrack && 'contentHint' in newVideoTrack) {
        newVideoTrack.contentHint = 'motion';
    }

    // Troca a faixa de vídeo (e áudio da tela) em todos os peers sem desconectar ninguém!
    for (const pc of state.peerConnections.values()) {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender && newVideoTrack) {
            try {
                await videoSender.replaceTrack(newVideoTrack);
                await optimizeSenderBitrate(videoSender);
            } catch (e) {}
        }
        if (newAudioTrack) {
            const screenAudioSender = senders.find(s => s.track && s.track.kind === 'audio' && oldStream.getAudioTracks().includes(s.track));
            if (screenAudioSender) {
                try { await screenAudioSender.replaceTrack(newAudioTrack); } catch (e) {}
            }
        }
    }

    state.localScreenStream = newStream;
    if (newVideoTrack) newVideoTrack.onended = () => stopScreenShare();

    // Atualiza o preview local e o mapa de streams sem fechar o palco
    const newInfo = { resolution: `${res}p`, fps: fps };
    addStream(state.userId, newStream, state.username + ' (Você)', newInfo);

    // Encerra as faixas antigas com segurança após a troca
    if (oldStream) {
        oldStream.getTracks().forEach(t => {
            try { t.onended = null; t.stop(); } catch (e) {}
        });
    }

    sendWs({
        type: 'screen_update',
        streamInfo: newInfo
    });

    showToast(`🔄 Tela/Jogo da live trocado para <b>${res}p ${fps} FPS</b> sem desligar!`, 4000);
}

function stopScreenShare() {
    if (state.localScreenStream) {
        state.localScreenStream.getTracks().forEach(t => t.stop());
        state.localScreenStream = null;
    }
    state.isStreaming = false;

    const btn = document.getElementById('btn-stream-toggle');
    if (btn) btn.classList.remove('streaming');
    const btnText = document.getElementById('btn-stream-text');
    if (btnText) btnText.textContent = 'Transmitir Tela';
    ['btn-stream-edit', 'btn-hud-edit-stream', 'btn-vc-edit-stream'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    removeStream(state.userId);
    sendWs({ type: 'screen_stop' });
}


// --- CONTROLE DE ASSISTIR / PARAR DE ASSISTIR TRANSMISSÃO & FILME (PERMANECENDO NA CALL) ---
function stopWatchingLocal(notifyToast = true) {
    state.isWatchingStream = false;
    state.currentlyWatchingUserId = null;

    // Pausa e desanexa o vídeo de cinema/IPTV localmente (sem parar para os outros na sala)
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

    // Pausa o elemento de vídeo no palco
    const video = document.getElementById('stage-video');
    if (video) {
        try { video.pause(); } catch (e) {}
        video.srcObject = null;
        video.src = '';
    }

    // Oculta o palco de vídeo para dar espaço total ao chat
    const stage = document.getElementById('video-stage');
    if (stage) stage.style.display = 'none';

    stopFpsCounter();
    renderStreamTabs();
    updateWatchButtonsVisibility();

    if (notifyToast) {
        const isCinema = state.currentVoiceChannel && state.currentVoiceChannel.startsWith('cinema-');
        showToast(`👁️ Você parou de assistir ao ${isCinema ? 'filme' : 'streaming'}. Você continua na chamada de voz!`, 4000);
    }
}

function resumeWatchingLocal() {
    state.isWatchingStream = true;

    // Se estiver em sala de cinema com transmissão IPTV ativa:
    if (state.currentVoiceChannel && state.currentVoiceChannel.startsWith('cinema-')) {
        const cinema = state.cinemaRooms ? state.cinemaRooms[state.currentVoiceChannel] : null;
        if (cinema) {
            playCinemaStream(cinema);
            updateWatchButtonsVisibility();
            showToast('🎬 Conectando à transmissão do filme...', 3000);
            return;
        }
    }

    // Se houver transmissões de tela ativas de outros usuários:
    if (state.activeStreams && state.activeStreams.size > 0) {
        const firstUid = Array.from(state.activeStreams.keys())[0];
        selectLiveStream(firstUid);
        updateWatchButtonsVisibility();
        showToast('📺 Conectando à transmissão ao vivo...', 3000);
        return;
    }

    showToast('ℹ️ Não há transmissão ativa nesta sala no momento.');
}

function updateWatchButtonsVisibility() {
    const isCinema = state.currentVoiceChannel && state.currentVoiceChannel.startsWith('cinema-');
    const hasCinemaStream = isCinema && !!(state.cinemaRooms && state.cinemaRooms[state.currentVoiceChannel]);
    const hasUserStream = state.activeStreams && state.activeStreams.size > 0;
    const hasAnyStream = hasCinemaStream || hasUserStream;

    const btnResume = document.getElementById('btn-resume-watching');
    const btnVoiceWatch = document.getElementById('btn-voice-watch-toggle');
    const btnHudStop = document.getElementById('btn-hud-stop-watching');
    const btnVcStop = document.getElementById('btn-vc-stop-watching');

    if (!state.currentVoiceChannel || !hasAnyStream) {
        if (btnResume) btnResume.style.display = 'none';
        if (btnVoiceWatch) btnVoiceWatch.style.display = 'none';
        if (btnHudStop) btnHudStop.style.display = 'none';
        if (btnVcStop) btnVcStop.style.display = 'none';
        return;
    }

    const isCurrentlyWatching = (state.isWatchingStream !== false) && (
        (isCinema && hasCinemaStream && (state.mpegtsInstance || state.hlsInstance || (document.getElementById('stage-video') && document.getElementById('stage-video').src))) ||
        (!isCinema && !!state.currentlyWatchingUserId)
    );

    const streamLabel = hasCinemaStream ? 'Filme' : 'Live';

    if (btnResume) {
        btnResume.style.display = isCurrentlyWatching ? 'none' : 'inline-flex';
        const span = btnResume.querySelector('span');
        if (span) span.textContent = `Assistir ${streamLabel}`;
    }

    if (btnVoiceWatch) {
        btnVoiceWatch.style.display = 'inline-flex';
        if (isCurrentlyWatching) {
            btnVoiceWatch.style.backgroundColor = 'rgba(242, 63, 67, 0.15)';
            btnVoiceWatch.style.borderColor = '#f23f43';
            btnVoiceWatch.style.color = '#f23f43';
            btnVoiceWatch.innerHTML = `<i class="fa-solid fa-eye-slash"></i> <span>Parar de Assistir</span>`;
        } else {
            btnVoiceWatch.style.backgroundColor = 'rgba(35, 165, 90, 0.15)';
            btnVoiceWatch.style.borderColor = '#23a55a';
            btnVoiceWatch.style.color = '#23a55a';
            btnVoiceWatch.innerHTML = `<i class="fa-solid fa-tv"></i> <span>Assistir ${streamLabel}</span>`;
        }
    }

    if (btnHudStop) {
        btnHudStop.style.display = isCurrentlyWatching ? 'inline-flex' : 'none';
    }
    if (btnVcStop) {
        btnVcStop.style.display = isCurrentlyWatching ? 'inline-flex' : 'none';
    }
}

// --- SELETOR DE MÚLTIPLAS LIVES (ESCOLHER QUAL ASSISTIR) ---
function addStream(userId, stream, username, info) {
    state.activeStreams.set(userId, { stream, username, info });
    renderStreamTabs();
    if (state.isWatchingStream !== false) {
        if (!state.currentlyWatchingUserId || state.currentlyWatchingUserId === userId) {
            selectLiveStream(userId);
        }
    }
    updateWatchButtonsVisibility();
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
    const shouldMute = (userId === state.userId) || state.userMutedLocally.has(userId);
    setStreamMuted(shouldMute);

    video.play().catch(() => {
        setStreamMuted(true);
        video.play().catch(() => {});
    });

    document.getElementById('hud-streamer-name').textContent = `Transmitido por: ${item.username}`;
    document.getElementById('hud-res').textContent = item.info ? `${item.info.resolution}` : '1440p (2K)';
    document.getElementById('hud-fps').textContent = item.info ? `${item.info.fps}.0 FPS` : '60.0 FPS';

    startFpsCounter(video);
    state.isWatchingStream = true;
    renderStreamTabs();
    updateWatchButtonsVisibility();
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
        const isActive = (uid === state.currentlyWatchingUserId && state.isWatchingStream !== false);
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

    if (state.activeStreams.size > 0 && state.isWatchingStream !== false) {
        const stopTab = document.createElement('button');
        stopTab.className = 'stream-tab-btn';
        stopTab.style.cssText = 'background: rgba(242, 63, 67, 0.15); border-color: rgba(242, 63, 67, 0.4); color: #f23f43;';
        stopTab.innerHTML = `<i class="fa-solid fa-eye-slash" style="font-size:11px;"></i> <span>Parar de Assistir</span>`;
        stopTab.onclick = () => stopWatchingLocal();
        container.appendChild(stopTab);
    }
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
    const targetAvatarUrl = isSelf ? state.avatarUrl : (user?.avatarUrl || '');
    applyAvatarToElement(av, name, avatar || '#5865F2', targetAvatarUrl);

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

    // Identifica se o alvo é o Dono supremo do servidor
    const isTargetOwner = (user && user.isOwner) || (name.toLowerCase() === 'dim') || (name.toLowerCase().startsWith('dim')) || (user?.userTag?.includes('4095'));
    const isTargetAdmin = !isTargetOwner && ((state.serverAdmins && state.serverAdmins.has(userId)) || (user && user.isAdmin));

    const isCurrentOwner = hasCurrentServerOwnerPowers();
    const isCurrentAdmin = (state.currentServerId && state.currentServerId !== 'default') ? !!state.isCurrentServerAdmin : !!state.isAdmin;

    // Opção de Moderação: Dossiê & Auditoria do Usuário (Dono ou ADM do servidor atual)
    const auditBtn = document.getElementById('ctx-btn-user-audit');
    if (auditBtn) {
        if ((isCurrentOwner || isCurrentAdmin) && !isSelf) {
            auditBtn.style.display = 'flex';
        } else {
            auditBtn.style.display = 'none';
        }
    }

    // EXCLUSIVO DO DONO SUPREMO (DIM): Dar ou Remover VIP — Donos de servidores particulares NÃO têm esse poder e NÃO ganham VIP!
    const toggleVipBtn = document.getElementById('ctx-btn-toggle-vip');
    if (toggleVipBtn) {
        if (state.isOwner && !isSelf) {
            toggleVipBtn.style.display = 'flex';
            const isTargetVip = state.vips ? state.vips.has(userId) : false;
            const vipEntry = state.vips ? state.vips.get(userId) : null;
            const isTrial = vipEntry && (vipEntry.isTrial || vipEntry.trialGranted);
            const icon = document.getElementById('ctx-vip-icon');
            const text = document.getElementById('ctx-vip-role-text');
            if (isTargetVip) {
                if (icon) icon.className = 'fa-solid fa-ban text-red';
                if (text) text.textContent = isTrial ? '❌ Revogar Trial 15D (Remover)' : '❌ Remover Acesso VIP';
                toggleVipBtn.style.color = '#ff3366';
            } else {
                if (icon) icon.className = 'fa-solid fa-crown text-gold';
                if (text) text.textContent = 'Conceder VIP (Dias / Vitalício)';
                toggleVipBtn.style.color = '#ffd700';
            }
        } else {
            toggleVipBtn.style.display = 'none';
        }
    }

    // Opção do Dono do servidor atual: Dar ou Remover cargo de ADM neste servidor
    const toggleAdminBtn = document.getElementById('ctx-btn-toggle-admin');
    if (toggleAdminBtn) {
        if (isCurrentOwner && !isSelf && !isTargetOwner) {
            toggleAdminBtn.style.display = 'flex';
            const icon = document.getElementById('ctx-admin-icon');
            const text = document.getElementById('ctx-admin-role-text');
            if (isTargetAdmin) {
                if (icon) icon.className = 'fa-solid fa-shield-slash text-red';
                if (text) text.textContent = 'Remover Cargo de ADM';
                toggleAdminBtn.classList.remove('text-green');
                toggleAdminBtn.classList.add('text-red');
            } else {
                if (icon) icon.className = 'fa-solid fa-shield-halved text-green';
                if (text) text.textContent = 'Dar Cargo de ADM';
                toggleAdminBtn.classList.remove('text-red');
                toggleAdminBtn.classList.add('text-green');
            }
        } else {
            toggleAdminBtn.style.display = 'none';
        }
    }

    // Opções de moderação (visíveis para Dono E Administradores do servidor atual, exceto contra o Dono supremo)
    const canModerate = (isCurrentOwner || isCurrentAdmin) && !isSelf && !isTargetOwner;
    const adminItems = document.querySelectorAll('.admin-only');
    adminItems.forEach(el => {
        el.style.display = canModerate ? 'flex' : 'none';
    });

    const stopStreamBtn = document.getElementById('ctx-btn-force-stop-stream');
    if (stopStreamBtn) {
        const isStreaming = user?.isStreaming || state.activeStreams.has(userId);
        stopStreamBtn.style.display = (canModerate && isStreaming) ? 'flex' : 'none';
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

function openUserProfileModal(userId) {
    if (!userId) return;
    const modal = document.getElementById('view-user-profile-modal');
    if (!modal) return;

    const isSelf = (userId === state.userId);
    const liveUser = state.users.get(userId);
    const memUser = state.serverMembers.get(userId);
    const user = Object.assign({}, memUser || {}, liveUser || {});

    const name = isSelf ? state.username : (user.username || 'Usuário');
    const tag = isSelf ? state.userTag : (user.userTag || '#6060');
    const avatarColor = isSelf ? (state.avatarColor || '#5865F2') : (user.avatar || user.avatarColor || '#5865F2');
    const avatarUrl = isSelf ? (state.avatarUrl || '') : (user.avatarUrl || memUser?.avatarUrl || '');
    const bannerUrl = isSelf ? (state.bannerUrl || '') : (user.bannerUrl || memUser?.bannerUrl || '');
    const isOnline = isSelf || (state.onlineUserIds && state.onlineUserIds.has(userId)) || !!liveUser;
    const rawStatus = isSelf ? (state.userStatus || 'online') : (isOnline ? (user.status || 'online') : 'offline');

    // Banner
    const bannerEl = document.getElementById('vup-banner');
    if (bannerEl) {
        if (bannerUrl) {
            bannerEl.style.backgroundImage = `url(${bannerUrl})`;
            bannerEl.style.backgroundSize = 'cover';
            bannerEl.style.backgroundPosition = 'center';
        } else {
            bannerEl.style.backgroundImage = '';
            bannerEl.style.background = `linear-gradient(135deg, ${avatarColor}, #5865f2)`;
        }
    }

    // Avatar
    const avEl = document.getElementById('vup-avatar');
    if (avEl) applyAvatarToElement(avEl, name, avatarColor, avatarUrl);

    // Status Dot + Texto
    const statusMap = {
        online: { color: '#23a55a', label: '🟢 Online' },
        idle: { color: '#f0b232', label: '🌙 Ausente' },
        dnd: { color: '#f23f43', label: '⛔ Não Perturbe' },
        invisible: { color: '#80848e', label: '⚫ Offline' },
        offline: { color: '#80848e', label: '⚫ Offline' }
    };
    const stInfo = statusMap[rawStatus] || statusMap.online;
    const dotEl = document.getElementById('vup-status-dot');
    if (dotEl) dotEl.style.background = stInfo.color;
    const stTextEl = document.getElementById('vup-status-text');
    if (stTextEl) stTextEl.textContent = stInfo.label;

    // Nome e Tag
    const nameEl = document.getElementById('vup-username');
    if (nameEl) nameEl.textContent = name + (isSelf ? ' (Você)' : '');
    const tagEl = document.getElementById('vup-tag');
    if (tagEl) tagEl.textContent = tag;

    // Badges (MESTRE, ADM, VIP)
    const badgesEl = document.getElementById('vup-badges');
    if (badgesEl) {
        const badges = [];
        const isTargetOwner = (user && user.isOwner) || (name.toLowerCase() === 'dim') || (name.toLowerCase().startsWith('dim')) || (String(tag).includes('4095'));
        const isTargetAdmin = !isTargetOwner && ((state.serverAdmins && state.serverAdmins.has(userId)) || (user && user.isAdmin));
        const vipEntry = state.vips ? state.vips.get(userId) : null;
        if (isTargetOwner) {
            badges.push(`<span style="background:linear-gradient(135deg,#ffd700,#ff8c00);color:#000;font-size:10px;font-weight:900;padding:3px 8px;border-radius:999px;">👑 MESTRE</span>`);
        }
        if (isTargetAdmin) {
            badges.push(`<span style="background:rgba(35,165,90,0.2);color:#23a55a;border:1px solid rgba(35,165,90,0.5);font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px;">🛡️ ADM</span>`);
        }
        if (vipEntry && !vipEntry.hideBadge) {
            const tier = typeof getVipTierBadge === 'function' ? getVipTierBadge(vipEntry) : { label: 'VIP', color: '#ffd700' };
            badges.push(`<span style="background:rgba(255,215,0,0.16);color:${tier.color || '#ffd700'};border:1px solid ${tier.color || '#ffd700'};font-size:10px;font-weight:800;padding:3px 8px;border-radius:999px;">👑 ${tier.label || 'VIP'}</span>`);
        }
        badgesEl.innerHTML = badges.join('');
    }

    // Atividade (Jogo) e Sala de Voz
    const actEl = document.getElementById('vup-activity-text');
    if (actEl) {
        const act = isSelf ? state.userActivity : user.activity;
        if (act && act.name) {
            actEl.style.display = 'block';
            actEl.textContent = `🎮 Jogando ${act.name}`;
        } else {
            actEl.style.display = 'none';
        }
    }
    const voiceEl = document.getElementById('vup-voice-text');
    if (voiceEl) {
        const vc = isSelf ? state.currentVoiceChannel : user.voiceChannel;
        if (vc) {
            voiceEl.style.display = 'block';
            voiceEl.textContent = `🎙️ Na sala de voz: ${vc}`;
        } else {
            voiceEl.style.display = 'none';
        }
    }

    // Membro desde
    const joinedEl = document.getElementById('vup-joined-at');
    if (joinedEl) {
        const ts = memUser?.joinedAt || user?.joinedAt;
        if (ts) {
            try {
                const d = new Date(ts * 1000);
                joinedEl.textContent = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
            } catch (e) {
                joinedEl.textContent = 'Membro registrado';
            }
        } else {
            joinedEl.textContent = 'Membro do VOX';
        }
    }

    // Botões de ação
    modal.dataset.userId = userId;
    modal.dataset.username = name;
    const watchBtn = document.getElementById('vup-btn-watch-stream');
    if (watchBtn) watchBtn.style.display = state.activeStreams.has(userId) ? 'inline-flex' : 'none';

    modal.style.display = 'flex';
}

function closeUserProfileModal() {
    const modal = document.getElementById('view-user-profile-modal');
    if (modal) modal.style.display = 'none';
}


// --- CONTROLE DE MUDO DA TRANSMISSÃO / TELA ---
function setStreamMuted(muted, volume = null) {
    const vid = document.getElementById('stage-video');
    const hudBtn = document.getElementById('btn-hud-mute-stream');
    const volBtn = document.getElementById('btn-vid-vol');
    const volSlider = document.getElementById('vid-volume-slider');

    // 1. Aplica no elemento de vídeo do palco
    if (vid) {
        vid.muted = muted;
        if (volume !== null) {
            vid.volume = volume;
        }
    }

    // 2. Aplica no elemento de áudio WebRTC do streamer atual
    if (state.currentlyWatchingUserId) {
        const audioEl = state.remoteAudioElements.get(state.currentlyWatchingUserId);
        if (audioEl) {
            audioEl.muted = muted;
            if (volume !== null) {
                audioEl.volume = volume;
            }
        }
    }

    // 3. Atualiza botão de volume nos controles inferiores
    if (volBtn) {
        volBtn.innerHTML = muted 
            ? '<i class="fa-solid fa-volume-xmark" style="color:#ed4245;"></i>' 
            : '<i class="fa-solid fa-volume-high"></i>';
        volBtn.title = muted ? 'Desmutar Transmissão' : 'Mutar Transmissão';
    }

    // 4. Atualiza botão de mudo no HUD superior
    if (hudBtn) {
        if (muted) {
            hudBtn.classList.add('is-muted');
            hudBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i> <span id="btn-hud-mute-text">Mutado</span>';
            hudBtn.title = 'Desmutar Áudio da Transmissão';
        } else {
            hudBtn.classList.remove('is-muted');
            hudBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> <span id="btn-hud-mute-text">Som da Live</span>';
            hudBtn.title = 'Mutar Áudio da Transmissão';
        }
    }

    // 5. Atualiza slider de volume
    if (volSlider) {
        if (muted) {
            volSlider.value = 0;
        } else if (volume !== null) {
            volSlider.value = volume;
        } else if (vid && vid.volume > 0) {
            volSlider.value = vid.volume;
        } else {
            volSlider.value = 1;
        }
    }
}

function applyUserVolume(userId) {
    const isMuted = state.isDeafened || state.userMutedLocally.has(userId);
    const audioEl = state.remoteAudioElements.get(userId);
    if (audioEl) {
        audioEl.muted = isMuted;
        if (!isMuted) {
            const vol = (state.userVolumes.get(userId) ?? 100) / 100;
            audioEl.volume = Math.min(1.0, Math.max(0, vol));
        }
    }

    // Se este usuário for o que estamos assistindo na transmissão, sincroniza o palco
    if (state.currentlyWatchingUserId === userId) {
        setStreamMuted(isMuted);
    }
}

// --- RENDERIZAÇÃO DOS USUÁRIOS NAS SALAS DE VOZ ---
function renderVoiceUsers() {
    const dynamicChannels = (state.channels?.voice || []).map(c => c.id);
    const defaultChannels = ['geral', 'jogos-60fps', 'competitivo', 'bate-papo', 'afk', 'cinema-1', 'cinema-2', 'cinema-3', 'cinema-4', 'cinema-5'];
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

    const isUserOwner = (userId === state.userId && state.isOwner) || (safeName.toLowerCase() === 'dim') || (safeName.toLowerCase().startsWith('dim'));
    const isUserAdmin = !isUserOwner && ((state.serverAdmins && state.serverAdmins.has(userId)) || (userId === state.userId && state.isAdmin));

    let roleIcon = '';
    if (isUserOwner) {
        roleIcon = '<i class="fa-solid fa-crown text-yellow" style="font-size:10px;margin-left:5px;" title="Dono"></i>';
    } else if (isUserAdmin) {
        roleIcon = '<i class="fa-solid fa-shield-halved text-green" style="font-size:10px;margin-left:5px;" title="Administrador"></i>';
    }

    const avUrl = getUserAvatarUrl(userId);
    row.innerHTML = `
        <div class="voice-user-avatar${isSpeaking ? ' speaking' : ''}" style="background:${color};overflow:hidden;">${renderAvatarInnerHtml(safeName, avUrl)}</div>
        <span>${escapeHtml(safeName)}${isSelf ? ' (Você)' : ''}</span>
        ${roleIcon}
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
        'cinema-1': '👑 Cinema 1 • Filmes (VIP)',
        'cinema-2': '👑 Cinema 2 • Séries (VIP)',
        'cinema-3': '👑 Cinema 3 • Futebol & TV (VIP)',
        'cinema-4': '👑 Cinema 4 • Lançamentos (VIP)',
        'cinema-5': '👑 Cinema 5 • VIP Extra',
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
    playDiscordVoiceLeaveSound();
    
    // Ao desconectar da sala de voz, encerra SEMPRE qualquer IPTV/Cinema e limpa passe temporário VIP
    state.vipGuestRoom = null;
    stopCinemaPlayback();
    state.activeStreams.clear();
    state.currentlyWatchingUserId = null;
    const stage = document.getElementById('video-stage');
    const video = document.getElementById('stage-video');
    if (video) {
        try { video.pause(); } catch(e){}
        video.srcObject = null;
        video.src = '';
    }
    if (stage) stage.style.display = 'none';
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

    // BLOQUEIO ANTECIPADO DE SALAS VIP / CINEMA NO CLIENTE
    const chLower = String(newChannel).toLowerCase();
    const isVipRoom = chLower.startsWith('cinema') || chLower.includes('vip') || chLower.includes('cinema');
    const hasGuestHere = (state.vipGuestRoom && state.vipGuestRoom === newChannel);

    if (isVipRoom && !state.isVip && !state.isOwner && !hasGuestHere) {
        openVipModal();
        if (typeof showToast === 'function') {
            showToast('⭐ Esta sala é exclusiva para Membros VIP! Compre seu Passe VIP para liberar o acesso.', 'warning');
        }
        return; // NÃO PERMITE ENTRAR!
    }

    if (state.vipGuestRoom && newChannel !== state.vipGuestRoom) {
        state.vipGuestRoom = null;
    }
    if (!chLower.includes('cinema-')) {
        stopCinemaPlayback();
    }

    const oldChannel = state.currentVoiceChannel;
    state.currentVoiceChannel = newChannel;
    playDiscordVoiceJoinSound();
    state.isWatchingStream = true;
    updateWatchButtonsVisibility();
    document.querySelectorAll('.voice-channel').forEach(el => {
        el.classList.toggle('active', el.dataset.channel === newChannel);
    });

    const chNames = {
        'geral': '🔊 Geral',
        'jogos-60fps': '🎮 Jogos 60FPS',
        'cinema-1': '👑 Cinema 1 • Filmes (VIP)',
        'cinema-2': '👑 Cinema 2 • Séries (VIP)',
        'cinema-3': '👑 Cinema 3 • Futebol & TV (VIP)',
        'cinema-4': '👑 Cinema 4 • Lançamentos (VIP)',
        'cinema-5': '👑 Cinema 5 • VIP Extra',
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
    applyAvatarToElement(av, inputVal, state.avatarColor, state.avatarUrl);
    const remBtn = document.getElementById('btn-remove-avatar-photo');
    if (remBtn) remBtn.style.display = state.avatarUrl ? 'inline-flex' : 'none';

    const bannerEl = document.getElementById('settings-preview-banner');
    if (bannerEl) {
        if (state.bannerUrl) {
            bannerEl.style.backgroundImage = `url(${state.bannerUrl})`;
            bannerEl.style.backgroundSize = 'cover';
            bannerEl.style.backgroundPosition = 'center';
        } else {
            bannerEl.style.backgroundImage = '';
            bannerEl.style.background = `linear-gradient(135deg, ${state.avatarColor || '#00f2fe'}, #5865f2)`;
        }
    }
    const remBannerBtn = document.getElementById('btn-remove-banner-photo');
    if (remBannerBtn) remBannerBtn.style.display = state.bannerUrl ? 'inline-flex' : 'none';
}

function saveUserProfile() {
    const newName = document.getElementById('input-username').value.trim();
    if (newName && newName !== state.username) {
        state.username = newName;
        localStorage.setItem('dc_username', newName);
        localStorage.setItem('vox_username', newName);
    }

    if (state.username.toUpperCase() === 'DIM' || state.username.toUpperCase().startsWith('DIM')) {
        state.userTag = '#4095';
        state.isOwner = true;
    }
    localStorage.setItem('vox_user_tag', state.userTag);
    localStorage.setItem('dc_tag', state.userTag);
    localStorage.setItem('dc_avatar', state.avatarColor);
    try {
        if (state.avatarUrl) localStorage.setItem('vox_avatar_url', state.avatarUrl);
        else localStorage.removeItem('vox_avatar_url');
        if (state.bannerUrl) localStorage.setItem('vox_banner_url', state.bannerUrl);
        else localStorage.removeItem('vox_banner_url');
    } catch (e) {}

    const profileObj = {
        userId: state.userId,
        username: state.username,
        avatarColor: state.avatarColor,
        avatarUrl: state.avatarUrl || '',
        bannerUrl: state.bannerUrl || '',
        userTag: state.userTag
    };
    localStorage.setItem('kord_user_profile', JSON.stringify(profileObj));
    localStorage.setItem('discord_user_profile', JSON.stringify(profileObj));

    // Atualiza UI própria
    document.getElementById('my-username').textContent = state.username;
    const myAv = document.getElementById('my-avatar');
    applyAvatarToElement(myAv, state.username, state.avatarColor, state.avatarUrl);

    // Notifica o servidor e todos os amigos conectados
    sendWs({
        type: 'update_profile',
        username: state.username,
        avatar: state.avatarColor,
        avatarUrl: state.avatarUrl || '',
        bannerUrl: state.bannerUrl || ''
    });

    renderVoiceUsers();
    renderMembersSidebar();
    renderStreamTabs();
    closeUserSettingsModal();
    showToast(`✅ Perfil atualizado e salvo na nuvem!`);
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
    const time = data.timestamp || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const isAuthorOwner = data.isOwner || (data.username && data.username.trim().toLowerCase() === 'dim') || (data.username && data.username.trim().toLowerCase().startsWith('dim'));
    const isAuthorAdmin = !isAuthorOwner && (data.isAdmin || (state.serverAdmins && state.serverAdmins.has(data.senderId)));

    let roleBadge = '';
    if (isAuthorOwner) {
        roleBadge = '<span class="badge-role-dono"><i class="fa-solid fa-crown"></i> DONO</span>';
    } else if (isAuthorAdmin) {
        roleBadge = '<span class="badge-role-adm"><i class="fa-solid fa-shield-halved"></i> ADM</span>';
    }

    const msgAvUrl = getUserAvatarUrl(data.senderId, data);
    row.innerHTML = `
        <div class="chat-avatar" style="background:${data.avatar};overflow:hidden;">${renderAvatarInnerHtml(data.username, msgAvUrl)}</div>
        <div class="chat-content">
            <div style="display:flex;align-items:center;gap:6px;">
                <span class="chat-author" style="cursor:pointer;">${escapeHtml(data.username)}</span>
                ${roleBadge}
                ${isAuthorOwner ? '' : getVipBadgeHtml(data.senderId, data)}
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
    if (window.voxPrefs && window.voxPrefs.showToasts === false) return;
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

// --- SONS DE VOZ IDÊNTICOS AO DISCORD (SINTETIZADOS WEB AUDIO API) ---
function playDiscordVoiceJoinSound() {
    if (window.voxPrefs && window.voxPrefs.soundVoice === false) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.25, now);
        masterGain.connect(ctx.destination);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2600, now);
        filter.connect(masterGain);

        // Som de Conexão à Sala de Voz do Discord:
        // Chime ascendente duplo com afinação quente (D5 587Hz -> A5 880Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.40, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(filter);
        osc1.start(now);
        osc1.stop(now + 0.19);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.08);
        gain2.gain.setValueAtTime(0, now + 0.08);
        gain2.gain.linearRampToValueAtTime(0.45, now + 0.10);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        osc2.connect(gain2);
        gain2.connect(filter);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.40);

        // Corpo harmônico suave estilo Discord
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(293.66, now);
        sub.frequency.setValueAtTime(440, now + 0.08);
        subGain.gain.setValueAtTime(0.08, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        sub.connect(subGain);
        subGain.connect(filter);
        sub.start(now);
        sub.stop(now + 0.38);
    } catch (e) {}
}

function playDiscordVoiceLeaveSound() {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        if (ctx.state === 'suspended') ctx.resume();

        const now = ctx.currentTime;
        const masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(0.25, now);
        masterGain.connect(ctx.destination);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2400, now);
        filter.connect(masterGain);

        // Som de Desconexão da Sala de Voz do Discord:
        // Chime descendente duplo (A5 880Hz / G5 784Hz -> D5 587Hz / E5 659Hz -> G4 392Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(783.99, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.40, now + 0.02);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(filter);
        osc1.start(now);
        osc1.stop(now + 0.19);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(440, now + 0.08);
        gain2.gain.setValueAtTime(0, now + 0.08);
        gain2.gain.linearRampToValueAtTime(0.45, now + 0.10);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.40);
        osc2.connect(gain2);
        gain2.connect(filter);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.42);

        // Sub harmônico suave
        const sub = ctx.createOscillator();
        const subGain = ctx.createGain();
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(392, now);
        sub.frequency.setValueAtTime(220, now + 0.08);
        subGain.gain.setValueAtTime(0.08, now);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        sub.connect(subGain);
        subGain.connect(filter);
        sub.start(now);
        sub.stop(now + 0.40);
    } catch (e) {}
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
    const sidebar = document.getElementById('members-sidebar');
    if (!sidebar) return;

    let listMestre = document.getElementById('members-list-mestre');
    let listAdm = document.getElementById('members-list-adm');
    let listVip = document.getElementById('members-list-vip');
    let listDisponiveis = document.getElementById('members-list-disponiveis');
    let listOffline = document.getElementById('members-list-offline');

    // AUTO-RECUPERAÇÃO: Se os contêineres não existirem no HTML, recria dinamicamente na hora!
    if (!listMestre || !listDisponiveis || !listOffline) {
        sidebar.innerHTML = `
            <div class="members-section" id="section-mestre" style="display: none;">
                <div class="members-section-header header-mestre" style="color:#ffd700;font-size:11px;font-weight:800;padding:8px 12px;text-transform:uppercase;letter-spacing:0.5px;">
                    <span>🧙‍♂️ MESTRE DOS MAGOS — <b id="count-mestre">0</b></span>
                </div>
                <div class="members-list" id="members-list-mestre" style="display:flex;flex-direction:column;gap:2px;"></div>
            </div>

            <div class="members-section" id="section-adm" style="display: none; margin-top: 10px;">
                <div class="members-section-header header-adm" style="color:#60a5fa;font-size:11px;font-weight:800;padding:8px 12px;text-transform:uppercase;letter-spacing:0.5px;">
                    <span>🛡️ ADM — <b id="count-adm">0</b></span>
                </div>
                <div class="members-list" id="members-list-adm" style="display:flex;flex-direction:column;gap:2px;"></div>
            </div>

            <div class="members-section" id="section-vip" style="display: none; margin-top: 10px;">
                <div class="members-section-header header-vip" style="color:#f59e0b;font-size:11px;font-weight:800;padding:8px 12px;text-transform:uppercase;letter-spacing:0.5px;">
                    <span>👑 VIP — <b id="count-vip">0</b></span>
                </div>
                <div class="members-list" id="members-list-vip" style="display:flex;flex-direction:column;gap:2px;"></div>
            </div>

            <div class="members-section" id="section-disponiveis" style="display: none; margin-top: 10px;">
                <div class="members-section-header header-disponiveis" style="color:#22c55e;font-size:11px;font-weight:800;padding:8px 12px;text-transform:uppercase;letter-spacing:0.5px;">
                    <span>🟢 DISPONÍVEIS — <b id="count-disponiveis">0</b></span>
                </div>
                <div class="members-list" id="members-list-disponiveis" style="display:flex;flex-direction:column;gap:2px;"></div>
            </div>

            <div class="members-section" id="section-offline" style="display: none; margin-top: 14px;">
                <div class="members-section-header header-offline" style="color:#71717a;font-size:11px;font-weight:800;padding:8px 12px;text-transform:uppercase;letter-spacing:0.5px;">
                    <span>⚫ OFFLINE — <b id="count-offline">0</b></span>
                </div>
                <div class="members-list" id="members-list-offline" style="display:flex;flex-direction:column;gap:2px;"></div>
            </div>
        `;
        listMestre = document.getElementById('members-list-mestre');
        listAdm = document.getElementById('members-list-adm');
        listVip = document.getElementById('members-list-vip');
        listDisponiveis = document.getElementById('members-list-disponiveis');
        listOffline = document.getElementById('members-list-offline');
    }

    if (listMestre) listMestre.innerHTML = '';
    if (listAdm) listAdm.innerHTML = '';
    if (listVip) listVip.innerHTML = '';
    if (listDisponiveis) listDisponiveis.innerHTML = '';
    if (listOffline) listOffline.innerHTML = '';

    const uniqueMap = new Map();

    // 1. Adiciona todos os membros salvos do servidor
    if (state.serverMembers) {
        state.serverMembers.forEach(m => uniqueMap.set(m.id, { ...m }));
    }

    // 2. Adiciona todos os usuários online no momento
    if (state.users) {
        state.users.forEach(u => {
            if (!uniqueMap.has(u.id)) {
                uniqueMap.set(u.id, {
                    id: u.id,
                    username: u.username,
                    avatar: u.avatar || '#5865F2',
                    userTag: u.userTag || '',
                    status: u.status || 'online',
                    activity: u.activity || null
                });
            } else {
                const existing = uniqueMap.get(u.id);
                existing.status = u.status || existing.status || 'online';
                existing.activity = u.activity || existing.activity || null;
            }
        });
    }

    // 3. GARANTIA ABSOLUTA: O usuário atual está no mapa de membros (EXCETO quando Dono Supremo DIM está inspecionando servidor particular de outra pessoa)
    const isCustomServer = state.currentServerId && state.currentServerId !== 'default';
    const isInspectingPrivate = isCustomServer && state.currentServerMemberIds && !state.currentServerMemberIds.has(state.userId);
    const currentName = state.username || 'DIM';
    const isMeDim = currentName.trim().toUpperCase() === 'DIM' || currentName.trim().toUpperCase().startsWith('DIM') || (state.userTag && state.userTag.includes('4095')) || state.isOwner;
    
    if (!isInspectingPrivate) {
        if (!uniqueMap.has(state.userId)) {
            uniqueMap.set(state.userId, {
                id: state.userId,
                username: currentName,
                avatar: state.avatarColor || '#5865F2',
                userTag: state.userTag || (isMeDim ? '#4095' : '#6060'),
                status: state.userStatus || 'online',
                activity: state.userActivity || null,
                isMaster: isMeDim,
                isOwner: isMeDim || state.isOwner
            });
        } else {
            const myEntry = uniqueMap.get(state.userId);
            myEntry.username = currentName;
            myEntry.userTag = state.userTag || myEntry.userTag;
            myEntry.status = state.userStatus || myEntry.status;
            myEntry.activity = state.userActivity || myEntry.activity;
            if (isMeDim) {
                myEntry.isMaster = true;
                myEntry.isOwner = true;
            }
        }
    }

    // 4. ISOLAMENTO DE MEMBROS POR SERVIDOR: Em servidores particulares, mostra APENAS usuários cadastrados naquele servidor (online e offline)!
    if (isCustomServer) {
        if (Array.isArray(state.currentServerMemberProfiles)) {
            state.currentServerMemberProfiles.forEach(mp => {
                if (mp && mp.id && !uniqueMap.has(mp.id)) {
                    uniqueMap.set(mp.id, { ...mp });
                }
            });
        }
        if (state.currentServerMemberIds) {
            for (const uid of Array.from(uniqueMap.keys())) {
                if (!state.currentServerMemberIds.has(uid)) {
                    uniqueMap.delete(uid);
                }
            }
        }
    }

    // Atualiza título da seção de Dono/Mestre conforme o servidor atual
    const headerMestreSpan = document.querySelector('#section-mestre .header-mestre span');
    if (headerMestreSpan) {
        const countEl = document.getElementById('count-mestre');
        const curCount = countEl ? countEl.textContent : '0';
        headerMestreSpan.innerHTML = isCustomServer
            ? `👑 DONO DO SERVIDOR — <b id="count-mestre">${curCount}</b>`
            : `🧙‍♂️ MESTRE DOS MAGOS — <b id="count-mestre">${curCount}</b>`;
    }

    let countMestre = 0;
    let countAdm = 0;
    let countVip = 0;
    let countDisponiveis = 0;
    let countOffline = 0;

    uniqueMap.forEach(member => {
        const isMe = (member.id === state.userId);
        const liveUser = state.users ? state.users.get(member.id) : null;
        const userStatus = isMe ? (state.userStatus || 'online') : (liveUser?.status || member.status || 'online');
        const userActivity = isMe ? (state.userActivity || liveUser?.activity || member.activity || null) : (liveUser?.activity || member.activity || null);

        // Se o usuário estiver invisível e não for eu mesmo, aparece offline para os outros
        let isOnline = isMe ? (state.userStatus !== 'invisible' && state.userStatus !== 'offline') : ((state.onlineUserIds && state.onlineUserIds.has(member.id)) || (state.users && state.users.has(member.id)));
        if (!isMe && (userStatus === 'invisible' || userStatus === 'offline')) {
            isOnline = false;
        }

        const row = document.createElement('div');
        row.className = 'member-row';
        row.setAttribute('data-user-id', member.id);
        row.style.cursor = 'pointer';
        row.oncontextmenu = (e) => openUserContextMenu(e, member.id);
        const memberBannerUrl = isMe
            ? (state.bannerUrl || liveUser?.bannerUrl || member.bannerUrl || '')
            : (liveUser?.bannerUrl || member.bannerUrl || '');
        if (memberBannerUrl) {
            row.classList.add('has-banner');
            row.style.backgroundImage = `linear-gradient(90deg, rgba(12,15,24,0.68) 0%, rgba(12,15,24,0.34) 55%, rgba(12,15,24,0.18) 100%), url("${memberBannerUrl}")`;
        }
        const nameDisplay = isMe ? `${escapeHtml(member.username)} (Você)` : escapeHtml(member.username);
        const avatarLetter = (member.username || 'U')[0].toUpperCase();
        const color = member.avatar || '#5865F2';

        const vState = (state.voiceStates && state.voiceStates.get(member.id)) || (isMe ? { isMuted: state.isMuted, isDeafened: state.isDeafened, isSpeaking: false } : { isMuted: false, isDeafened: false, isSpeaking: false });
        const isMuted = !!vState.isMuted;
        const isDeafened = !!vState.isDeafened;
        const isSpeaking = !!vState.isSpeaking;

        // Classificação: MESTRE DOS MAGOS (ou DONO DO SERVIDOR particular) > ADM > VIP > DISPONÍVEIS > OFFLINE
        const mNameLower = (member.username || '').trim().toLowerCase();
        const isMemberMestre = isCustomServer
            ? (state.currentServerOwnerId && member.id === state.currentServerOwnerId)
            : (mNameLower === 'dim' ||
               mNameLower.startsWith('dim') ||
               (member.userTag && member.userTag.includes('4095')) ||
               member.isMaster ||
               (isMe && isMeDim));

        const isMemberAdmin = !isMemberMestre && (
            isCustomServer
                ? (state.currentServerAdmins && state.currentServerAdmins.has(member.id))
                : (member.isAdmin || (state.serverAdmins && state.serverAdmins.has(member.id)) || member.isOwner)
        );
        const vipEntryForCat = state.vips ? state.vips.get(member.id) : null;
        const hasVisibleVip = !!(vipEntryForCat?.isVip && !(vipEntryForCat?.isTrial && vipEntryForCat?.hideBadge));
        const isMemberVip = !isMemberMestre && !isMemberAdmin && hasVisibleVip;

        let roleBadge = '';
        if (isMemberMestre) {
            roleBadge = isCustomServer
                ? '<span class="badge-role-mestre" title="Dono do Servidor"><i class="fa-solid fa-crown"></i> DONO</span>'
                : '<span class="badge-role-mestre" title="Mestre dos Magos"><i class="fa-solid fa-crown"></i> MESTRE</span>';
        } else if (isMemberAdmin) {
            roleBadge = '<span class="badge-role-adm" title="Administrador"><i class="fa-solid fa-shield-halved"></i> ADM</span>';
        }

        const vipEntry = state.vips ? state.vips.get(member.id) : null;
        const hasVipPass = isMemberMestre || (state.vips ? state.vips.has(member.id) : false) || member.isVip;
        const isTrialVip = !isMemberMestre && (vipEntry?.isTrial || member.isTrial);
        const hideBadge = !isMemberMestre && (vipEntry?.hideBadge || false);

        let vipBadge = '';
        if (!isMemberMestre && hasVipPass) {
            vipBadge = getVipBadgeHtml(member.id, member);
        }

        // Classe do ponto de status (online, dnd, idle, offline)
        let dotClass = 'offline';
        if (isOnline) {
            if (userStatus === 'dnd') dotClass = 'dnd';
            else if (userStatus === 'idle') dotClass = 'idle';
            else dotClass = 'online';
        }

        // Subtítulo de Atividade Gamer / Filmes
        let activityHtml = '';
        if (isOnline && userActivity && userActivity.name) {
            const icon = userActivity.type === 'watching' ? 'fa-solid fa-film' :
                         userActivity.type === 'listening' ? 'fa-solid fa-headphones' :
                         'fa-solid fa-gamepad';
            const prefix = userActivity.type === 'watching' ? 'Assistindo' :
                           userActivity.type === 'listening' ? 'Ouvindo' :
                           'Jogando';
            const iconColor = userActivity.type === 'watching' ? '#a855f7' : '#22c55e';
            activityHtml = `<div class="member-activity-sub" title="${escapeHtml(userActivity.name)}" style="display:flex;align-items:center;gap:4px;font-size:11px;color:#b5bac1;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                <i class="${icon}" style="color:${iconColor};font-size:10px;flex-shrink:0;"></i>
                <span style="overflow:hidden;text-overflow:ellipsis;">${prefix} <strong style="color:#ffffff;">${escapeHtml(userActivity.name)}</strong></span>
            </div>`;
        }

        const memAvUrl = getUserAvatarUrl(member.id, member);
        row.innerHTML = `
            <div class="member-avatar-wrap">
                <div class="member-avatar" style="background-color: ${color};overflow:hidden;">${renderAvatarInnerHtml(member.username, memAvUrl)}</div>
                <div class="member-status-dot ${dotClass}"></div>
            </div>
            <div class="member-info-col" style="display:flex;flex-direction:column;min-width:0;flex:1;">
                <div class="member-name-wrap" style="display:flex;align-items:center;flex-wrap:wrap;">
                    <span class="member-name ${isOnline ? 'online' : 'offline'}">${nameDisplay}</span>
                    ${roleBadge}
                    ${vipBadge}
                    <span class="voice-speaking-dot${isSpeaking ? ' active' : ''}" style="margin-left:5px;"></span>
                    ${isDeafened ? '<i class="fa-solid fa-ear-deaf voice-deafen-icon" title="Ensurdecido (Áudio Desativado)" style="font-size:10px;margin-left:5px;color:#f23f43;"></i>' : ''}
                    ${isMuted ? '<i class="fa-solid fa-microphone-slash voice-mute-icon" title="Mutado" style="font-size:10px;margin-left:5px;color:#f23f43;"></i>' : ''}
                </div>
                ${activityHtml}
            </div>
        `;

        if (!isOnline) {
            countOffline++;
            if (listOffline) listOffline.appendChild(row);
        } else if (isMemberMestre) {
            countMestre++;
            if (listMestre) listMestre.appendChild(row);
        } else if (isMemberAdmin) {
            countAdm++;
            if (listAdm) listAdm.appendChild(row);
        } else if (isMemberVip) {
            countVip++;
            if (listVip) listVip.appendChild(row);
        } else {
            countDisponiveis++;
            if (listDisponiveis) listDisponiveis.appendChild(row);
        }
    });

    const secMestre = document.getElementById('section-mestre');
    if (secMestre) secMestre.style.display = countMestre > 0 ? 'block' : 'none';
    const cntMestreEl = document.getElementById('count-mestre');
    if (cntMestreEl) cntMestreEl.textContent = countMestre;

    const secAdm = document.getElementById('section-adm');
    if (secAdm) secAdm.style.display = countAdm > 0 ? 'block' : 'none';
    const cntAdmEl = document.getElementById('count-adm');
    if (cntAdmEl) cntAdmEl.textContent = countAdm;

    const secVip = document.getElementById('section-vip');
    if (secVip) secVip.style.display = countVip > 0 ? 'block' : 'none';
    const cntVipEl = document.getElementById('count-vip');
    if (cntVipEl) cntVipEl.textContent = countVip;

    const secDisponiveis = document.getElementById('section-disponiveis');
    if (secDisponiveis) secDisponiveis.style.display = countDisponiveis > 0 ? 'block' : 'none';
    const cntDispEl = document.getElementById('count-disponiveis');
    if (cntDispEl) cntDispEl.textContent = countDisponiveis;

    const secOffline = document.getElementById('section-offline');
    if (secOffline) secOffline.style.display = countOffline > 0 ? 'block' : 'none';
    const cntOffEl = document.getElementById('count-offline');
    if (cntOffEl) cntOffEl.textContent = countOffline;
}

function checkRegistration() {
    const saved = localStorage.getItem('kord_user_profile') || localStorage.getItem('discord_user_profile');
    let isRegistered = false;
    if (saved) {
        try {
            const p = JSON.parse(saved);
            if (p.username && !p.username.startsWith('Jogador_')) {
                state.username = p.username;
                state.avatarColor = p.avatarColor || '#5865F2';
                state.userId = p.userId || state.userId;
                if (p.username.trim().toUpperCase() === 'DIM' || p.username.trim().toUpperCase().startsWith('DIM')) {
                    state.userTag = '#4095';
                    state.isOwner = true;
                } else if (p.userTag) {
                    state.userTag = p.userTag;
                }
                localStorage.setItem('vox_user_tag', state.userTag);
                localStorage.setItem('dc_tag', state.userTag);
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
    if (!state.avatarUrl) {
        try { state.avatarUrl = localStorage.getItem('vox_avatar_url') || ''; } catch (e) {}
    }
    if (!state.bannerUrl) {
        try { state.bannerUrl = localStorage.getItem('vox_banner_url') || ''; } catch (e) {}
    }
    const un = document.getElementById('my-username');
    const tag = document.getElementById('my-tag');
    const av = document.getElementById('my-avatar');
    if (un) un.textContent = state.username;
    if (tag) tag.textContent = state.userTag;
    applyAvatarToElement(av, state.username, state.avatarColor || '#5865F2', state.avatarUrl);
    updateOwnerUI();
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
        openStreamModal(false);
    });
    on('btn-stream-edit', 'click', () => {
        if (!state.isStreaming) return;
        openStreamModal(true);
    });
    on('btn-hud-edit-stream', 'click', (e) => {
        e.stopPropagation();
        if (!state.isStreaming) return;
        openStreamModal(true);
    });
    on('btn-vc-edit-stream', 'click', (e) => {
        e.stopPropagation();
        if (!state.isStreaming) return;
        openStreamModal(true);
    });
    on('btn-quick-stream', 'click', () => {
        if (state.currentVoiceChannel && state.currentVoiceChannel.startsWith('cinema-')) {
            showToast('🚫 <b>Transmissão de tela proibida no Cinema!</b><br>Use a sala 🎮 Jogos 60FPS para transmitir sua tela.', 5000);
            return;
        }
        openStreamModal(state.isStreaming);
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
        if (state.isStreaming) {
            updateLiveStreamSettings();
        } else {
            startScreenShare();
        }
    });

    on('btn-switch-screen-source', 'click', () => {
        if (streamModal) streamModal.style.display = 'none';
        switchLiveScreenSource();
    });

    // Controles de Transmissão dentro das Configurações (⚙️ -> Transmissão 60FPS)
    document.querySelectorAll('#settings-opt-resolution .opt-card').forEach(c => {
        c.onclick = () => {
            document.querySelectorAll('#settings-opt-resolution .opt-card').forEach(x => x.classList.remove('active'));
            c.classList.add('active');
            state.streamConfig.resolution = parseInt(c.dataset.res);
            if (state.isStreaming) updateLiveStreamSettings();
        };
    });
    document.querySelectorAll('#settings-opt-fps .opt-card').forEach(c => {
        c.onclick = () => {
            document.querySelectorAll('#settings-opt-fps .opt-card').forEach(x => x.classList.remove('active'));
            c.classList.add('active');
            state.streamConfig.fps = parseInt(c.dataset.fps);
            if (state.isStreaming) updateLiveStreamSettings();
        };
    });
    on('btn-settings-apply-live', 'click', () => {
        const settingsModal = document.getElementById('user-settings-modal');
        if (settingsModal) settingsModal.style.display = 'none';
        if (state.isStreaming) {
            updateLiveStreamSettings();
        } else {
            showToast('✅ Configurações salvas para sua próxima transmissão!');
        }
    });
    on('btn-settings-switch-screen', 'click', () => {
        const settingsModal = document.getElementById('user-settings-modal');
        if (settingsModal) settingsModal.style.display = 'none';
        if (state.isStreaming) {
            switchLiveScreenSource();
        } else {
            startScreenShare();
        }
    });

    // 4. Convidar Amigos (Abre Modal de Convite)
    on('btn-copy-invite', 'click', openInviteModal);
    on('btn-close-invite-modal', 'click', closeInviteModal);
    on('btn-copy-invite-modal', 'click', copyInviteLink);

    // 4.1 Instalar Aplicativo (Celular e PC)
    on('btn-open-install-modal', 'click', openInstallModal);
    on('btn-install-rail', 'click', openInstallModal);
    on('btn-close-install-modal', 'click', closeInstallModal);
    on('btn-trigger-pwa-install', 'click', triggerPwaInstall);

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
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
            });
            chatInput.value = '';
        }
    };
    if (sendBtn) sendBtn.onclick = doSend;
    if (chatInput) chatInput.onkeydown = (e) => { if (e.key === 'Enter') doSend(); };

    // 6. Controles de Áudio e Vídeo da Transmissão
    const volSlider = document.getElementById('vid-volume-slider');
    const vid = document.getElementById('stage-video');
    if (volSlider && vid) {
        volSlider.oninput = (e) => {
            const val = parseFloat(e.target.value);
            setStreamMuted(val === 0, val);
        };
    }
    on('btn-vid-vol', 'click', () => {
        const isMuted = vid ? vid.muted : false;
        setStreamMuted(!isMuted);
    });
    on('btn-hud-mute-stream', 'click', () => {
        const isMuted = vid ? vid.muted : false;
        setStreamMuted(!isMuted);
    });
    // --- AUTO-HIDE CONTROLES E HUD DE VÍDEO (MODO CINEMA LIMPO NO CELULAR E PC) ---
    let videoControlsTimer = null;

    function showVideoOverlays() {
        const stage = document.getElementById('video-stage');
        if (!stage) return;
        stage.classList.remove('controls-hidden');

        if (videoControlsTimer) clearTimeout(videoControlsTimer);
        videoControlsTimer = setTimeout(() => {
            const vid = document.getElementById('stage-video');
            const isPlaying = vid && !vid.paused;
            const isFs = stage.classList.contains('is-fullscreen');
            if (stage && (isPlaying || isFs)) {
                stage.classList.add('controls-hidden');
            }
        }, 2600);
    }

    function hideVideoOverlaysNow() {
        const stage = document.getElementById('video-stage');
        if (!stage) return;
        if (videoControlsTimer) clearTimeout(videoControlsTimer);
        stage.classList.add('controls-hidden');
    }

    function toggleVideoOverlays() {
        const stage = document.getElementById('video-stage');
        if (!stage) return;
        if (stage.classList.contains('controls-hidden')) {
            showVideoOverlays();
        } else {
            hideVideoOverlaysNow();
        }
    }

    function toggleVideoFullscreen(forceClose = false) {
        const stage = document.getElementById('video-stage');
        const vid = document.getElementById('stage-video');
        if (!stage) return;

        const isCurrentlyFs = stage.classList.contains('is-fullscreen') || !!document.fullscreenElement || !!document.webkitFullscreenElement;

        if (forceClose || isCurrentlyFs) {
            stage.classList.remove('is-fullscreen');
            stage.classList.remove('controls-hidden');
            if (document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
            if (window.screen && window.screen.orientation && window.screen.orientation.unlock) {
                window.screen.orientation.unlock().catch(() => {});
            }
            showToast('Saindo da tela cheia.');
        } else {
            stage.classList.add('is-fullscreen');
            if (stage.requestFullscreen) {
                stage.requestFullscreen().catch(() => {});
            } else if (vid && vid.requestFullscreen) {
                vid.requestFullscreen().catch(() => {});
            } else if (vid && vid.webkitEnterFullscreen) {
                vid.webkitEnterFullscreen();
            }
            if (window.screen && window.screen.orientation && window.screen.orientation.lock) {
                window.screen.orientation.lock('landscape').catch(() => {});
            }
            showToast('📺 Tela cheia ativada! Toque 1x para limpar a tela ou 2x para sair.');
            showVideoOverlays();
        }
    }

    on('btn-vid-fullscreen', 'click', () => toggleVideoFullscreen());
    on('btn-exit-fullscreen', 'click', () => toggleVideoFullscreen(true));

    const vidWrapper = document.querySelector('.video-player-wrapper');
    if (vidWrapper) {
        vidWrapper.addEventListener('mousemove', () => showVideoOverlays());
    }

    let vidTapCount = 0;
    let vidSingleTapTimer = null;
    if (vid) {
        vid.addEventListener('touchend', (e) => {
            if (e.target.closest('.video-controls') || e.target.closest('.stream-hud')) return;

            vidTapCount++;
            if (vidTapCount === 1) {
                vidSingleTapTimer = setTimeout(() => {
                    vidTapCount = 0;
                    toggleVideoOverlays();
                }, 280);
            } else if (vidTapCount === 2) {
                clearTimeout(vidSingleTapTimer);
                vidTapCount = 0;
                e.preventDefault();
                toggleVideoFullscreen();
            }
        });

        vid.addEventListener('click', (e) => {
            if (e.target.closest('.video-controls') || e.target.closest('.stream-hud')) return;
            toggleVideoOverlays();
        });

        vid.ondblclick = () => toggleVideoFullscreen();
    }

    // Play/Pause, Stop, -10s, +10s, Barra Temporal e Próximo Episódio (Filmes e Séries)
    const formatMediaTime = (sec) => {
        if (!isFinite(sec) || sec < 0) return '00:00';
        const s = Math.floor(sec % 60);
        const m = Math.floor((sec / 60) % 60);
        const h = Math.floor(sec / 3600);
        const pad = n => String(n).padStart(2, '0');
        return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
    };

    const canControlCurrentCinema = () => {
        const currentRoom = state.currentVoiceChannel;
        const cinema = (currentRoom && state.cinemaRooms) ? state.cinemaRooms[currentRoom] : null;
        if (!cinema) return false;
        return cinema.startedById === state.userId || state.isOwner;
    };

    const syncCinemaNow = () => {
        if (!vid || !state.currentVoiceChannel) return;
        sendWs({
            type: 'cinema_sync',
            room: state.currentVoiceChannel,
            currentTime: vid.currentTime || 0,
            isPlaying: !vid.paused
        });
    };

    on('btn-vid-play', 'click', (e) => {
        e.stopPropagation();
        if (!vid) return;
        if (!canControlCurrentCinema()) {
            showToast('🔒 Apenas quem iniciou o filme/série pode pausar ou mexer no tempo.');
            return;
        }
        const btnPlay = document.getElementById('btn-vid-play');
        if (vid.paused) {
            vid.play().then(() => {
                if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-pause"></i>';
                syncCinemaNow();
            }).catch(() => {});
        } else {
            vid.pause();
            if (btnPlay) btnPlay.innerHTML = '<i class="fa-solid fa-play"></i>';
            syncCinemaNow();
        }
    });

    on('btn-vid-stop', 'click', (e) => {
        e.stopPropagation();
        if (!canControlCurrentCinema()) {
            showToast('🔒 Apenas quem iniciou o filme/série pode parar a transmissão.');
            return;
        }
        stopCinemaStream();
    });

    on('btn-vid-back10', 'click', (e) => {
        e.stopPropagation();
        if (!vid) return;
        if (!canControlCurrentCinema()) {
            showToast('🔒 Apenas quem iniciou o filme/série pode voltar o tempo.');
            return;
        }
        vid.currentTime = Math.max(0, (vid.currentTime || 0) - 10);
        syncCinemaNow();
    });

    on('btn-vid-fwd10', 'click', (e) => {
        e.stopPropagation();
        if (!vid) return;
        if (!canControlCurrentCinema()) {
            showToast('🔒 Apenas quem iniciou o filme/série pode avançar o tempo.');
            return;
        }
        const maxDur = isFinite(vid.duration) ? vid.duration : (vid.currentTime || 0) + 10;
        vid.currentTime = Math.min(maxDur, (vid.currentTime || 0) + 10);
        syncCinemaNow();
    });

    on('btn-vid-prev-ep', 'click', (e) => {
        e.stopPropagation();
        if (!canControlCurrentCinema()) {
            showToast('🔒 Apenas quem iniciou a série pode voltar para o episódio anterior.');
            return;
        }
        if (typeof playPrevSeriesEpisode === 'function') {
            playPrevSeriesEpisode();
        }
    });

    on('btn-vid-next-ep', 'click', (e) => {
        e.stopPropagation();
        if (!canControlCurrentCinema()) {
            showToast('🔒 Apenas quem iniciou a série pode passar para o próximo episódio.');
            return;
        }
        if (typeof playNextSeriesEpisode === 'function') {
            playNextSeriesEpisode();
        }
    });

    const seekSlider = document.getElementById('vid-seek-slider');
    let isSeekingSlider = false;
    if (seekSlider && vid) {
        seekSlider.addEventListener('mousedown', () => { isSeekingSlider = true; });
        seekSlider.addEventListener('touchstart', () => { isSeekingSlider = true; }, { passive: true });
        seekSlider.addEventListener('input', () => {
            if (!canControlCurrentCinema()) return;
            if (isFinite(vid.duration) && vid.duration > 0) {
                const targetTime = (parseFloat(seekSlider.value) / 100) * vid.duration;
                const curEl = document.getElementById('vid-time-current');
                if (curEl) curEl.textContent = formatMediaTime(targetTime);
            }
        });
        seekSlider.addEventListener('change', () => {
            isSeekingSlider = false;
            if (!canControlCurrentCinema()) {
                showToast('🔒 Apenas quem iniciou o filme/série pode mexer na barra temporal.');
                return;
            }
            if (isFinite(vid.duration) && vid.duration > 0) {
                vid.currentTime = (parseFloat(seekSlider.value) / 100) * vid.duration;
                syncCinemaNow();
            }
        });
        vid.addEventListener('timeupdate', () => {
            const curEl = document.getElementById('vid-time-current');
            const durEl = document.getElementById('vid-time-duration');
            if (curEl) curEl.textContent = formatMediaTime(vid.currentTime || 0);
            if (isFinite(vid.duration) && vid.duration > 0) {
                if (durEl) durEl.textContent = formatMediaTime(vid.duration);
                if (!isSeekingSlider) {
                    seekSlider.value = ((vid.currentTime / vid.duration) * 100).toFixed(2);
                }
            }
        });
        vid.addEventListener('loadedmetadata', () => {
            const durEl = document.getElementById('vid-time-duration');
            if (durEl && isFinite(vid.duration) && vid.duration > 0) {
                durEl.textContent = formatMediaTime(vid.duration);
            }
        });
    }

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
            updateMicDeafenButtonsUI();
            applyDeafenToAllAudio();
        }
        setMicrophoneMuted(!state.isMuted);
        showToast(state.isMuted ? '🔇 Microfone silenciado.' : '🎙️ Microfone ativado.');
    });

    on('btn-deafen', 'click', () => {
        state.isDeafened = !state.isDeafened;
        updateMicDeafenButtonsUI();

        // Silencia / reativa áudio dos outros participantes e vídeos
        applyDeafenToAllAudio();

        // Ao ensurdecer, SEMPRE muta o microfone junto automaticamente!
        if (state.isDeafened) {
            setMicrophoneMuted(true);
        } else {
            // Ao desativar o ensurdecido, desmuta o microfone se não estiver em AFK
            if (state.currentVoiceChannel !== 'afk') {
                setMicrophoneMuted(false);
            } else {
                updateVoiceUserStateUI(state.userId, state.isMuted, state.isDeafened, false);
                sendWs({
                    type: 'voice_state',
                    isMuted: state.isMuted,
                    isDeafened: state.isDeafened,
                    isSpeaking: false
                });
            }
        }

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

    on('ctx-btn-view-profile', 'click', () => {
        const uid = state.activeContextUserId;
        closeUserContextMenu();
        if (uid) openUserProfileModal(uid);
    });

    on('ctx-header-open-profile', 'click', () => {
        const uid = state.activeContextUserId;
        closeUserContextMenu();
        if (uid) openUserProfileModal(uid);
    });

    on('btn-close-view-profile', 'click', closeUserProfileModal);
    const vupModalEl = document.getElementById('view-user-profile-modal');
    if (vupModalEl) {
        vupModalEl.addEventListener('click', (e) => {
            if (e.target === vupModalEl) closeUserProfileModal();
        });
    }
    on('vup-btn-mention', 'click', () => {
        const m = document.getElementById('view-user-profile-modal');
        const name = m?.dataset?.username || 'Amigo';
        if (chatInput) {
            chatInput.value += `@${name} `;
            chatInput.focus();
        }
        closeUserProfileModal();
    });
    on('vup-btn-watch-stream', 'click', () => {
        const m = document.getElementById('view-user-profile-modal');
        const uid = m?.dataset?.userId;
        if (uid) selectLiveStream(uid);
        closeUserProfileModal();
    });
    on('vup-btn-copy-id', 'click', () => {
        const m = document.getElementById('view-user-profile-modal');
        const uid = m?.dataset?.userId;
        if (uid) {
            navigator.clipboard.writeText(uid);
            showToast('📋 ID copiado para a Área de Transferência.');
        }
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
    // on('user-footer-avatar-wrap', 'click', openProfile); // Desativado para abrir exclusivamente o menu de status
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

    // Upload e compressão automática de Foto de Perfil (128x128 JPEG ~8KB salva na nuvem)
    const photoInput = document.getElementById('input-avatar-photo');
    on('btn-upload-avatar-photo', 'click', () => {
        if (photoInput) photoInput.click();
    });
    if (photoInput) {
        photoInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const size = 128;
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');
                    const minDim = Math.min(img.width, img.height);
                    const sx = (img.width - minDim) / 2;
                    const sy = (img.height - minDim) / 2;
                    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                    state.avatarUrl = canvas.toDataURL('image/jpeg', 0.82);
                    try { localStorage.setItem('vox_avatar_url', state.avatarUrl); } catch (err) {}
                    updateSettingsPreview();
                    updateMyProfileUI();
                    sendWs({
                        type: 'update_profile',
                        username: state.username,
                        avatar: state.avatarColor,
                        avatarUrl: state.avatarUrl
                    });
                    renderMembersSidebar();
                    renderVoiceUsers();
                    showToast('📷 Foto de perfil atualizada e salva na nuvem!');
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            photoInput.value = '';
        });
    }
    on('btn-remove-avatar-photo', 'click', () => {
        state.avatarUrl = '';
        try { localStorage.removeItem('vox_avatar_url'); } catch (e) {}
        updateSettingsPreview();
        updateMyProfileUI();
        sendWs({
            type: 'update_profile',
            username: state.username,
            avatar: state.avatarColor,
            avatarUrl: ''
        });
        renderMembersSidebar();
        renderVoiceUsers();
        showToast('🗑️ Foto de perfil removida.');
    });

    // Upload e compressão automática de Foto do Banner (480x160 JPEG ~20KB salva na nuvem)
    const bannerInput = document.getElementById('input-banner-photo');
    on('btn-upload-banner-photo', 'click', () => {
        if (bannerInput) bannerInput.click();
    });
    if (bannerInput) {
        bannerInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const targetW = 480;
                    const targetH = 160;
                    const targetRatio = targetW / targetH;
                    const imgRatio = img.width / img.height;
                    let sx = 0, sy = 0, sw = img.width, sh = img.height;
                    if (imgRatio > targetRatio) {
                        sw = img.height * targetRatio;
                        sx = (img.width - sw) / 2;
                    } else {
                        sh = img.width / targetRatio;
                        sy = (img.height - sh) / 2;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = targetW;
                    canvas.height = targetH;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
                    state.bannerUrl = canvas.toDataURL('image/jpeg', 0.78);
                    try { localStorage.setItem('vox_banner_url', state.bannerUrl); } catch (err) {}
                    updateSettingsPreview();
                    sendWs({
                        type: 'update_profile',
                        username: state.username,
                        avatar: state.avatarColor,
                        avatarUrl: state.avatarUrl || '',
                        bannerUrl: state.bannerUrl
                    });
                    renderMembersSidebar();
                    showToast('🖼️ Banner do perfil atualizado e salvo na nuvem!');
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
            bannerInput.value = '';
        });
    }
    on('btn-remove-banner-photo', 'click', () => {
        state.bannerUrl = '';
        try { localStorage.removeItem('vox_banner_url'); } catch (e) {}
        updateSettingsPreview();
        sendWs({
            type: 'update_profile',
            username: state.username,
            avatar: state.avatarColor,
            avatarUrl: state.avatarUrl || '',
            bannerUrl: ''
        });
        renderMembersSidebar();
        showToast('🗑️ Banner do perfil removido.');
    });
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

    // Controles de Parar / Voltar a Assistir Transmissão e Filme
    on('btn-hud-stop-watching', 'click', () => stopWatchingLocal());
    on('btn-vc-stop-watching', 'click', () => stopWatchingLocal());
    on('btn-resume-watching', 'click', () => resumeWatchingLocal());
    on('btn-voice-watch-toggle', 'click', () => {
        if (state.isWatchingStream !== false) {
            stopWatchingLocal();
        } else {
            resumeWatchingLocal();
        }
    });
    on('btn-toggle-stage', 'click', () => {
        const stage = document.getElementById('video-stage');
        if (stage && stage.style.display !== 'none') {
            stopWatchingLocal();
        } else {
            resumeWatchingLocal();
        }
    });

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
    on('ctx-btn-toggle-admin', 'click', () => {
        if (!state.activeContextUserId) return;
        const uid = state.activeContextUserId;
        const u = state.users.get(uid) || state.serverMembers.get(uid);
        const name = u ? u.username : 'o usuário';
        const isAdm = (state.serverAdmins && state.serverAdmins.has(uid)) || (u && u.isAdmin);
        const actionText = isAdm ? `remover o cargo de Administrador (ADM) de ${name}` : `conceder o cargo de Administrador (ADM) para ${name}`;
        if (confirm(`👑 Deseja realmente ${actionText}?`)) {
            sendWs({
                type: 'admin_toggle_role',
                targetUserId: uid
            });
        }
        closeUserContextMenu();
    });

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
            closeInstallModal();
            if (streamModal) streamModal.style.display = 'none';
        }
    });

    // Botões de Multi-Servidor e Modal VIP
    on('btn-open-create-server', 'click', openCreateServerModal);
    on('btn-close-create-server-modal', 'click', closeCreateServerModal);
    on('btn-submit-create-server', 'click', submitCreateServer);
    on('btn-submit-join-invite', 'click', () => {
        const inp = document.getElementById('join-invite-code-input');
        const code = inp ? inp.value.trim() : '';
        if (!code) {
            showToast('Cole o link ou código do convite primeiro!');
            return;
        }
        sendWs({ type: 'join_server_invite', inviteCode: code });
        if (inp) inp.value = '';
        closeCreateServerModal();
    });

    // Emojis de servidor
    document.querySelectorAll('.emoji-opt').forEach(opt => {
        opt.onclick = () => {
            const iconInp = document.getElementById('new-server-icon-input');
            if (iconInp) iconInp.value = opt.dataset.emoji || '🎮';
        };
    });

    
    // Eventos dos Botões de Comprar VIP
    on('btn-header-buy-vip', 'click', () => openVipModal());
    on('btn-sidebar-buy-vip', 'click', () => openVipModal());
    on('btn-rail-buy-vip', 'click', () => openVipModal());

    on('btn-close-vip-modal', 'click', closeVipModal);
    on('btn-generate-vip-pix', 'click', () => {
        const pixDisp = document.getElementById('vip-pix-display');
        if (pixDisp) {
            pixDisp.style.display = 'block';
            showToast('✅ Código PIX gerado! Copie e pague no seu banco para ativar.');
        }
    });

    
    // Evento de Copiar Código Pix Copia e Cola (R$ 9,90)
    on('btn-copy-pix-payload', 'click', () => {
        if (!activePixPayload) activePixPayload = generateVoxPixPayload();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(activePixPayload).then(() => {
                showToast('📋 Código Pix Copia e Cola (R$ 9,90) copiado! Cole no app do seu banco para pagar.', 6000);
            }).catch(() => {
                prompt('Copie o Código Pix Copia e Cola abaixo (Ctrl+C):', activePixPayload);
            });
        } else {
            prompt('Copie o Código Pix Copia e Cola abaixo (Ctrl+C):', activePixPayload);
        }
    });

    on('btn-copy-vip-pix', 'click', () => {
        const phone = '44997479416';
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(phone).then(() => {
                showToast('📋 Chave Pix Telefone (44997479416) copiada!', 4000);
            }).catch(() => {
                showToast('📋 Chave: 44997479416');
            });
        } else {
            showToast('📋 Chave: 44997479416');
        }
    });

    // Legacy
    on('_unused_btn_copy_vip_pix', 'click', () => {
        const inp = document.getElementById('vip-pix-code');
        if (inp) {
            inp.select();
            navigator.clipboard.writeText(inp.value).then(() => {
                showToast('📋 Código PIX copiado para a área de transferência!');
            }).catch(() => {
                showToast('📋 Código selecionado. Pressione Ctrl+C para copiar.');
            });
        }
    });

    // Opção exclusiva do Dono no Menu de Contexto: Dar / Remover VIP
    on('ctx-btn-toggle-vip', 'click', () => {
        if (!state.activeContextUserId) return;
        const uid = state.activeContextUserId;
        const isTargetVip = state.vips ? state.vips.has(uid) : false;

        if (isTargetVip) {
            // Se já tem VIP, remove direto
            sendWs({
                type: 'admin_toggle_vip',
                targetUserId: uid,
                action: 'revoke'
            });
            closeUserContextMenu();
        } else {
            // Se não tem VIP, abre o modal para escolher dias ou vitalício
            state.activeGrantVipUserId = uid;
            const targetUser = state.users.get(uid) || state.serverMembers.get(uid);
            const targetName = targetUser ? targetUser.username : 'Membro';
            const nameEl = document.getElementById('grant-vip-username');
            if (nameEl) nameEl.textContent = targetName;
            
            const modal = document.getElementById('grant-vip-modal');
            if (modal) modal.style.display = 'flex';
            closeUserContextMenu();
        }
    });

    // Fechar Modal de Conceder VIP
    on('btn-close-grant-vip-modal', 'click', () => {
        const modal = document.getElementById('grant-vip-modal');
        if (modal) modal.style.display = 'none';
    });

    // Chips de seleção rápida de dias
    document.querySelectorAll('.btn-vip-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.btn-vip-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const days = chip.getAttribute('data-days');
            const input = document.getElementById('grant-vip-days-input');
            const check = document.getElementById('grant-vip-lifetime-check');
            if (input) input.value = days;
            if (check) check.checked = false;
        });
    });

    // Checkbox de Vitalício
    const lifetimeCheck = document.getElementById('grant-vip-lifetime-check');
    if (lifetimeCheck) {
        lifetimeCheck.addEventListener('change', (e) => {
            const input = document.getElementById('grant-vip-days-input');
            if (e.target.checked) {
                document.querySelectorAll('.btn-vip-chip').forEach(c => c.classList.remove('active'));
                if (input) input.style.opacity = '0.4';
            } else {
                if (input) input.style.opacity = '1';
            }
        });
    }

    // Botão de Confirmar e Ativar VIP com dias ou vitalício
    on('btn-confirm-grant-vip', 'click', () => {
        if (!state.activeGrantVipUserId) return;
        const isLifetime = document.getElementById('grant-vip-lifetime-check')?.checked || false;
        const daysInput = document.getElementById('grant-vip-days-input');
        const daysVal = daysInput ? parseInt(daysInput.value) || 30 : 30;

        sendWs({
            type: 'admin_toggle_vip',
            targetUserId: state.activeGrantVipUserId,
            action: 'grant',
            isLifetime: isLifetime,
            duration: isLifetime ? 'lifetime' : daysVal
        });

        const modal = document.getElementById('grant-vip-modal');
        if (modal) modal.style.display = 'none';
        showToast(isLifetime ? '👑 Concedendo VIP VITALÍCIO...' : `⭐ Concedendo ${daysVal} dias de VIP...`);
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

    // Gestos de Deslizar (Swipe) para navegar pro lado no celular (Salas e Membros)
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    document.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
        }
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches.length === 1) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const deltaX = touchEndX - touchStartX;
            const deltaY = touchEndY - touchStartY;
            const elapsed = Date.now() - touchStartTime;

            // Identifica swipe horizontal nítido (> 40px e predominantemente horizontal)
            if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3 && elapsed < 450) {
                const isChannelsOpen = channelsSidebar && channelsSidebar.classList.contains('mobile-open');
                const isMembersOpen = membersSidebar && membersSidebar.classList.contains('mobile-open');

                if (deltaX > 0) {
                    // Arrastou da ESQUERDA para a DIREITA
                    if (isMembersOpen) {
                        closeMobileDrawers();
                    } else if (!isChannelsOpen && touchStartX < 120) {
                        closeMobileDrawers();
                        if (channelsSidebar) channelsSidebar.classList.add('mobile-open');
                        if (mobileBackdrop) mobileBackdrop.style.display = 'block';
                    }
                } else {
                    // Arrastou da DIREITA para a ESQUERDA
                    if (isChannelsOpen) {
                        closeMobileDrawers();
                    } else if (!isMembersOpen && touchStartX > window.innerWidth - 120) {
                        closeMobileDrawers();
                        if (membersSidebar) membersSidebar.classList.add('mobile-open');
                        if (mobileBackdrop) mobileBackdrop.style.display = 'block';
                    }
                }
            }
        }
    }, { passive: true });

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
        if (name.toUpperCase() === 'DIM' || name.toUpperCase().startsWith('DIM')) {
            state.userTag = '#4095';
            state.isOwner = true;
        }
        localStorage.setItem('vox_user_tag', state.userTag);
        localStorage.setItem('dc_tag', state.userTag);
        localStorage.setItem('vox_username', state.username);
        localStorage.setItem('dc_username', state.username);

        const profileObj = {
            userId: state.userId,
            username: state.username,
            avatarColor: state.avatarColor,
            userTag: state.userTag
        };
        localStorage.setItem('kord_user_profile', JSON.stringify(profileObj));
        localStorage.setItem('discord_user_profile', JSON.stringify(profileObj));
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
    updateWatchButtonsVisibility();
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
        const hls = new Hls({
            enableWorker: true,
            // lowLatencyMode pode causar cortes em conexões instáveis; mantemos habilitado, mas aumentamos buffers
            lowLatencyMode: true,
            backBufferLength: 30,          // segundos de pré‑buffer
            maxBufferLength: 30,           // até 30 s de buffer total
            maxMaxBufferLength: 60,        // limite máximo de buffer
            liveSyncDurationCount: 5,      // 5 segmentos de atraso seguro
            liveMaxLatencyDurationCount: 8,
            maxBufferHole: 1.0,            // tolera pequenas lacunas
            highBufferWatchdogPeriod: 5,   // verifica buffer com menos frequência
            nudgeOffset: 0.25,
            nudgeMaxRetry: 10
        });
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


function loadLiveStream(m3u8Url, tsUrl, video) {
    console.log('[VOX Live] Inicializando canal ao vivo...');
    
    // 1. Limpa instâncias anteriores
    if (state.hlsInstance) {
        try { state.hlsInstance.destroy(); } catch (e) {}
        state.hlsInstance = null;
    }
    if (state.mpegtsInstance) {
        try {
            state.mpegtsInstance.pause();
            state.mpegtsInstance.unload();
            state.mpegtsInstance.detachMediaElement();
            state.mpegtsInstance.destroy();
        } catch (e) {}
        state.mpegtsInstance = null;
    }

    // 2. PRIORIDADE 1: Hls.js com buffer contínuo (Elimina 100% dos congelamentos)
    if (window.Hls && Hls.isSupported()) {
        console.log('[VOX Live] Usando motor Hls.js de alta estabilidade:', m3u8Url);
        const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 30,
            maxBufferLength: 20,           // Mantém até 20s de buffer
            maxMaxBufferLength: 40,
            maxBufferSize: 50 * 1000 * 1000,
            liveSyncDurationCount: 2,      // 2 segmentos de atraso seguro (evita buffer starvation)
            liveMaxLatencyDurationCount: 5,
            maxBufferHole: 0.8,
            highBufferWatchdogPeriod: 2,
            nudgeOffset: 0.1,
            nudgeMaxRetry: 6,
            fragLoadingTimeOut: 20000,
            manifestLoadingTimeOut: 20000
        });

        hls.loadSource(m3u8Url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('[VOX Live] Manifest carregado com sucesso!');
            startVideoPlayback(video);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
            console.warn('[VOX Live] Evento HLS:', data.type, data.details);
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.warn('[VOX Live] Erro de rede HLS, tentando recarregar...');
                        hls.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.warn('[VOX Live] Erro de mídia HLS, recuperando...');
                        hls.recoverMediaError();
                        break;
                    default:
                        console.warn('[VOX Live] Erro fatal irrecuperável HLS, tentando fallback para MPEG-TS...');
                        hls.destroy();
                        state.hlsInstance = null;
                        fallbackMpegts(tsUrl, video);
                        break;
                }
            }
        });

        state.hlsInstance = hls;
        return;
    }

    // 3. PRIORIDADE 2: Suporte nativo HLS (Safari / iOS / Mac)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('[VOX Live] Usando player HLS nativo do navegador');
        video.src = m3u8Url;
        startVideoPlayback(video);
        return;
    }

    // 4. PRIORIDADE 3: Fallback MPEG-TS estabilizado
    fallbackMpegts(tsUrl, video);
}

function fallbackMpegts(tsUrl, video) {
    if (window.mpegts && mpegts.getFeatureList().mseLivePlayback) {
        console.log('[VOX Live] Inicializando fallback MPEG-TS estabilizado:', tsUrl);
        try {
            const player = mpegts.createPlayer({
                type: 'mse',
                isLive: true,
                url: tsUrl
            }, {
                enableWorker: false,
                lazyLoad: false,
                enableStashBuffer: true,         // ESSENCIAL: Mantém buffer local para não congelar
                stashInitialSize: 512,           // 512KB de buffer inicial
                autoCleanupSourceBuffer: true,
                autoCleanupMaxBackwardDuration: 30,
                autoCleanupMinBackwardDuration: 15,
                liveBufferLatencyChasing: false, // DESATIVADO: era o que causava o congelamento em 1s!
                fixAudioTimestampGap: true
            });
            player.attachMediaElement(video);
            player.load();
            startVideoPlayback(video);
            state.mpegtsInstance = player;
        } catch (err) {
            console.error('[VOX Live] Erro no fallback MPEG-TS:', err);
            showToast('⚠️ Erro ao reproduzir o canal. Tentando restabelecer conexão...');
        }
    }
}

function playCinemaStream(cinema) {
    // 1. IPTV só pode rodar se o usuário estiver CONECTADO em uma call VIP (Cinema)
    const curRoom = state.currentVoiceChannel || '';
    const isInCinemaCall = curRoom.includes('cinema-');
    if (!isInCinemaCall) {
        stopCinemaPlayback();
        showToast('🎬 Entre em uma Sala de Cinema VIP para assistir Filmes, Séries ou TV Ao Vivo!', 5000);
        return;
    }
    // 2. Bloqueio estrito: precisa ser VIP, Dono Supremo (Mestre) ou ter passe temporário do Mestre NESTA sala!
    const hasGuestPass = (state.vipGuestRoom && state.vipGuestRoom === curRoom);
    if (!state.isVip && !state.isOwner && !hasGuestPass) {
        stopCinemaPlayback();
        openVipModal();
        showToast('👑 Conteúdo exclusivo VIP! Escaneie o QR Code Pix para liberar Filmes, Séries e TV Ao Vivo.', 6000);
        return;
    }
    const stage = document.getElementById('video-stage');
    const video = document.getElementById('stage-video');
    if (!stage || !video || !cinema) return;

    if (state.isWatchingStream === false && state.currentCinemaStreamId === cinema.streamId) {
        updateWatchButtonsVisibility();
        return;
    }
    state.isWatchingStream = true;

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

    const isVodOrSeries = (cinema.streamType !== 'live');
    const canCtrl = isOwner || state.isOwner;
    const btnPlay = document.getElementById('btn-vid-play');
    if (btnPlay) btnPlay.style.display = canCtrl ? 'inline-flex' : 'none';

    const progressWrap = document.getElementById('cinema-progress-wrap');
    if (progressWrap) progressWrap.style.display = isVodOrSeries ? 'flex' : 'none';

    const seekEl = document.getElementById('vid-seek-slider');
    if (seekEl) seekEl.disabled = !canCtrl;

    const btnStop = document.getElementById('btn-vid-stop');
    if (btnStop) btnStop.style.display = canCtrl ? 'inline-flex' : 'none';

    ['btn-vid-back10', 'btn-vid-fwd10'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (canCtrl && isVodOrSeries) ? 'inline-flex' : 'none';
    });

    const prevEpBtn = document.getElementById('btn-vid-prev-ep');
    if (prevEpBtn) {
        const hasPrevEp = (
            cinema.streamType === 'series' &&
            canCtrl &&
            Array.isArray(state.currentSeriesPlaylist) &&
            state.currentSeriesIndex > 0
        );
        prevEpBtn.style.display = hasPrevEp ? 'inline-flex' : 'none';
    }

    const nextEpBtn = document.getElementById('btn-vid-next-ep');
    if (nextEpBtn) {
        const hasNextEp = (
            cinema.streamType === 'series' &&
            canCtrl &&
            Array.isArray(state.currentSeriesPlaylist) &&
            state.currentSeriesIndex >= 0 &&
            state.currentSeriesIndex < state.currentSeriesPlaylist.length - 1
        );
        nextEpBtn.style.display = hasNextEp ? 'inline-flex' : 'none';
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
        const m3u8Url = `/api/iptv/live/${cinema.streamId}.m3u8`;
        const tsUrl = `/api/iptv/stream/${cinema.streamId}.ts`;
        loadLiveStream(m3u8Url, tsUrl, video);
    } else {
        const vodType = cinema.streamType === 'series' ? 'series' : 'movie';
        const vodUrl = `/api/iptv/vod/${cinema.streamId}?ext=${cinema.ext || 'mp4'}&type=${vodType}`;
        video.preload = 'auto';
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
    if (!room || !room.includes('cinema-')) {
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
    const selectEl = document.getElementById('iptv-select-target-room');
    if (selectEl) {
        const currentCinemas = (state.channels?.voice || []).filter(c => c.type === 'cinema' || (c.id && c.id.includes('cinema-')));
        if (currentCinemas.length > 0) {
            selectEl.innerHTML = currentCinemas.map(c =>
                `<option value="${escapeHtml(c.id)}">👑 ${escapeHtml(c.name)} (VIP)</option>`
            ).join('');
        }
        if (state.currentVoiceChannel && state.currentVoiceChannel.includes('cinema-')) {
            selectEl.value = state.currentVoiceChannel;
        }
    }
    modal.style.display = 'flex';
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
                // Permite explorar todo o catálogo, mas ao dar play sem VIP abre o QR Code de ativação e NÃO roda!
                if (!state.isVip && !state.isOwner) {
                    closeIptvModal();
                    openVipModal();
                    showToast('👑 Ative seu Passe VIP pelo QR Code Pix para assistir Filmes, Séries e TV Ao Vivo!', 6000);
                    return;
                }
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
        // Monta playlist ordenada de todos os episódios da série para o botão "Próximo Episódio"
        const flatPlaylist = [];
        seasons.forEach(sNum => {
            (episodes[sNum] || []).forEach(ep => {
                const epTitle = ep.title || `Episódio ${ep.episode_num}`;
                const icon = ep.info?.movie_image || series.cover || '';
                flatPlaylist.push({
                    streamId: ep.id,
                    streamName: `${seriesName} • T${sNum} ${epTitle}`,
                    ext: ep.container_extension || 'mp4',
                    poster: icon
                });
            });
        });

        let flatIdxCounter = 0;
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
                const myFlatIdx = flatIdxCounter++;
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
                    // Permite ver temporadas e episódios, mas ao dar play sem VIP abre o QR Code e NÃO roda!
                    if (!state.isVip && !state.isOwner) {
                        closeIptvModal();
                        openVipModal();
                        showToast('👑 Ative seu Passe VIP pelo QR Code Pix para assistir Séries, Filmes e TV Ao Vivo!', 6000);
                        return;
                    }
                    const targetRoom = document.getElementById('iptv-select-target-room').value;
                    const fullEpName = `${seriesName} • T${sNum} ${epTitle}`;
                    state.currentSeriesPlaylist = flatPlaylist;
                    state.currentSeriesIndex = myFlatIdx;
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

function playPrevSeriesEpisode() {
    if (!Array.isArray(state.currentSeriesPlaylist) || state.currentSeriesIndex <= 0) {
        showToast('ℹ️ Você já está no primeiro episódio desta série!');
        return;
    }
    const prevIdx = state.currentSeriesIndex - 1;
    const prevEp = state.currentSeriesPlaylist[prevIdx];
    const targetRoom = state.currentVoiceChannel;
    if (!targetRoom || !targetRoom.includes('cinema-')) return;

    state.currentSeriesIndex = prevIdx;
    const cinemaObj = {
        streamId: prevEp.streamId,
        streamName: prevEp.streamName,
        streamType: 'series',
        ext: prevEp.ext || 'mp4',
        poster: prevEp.poster || '',
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
        streamId: prevEp.streamId,
        streamName: prevEp.streamName,
        streamType: 'series',
        ext: prevEp.ext || 'mp4',
        poster: prevEp.poster || ''
    });
    playCinemaStream(cinemaObj);
    showToast(`⏮️ Episódio anterior: <b>${escapeHtml(prevEp.streamName)}</b>`);
}

function playNextSeriesEpisode() {
    if (!Array.isArray(state.currentSeriesPlaylist) || state.currentSeriesIndex < 0) {
        showToast('ℹ️ Nenhum próximo episódio na fila.');
        return;
    }
    const nextIdx = state.currentSeriesIndex + 1;
    if (nextIdx >= state.currentSeriesPlaylist.length) {
        showToast('🏁 Você já está no último episódio desta série!');
        return;
    }
    const nextEp = state.currentSeriesPlaylist[nextIdx];
    const targetRoom = state.currentVoiceChannel;
    if (!targetRoom || !targetRoom.includes('cinema-')) return;

    state.currentSeriesIndex = nextIdx;
    const cinemaObj = {
        streamId: nextEp.streamId,
        streamName: nextEp.streamName,
        streamType: 'series',
        ext: nextEp.ext || 'mp4',
        poster: nextEp.poster || '',
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
        streamId: nextEp.streamId,
        streamName: nextEp.streamName,
        streamType: 'series',
        ext: nextEp.ext || 'mp4',
        poster: nextEp.poster || ''
    });
    playCinemaStream(cinemaObj);
    showToast(`⏭️ Próximo episódio: <b>${escapeHtml(nextEp.streamName)}</b>`);
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


// ==========================================================================
// FUNÇÕES DE MULTI-SERVIDORES & ASSINATURA VIP (PIX)
// ==========================================================================

function renderUserServers() {
    const rail = document.getElementById('user-servers-rail');
    if (!rail) return;
    rail.innerHTML = '';

    const defaultBtn = document.getElementById('btn-server-default');
    if (defaultBtn) {
        if (state.currentServerId === 'default') {
            defaultBtn.classList.add('active');
        } else {
            defaultBtn.classList.remove('active');
        }
        defaultBtn.onclick = () => switchServer('default');
    }

    if (state.userServers && Array.isArray(state.userServers)) {
        state.userServers.forEach(srv => {
            if (srv.id === 'default') return;
            const pill = document.createElement('div');
            pill.className = `server-pill user-server-item ${state.currentServerId === srv.id ? 'active' : ''}`;
            pill.title = state.isOwner ? `${srv.name} (Botão direito para excluir)` : srv.name;
            pill.style.overflow = 'hidden';
            if (srv.iconUrl && srv.iconUrl.startsWith('data:image/')) {
                pill.innerHTML = `<img src="${srv.iconUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;">`;
            } else {
                pill.innerHTML = `<span>${escapeHtml(srv.icon || '🎮')}</span>`;
            }
            pill.onclick = () => switchServer(srv.id);
            pill.oncontextmenu = (e) => {
                if (!state.isOwner) return;
                e.preventDefault();
                if (confirm(`🧙‍♂️ MESTRE: Deseja excluir PERMANENTEMENTE o servidor "${srv.name}"?`)) {
                    sendWs({ type: 'admin_delete_server', serverId: srv.id });
                }
            };
            rail.appendChild(pill);
        });
    }
}

function switchServer(srvId) {
    if (state.currentServerId === srvId) return;
    sendWs({ type: 'switch_server', serverId: srvId });
}

function openCreateServerModal() {
    const modal = document.getElementById('create-server-modal');
    if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('new-server-name-input');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function closeCreateServerModal() {
    const modal = document.getElementById('create-server-modal');
    if (modal) modal.style.display = 'none';
}

function submitCreateServer() {
    const nameInput = document.getElementById('new-server-name-input');
    const iconInput = document.getElementById('new-server-icon-input');
    const name = nameInput ? nameInput.value.trim() : '';
    const icon = iconInput ? iconInput.value.trim() : '🎮';
    if (!name) {
        alert('Por favor, digite um nome para o seu servidor!');
        if (nameInput) nameInput.focus();
        return;
    }
    sendWs({
        type: 'create_server',
        name: name,
        icon: icon || '🎮'
    });
    closeCreateServerModal();
}


// =========================================================================
// SISTEMA OFICIAL DE PAGAMENTO PIX QR CODE & COPIA E COLA (PADRÃO BANCO CENTRAL)
// =========================================================================
const VOX_PIX = {
    key: "+5544997479416",
    rawPhone: "44997479416",
    name: "DIM VOX",
    city: "MARINGA",
    amount: 9.90,
    txId: "VOXVIP"
};

function generateVoxPixPayload(amount = VOX_PIX.amount, key = VOX_PIX.key, name = VOX_PIX.name, city = VOX_PIX.city, txId = VOX_PIX.txId) {
    function crc16(str) {
        let crc = 0xFFFF;
        for (let c = 0; c < str.length; c++) {
            crc ^= (str.charCodeAt(c) << 8);
            for (let i = 0; i < 8; i++) {
                if ((crc & 0x8000) !== 0) {
                    crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
                } else {
                    crc = (crc << 1) & 0xFFFF;
                }
            }
        }
        let hex = crc.toString(16).toUpperCase();
        while (hex.length < 4) hex = '0' + hex;
        return hex;
    }

    const f = (id, val) => {
        const strVal = String(val);
        const len = String(strVal.length).padStart(2, '0');
        return `${id}${len}${strVal}`;
    };

    let payload = "000201";       // Payload Format Indicator
    payload += "010212";          // Point of Initiation (12 = dinâmico / estático recorrente com valor)
    const gui = f("00", "br.gov.bcb.pix");
    const pixKey = f("01", key);
    payload += f("26", gui + pixKey);
    payload += "52040000";        // Merchant Category Code
    payload += "5303986";         // Moeda 986 (BRL - Real Brasileiro)
    const amtStr = Number(amount).toFixed(2);
    payload += f("54", amtStr);   // Valor da transação (R$ 9,90)
    payload += "5802BR";          // País BR
    payload += f("59", name.substring(0, 25)); // Nome do Beneficiário (DIM VOX)
    payload += f("60", city.substring(0, 15)); // Cidade (MARINGA)
    payload += f("62", f("05", txId));         // Identificador / TxID (VOXVIP)
    const payloadToCrc = payload + "6304";
    return payloadToCrc + crc16(payloadToCrc);
}

let activePixPayload = null;

function renderVoxPixQrCode() {
    const container = document.getElementById('pix-qrcode-container');
    if (!container) return;

    activePixPayload = generateVoxPixPayload();
    container.innerHTML = '';

    if (typeof QRCode !== 'undefined') {
        try {
            new QRCode(container, {
                text: activePixPayload,
                width: 155,
                height: 155,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
            return;
        } catch (e) {
            console.warn('[VOX] Falha no QRCode local, usando fallback render:', e);
        }
    }
    // Fallback caso script ainda não tenha carregado
    const fallbackUrl = `https://api.qrserver.com/v1/create-qr-code/?size=155x155&margin=1&data=${encodeURIComponent(activePixPayload)}`;
    container.innerHTML = `<img src="${fallbackUrl}" style="width:155px;height:155px;display:block;border-radius:4px;" alt="QR Code PIX R$ 9,90">`;
}

function openVipModal() {
    const modal = document.getElementById('vip-modal');
    if (modal) {
        modal.style.display = 'flex';
        renderVoxPixQrCode();
        // Personaliza a mensagem do WhatsApp com o nome do usuário atual
        const myName = state.currentUser || 'Membro do VOX';
        const msg = encodeURIComponent(`Olá DIM! 🔥 Quero ativar meu Passe VIP no VOX para liberar Filmes, Séries e TV Ao Vivo! 🍿 Meu usuário no VOX é: ${myName}. Já fiz o PIX de R$ 9,90 ou vou te mandar o comprovante agora!`);
        const waBtn = document.getElementById('btn-whatsapp-vip');
        if (waBtn) {
            waBtn.href = `https://wa.me/5544997479416?text=${msg}`;
        }
    }
}

function closeVipModal() {
    const modal = document.getElementById('vip-modal');
    if (modal) modal.style.display = 'none';
}


// =========================================================================
// VOX: SISTEMA DE STATUS, ATIVIDADE GAMER E DOSSIÊ DE AUDITORIA ADM
// =========================================================================

state.userStatus = 'online';
state.userActivity = (() => {
    try {
        const saved = localStorage.getItem('vox_user_activity');
        return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
})();
state.activeAuditUserId = null;
state.currentAuditData = null;

function initVoxStatusAndActivity() {
    // 1. Alternar Menu Rápido de Status ao Clicar no Avatar do Rodapé
    const avatarWrap = document.getElementById('user-footer-avatar-wrap');
    const statusMenu = document.getElementById('user-status-menu');

    if (avatarWrap && statusMenu) {
        avatarWrap.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
            const isVisible = (statusMenu.style.display === 'block');
            statusMenu.style.display = isVisible ? 'none' : 'block';
        });

        // Opções de Status (online, dnd, idle, invisible)
        document.querySelectorAll('.vox-status-option[data-status]').forEach(opt => {
            opt.addEventListener('click', () => {
                const newStatus = opt.getAttribute('data-status');
                setUserStatus(newStatus);
                statusMenu.style.display = 'none';
            });
        });

        // Fechar menu ao clicar fora
        document.addEventListener('click', (e) => {
            if (!statusMenu.contains(e.target) && !avatarWrap.contains(e.target)) {
                statusMenu.style.display = 'none';
            }
        });
    }

    // 2. Modal de Atividade Gamer
    const openActBtn = document.getElementById('btn-open-activity-modal');
    const actModal = document.getElementById('user-activity-modal');
    const closeActBtn = document.getElementById('btn-close-activity-modal');
    const saveActBtn = document.getElementById('btn-save-activity');
    const clearActBtn = document.getElementById('btn-clear-activity');
    const actInput = document.getElementById('activity-name-input');

    if (openActBtn && actModal) {
        openActBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (statusMenu) statusMenu.style.display = 'none';
            actModal.style.display = 'flex';
            if (actInput) {
                actInput.value = state.userActivity ? state.userActivity.name : '';
                actInput.focus();
            }
        });
    }

    if (closeActBtn && actModal) {
        closeActBtn.addEventListener('click', () => actModal.style.display = 'none');
    }

    // Chips de Seleção Rápida de Jogos
    document.querySelectorAll('.activity-quick-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const name = chip.getAttribute('data-name');
            const type = chip.getAttribute('data-type') || 'playing';
            if (actInput) actInput.value = name;
            // Marca o pill correspondente
            document.querySelectorAll('.activity-type-pill').forEach(p => {
                p.classList.toggle('active', p.getAttribute('data-type') === type);
            });
        });
    });

    // Pills de Tipo (Jogando, Assistindo, Ouvindo)
    document.querySelectorAll('.activity-type-pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.activity-type-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
        });
    });

    // Salvar Atividade Gamer
    if (saveActBtn && actModal && actInput) {
        saveActBtn.addEventListener('click', () => {
            const name = actInput.value.trim();
            if (!name) {
                clearUserActivity();
                actModal.style.display = 'none';
                return;
            }
            const activePill = document.querySelector('.activity-type-pill.active');
            const type = activePill ? activePill.getAttribute('data-type') : 'playing';

            state.userActivity = { type: type, name: name };
            try { localStorage.setItem('vox_user_activity', JSON.stringify(state.userActivity)); } catch (e) {}
            sendWs({ type: 'set_activity', activity: state.userActivity });

            const actLabel = document.getElementById('current-activity-label');
            if (actLabel) actLabel.textContent = `${name}`;

            const myActEl = document.getElementById('my-activity-display');
            if (myActEl) {
                const prefix = type === 'watching' ? '🍿 Assistindo' : (type === 'listening' ? '🎧 Ouvindo' : '🎮 Jogando');
                myActEl.innerHTML = `${prefix} <b>${escapeHtml(name)}</b>`;
                myActEl.style.display = 'block';
            }

            actModal.style.display = 'none';
            renderMembersSidebar();
            if (typeof showToast === 'function') showToast(`Atividade definida: ${name}`, 'success');
        });
    }

    // Limpar Atividade
    if (clearActBtn && actModal) {
        clearActBtn.addEventListener('click', () => {
            clearUserActivity();
            actModal.style.display = 'none';
        });
    }

    // 3. Listener do Botão de Auditoria no Context Menu
    const ctxAuditBtn = document.getElementById('ctx-btn-user-audit');
    if (ctxAuditBtn) {
        ctxAuditBtn.addEventListener('click', () => {
            closeContextMenu();
            if (state.activeContextUserId) {
                openUserAuditModal(state.activeContextUserId);
            }
        });
    }

    // 4. Listeners das Abas do Modal de Auditoria
    setupAuditModalTabs();
}

function setUserStatus(status) {
    state.userStatus = status;
    const dot = document.querySelector('#user-footer-avatar-wrap .status-dot');
    if (dot) {
        dot.className = `status-dot ${status}`;
    }
    sendWs({ type: 'set_status', status: status });
    renderMembersSidebar();
    if (typeof showToast === 'function') {
        const labels = { online: 'Disponível 🟢', dnd: 'Não Perturbe ⛔', idle: 'Ausente 🟡', invisible: 'Invisível ⚫' };
        showToast(`Status: ${labels[status] || status}`, 'info');
    }
}

function clearUserActivity() {
    state.userActivity = null;
    try { localStorage.removeItem('vox_user_activity'); } catch (e) {}
    sendWs({ type: 'set_activity', activity: null });
    const actLabel = document.getElementById('current-activity-label');
    if (actLabel) actLabel.textContent = 'Nenhuma atividade';
    const myActEl = document.getElementById('my-activity-display');
    if (myActEl) {
        myActEl.innerHTML = '';
        myActEl.style.display = 'none';
    }
    renderMembersSidebar();
    if (typeof showToast === 'function') showToast('Atividade limpa.', 'info');
}

// --- PAINEL DE AUDITORIA & DOSSIÊ DE SEGURANÇA VOX ---

function openUserAuditModal(targetUserId) {
    const modal = document.getElementById('user-audit-modal');
    if (!modal) return;

    state.activeAuditUserId = targetUserId;
    modal.style.display = 'flex';

    // Placeholder de Carregando
    const nameEl = document.getElementById('audit-user-name');
    if (nameEl) nameEl.textContent = 'Carregando dados...';
    const msgsContainer = document.getElementById('audit-messages-container');
    if (msgsContainer) msgsContainer.innerHTML = '<div style="color:#71717a;font-size:12px;padding:12px;text-align:center;">Carregando dossiê de auditoria...</div>';

    // Solicita dados ao servidor
    sendWs({
        type: 'admin_get_user_audit',
        targetUserId: targetUserId
    });
}

function renderUserAuditModal(data) {
    state.currentAuditData = data;
    const modal = document.getElementById('user-audit-modal');
    if (!modal || modal.style.display === 'none') return;

    // Header do Usuário
    const avatarEl = document.getElementById('audit-user-avatar');
    const nameEl = document.getElementById('audit-user-name');
    const tagEl = document.getElementById('audit-user-tag');
    const rolesEl = document.getElementById('audit-user-roles');
    const statusEl = document.getElementById('audit-user-status-badge');
    const actEl = document.getElementById('audit-user-activity-text');
    const warnCountEl = document.getElementById('audit-warning-counter');
    const muteLabel = document.getElementById('audit-mute-label');

    const username = data.targetUsername || data.member?.username || 'Usuário';
    if (nameEl) nameEl.textContent = username;
    if (avatarEl) {
        avatarEl.textContent = (username[0] || 'U').toUpperCase();
        avatarEl.style.backgroundColor = data.member?.avatar || '#5865F2';
    }
    if (tagEl) tagEl.textContent = `ID: ${data.targetUserId.substring(0, 10)}`;

    if (rolesEl) {
        let rHtml = '';
        if (username.toUpperCase().startsWith('DIM')) {
            rHtml = '<span class="badge-role-mestre" style="font-size:9px;padding:2px 6px;"><i class="fa-solid fa-crown"></i> DONO</span>';
        } else if (data.member?.isAdmin) {
            rHtml = '<span class="badge-role-adm" style="font-size:9px;padding:2px 6px;"><i class="fa-solid fa-shield-halved"></i> ADM</span>';
        }
        if (data.isVip) {
            rHtml += ' <span class="badge-vip" style="font-size:9px;padding:2px 6px;"><i class="fa-solid fa-crown"></i> VIP</span>';
        }
        rolesEl.innerHTML = rHtml;
    }

    if (statusEl) {
        const isOnline = data.isOnline;
        const st = data.status || 'offline';
        const stLabel = !isOnline ? '⚫ Offline' :
                        st === 'dnd' ? '⛔ Não Perturbe' :
                        st === 'idle' ? '🟡 Ausente' : '🟢 Online';
        statusEl.textContent = stLabel;
    }

    if (actEl) {
        if (data.activity && data.activity.name) {
            actEl.innerHTML = `🎮 ${escapeHtml(data.activity.name)}`;
        } else {
            actEl.textContent = 'Sem atividade informada';
        }
    }

    const warnTotal = data.warnings ? data.warnings.length : 0;
    if (warnCountEl) {
        warnCountEl.textContent = `${warnTotal} Advertência${warnTotal === 1 ? '' : 's'}`;
        warnCountEl.style.color = warnTotal > 0 ? '#f87171' : '#4ade80';
        warnCountEl.style.borderColor = warnTotal > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(74, 222, 128, 0.3)';
    }

    if (muteLabel) {
        muteLabel.textContent = data.isServerMuted ? 'Desmutar no Servidor' : 'Mutar no Servidor';
    }

    // 1. Aba Mensagens Recentes
    const msgsCountEl = document.getElementById('audit-msgs-count');
    if (msgsCountEl) msgsCountEl.textContent = (data.recentMessages || []).length;
    const msgsContainer = document.getElementById('audit-messages-container');
    if (msgsContainer) {
        msgsContainer.innerHTML = '';
        if (!data.recentMessages || data.recentMessages.length === 0) {
            msgsContainer.innerHTML = '<div style="color:#71717a;font-size:12px;padding:16px;text-align:center;">Nenhuma mensagem registrada no servidor por este usuário.</div>';
        } else {
            data.recentMessages.slice().reverse().forEach(msg => {
                const item = document.createElement('div');
                item.className = `audit-msg-item ${msg.flagged ? 'flagged' : ''}`;
                item.innerHTML = `
                    <div style="flex:1;min-width:0;">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;flex-wrap:wrap;">
                            <span style="font-size:10px;font-weight:700;color:#60a5fa;background:rgba(96,165,250,0.15);padding:1px 6px;border-radius:4px;">#${escapeHtml(msg.channelId || 'geral')}</span>
                            <span style="font-size:10px;color:#71717a;">${escapeHtml(msg.timestamp || '')}</span>
                            ${msg.flagged ? '<span class="audit-msg-badge-flagged"><i class="fa-solid fa-triangle-exclamation"></i> TERMO SUSPEITO DETECTADO</span>' : ''}
                        </div>
                        <div style="font-size:13px;color:#f4f4f5;word-break:break-word;">${escapeHtml(msg.text)}</div>
                    </div>
                    <button class="btn-delete-audit-msg" data-msg-id="${msg.id}" title="Apagar esta mensagem" style="padding:4px 8px;border-radius:4px;background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;cursor:pointer;font-size:11px;flex-shrink:0;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                `;
                msgsContainer.appendChild(item);
            });

            // Bind delete message
            msgsContainer.querySelectorAll('.btn-delete-audit-msg').forEach(btn => {
                btn.addEventListener('click', () => {
                    const msgId = btn.getAttribute('data-msg-id');
                    sendWs({ type: 'admin_delete_single_message', messageId: msgId });
                    btn.closest('.audit-msg-item').remove();
                });
            });
        }
    }

    // 2. Aba Advertências
    const warnsCountEl = document.getElementById('audit-warns-count');
    if (warnsCountEl) warnsCountEl.textContent = (data.warnings || []).length;
    const warnsContainer = document.getElementById('audit-warnings-container');
    if (warnsContainer) {
        warnsContainer.innerHTML = '';
        if (!data.warnings || data.warnings.length === 0) {
            warnsContainer.innerHTML = '<div style="color:#71717a;font-size:12px;padding:16px;text-align:center;">Nenhuma advertência aplicada a este usuário. Ficha limpa!</div>';
        } else {
            data.warnings.slice().reverse().forEach(w => {
                const item = document.createElement('div');
                item.className = 'audit-warn-item';
                item.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
                        <span style="font-size:11px;font-weight:800;color:#facc15;"><i class="fa-solid fa-triangle-exclamation"></i> ADVERTÊNCIA REGISTRADA</span>
                        <span style="font-size:10px;color:#a1a1aa;">${escapeHtml(w.timeStr || '')}</span>
                    </div>
                    <div style="font-size:13px;color:#ffffff;margin-bottom:4px;">${escapeHtml(w.reason)}</div>
                    <div style="font-size:10px;color:#71717a;">Aplicada por: <strong style="color:#e4e4e7;">${escapeHtml(w.warnedBy || 'ADM')}</strong></div>
                `;
                warnsContainer.appendChild(item);
            });
        }
    }

    // 3. Aba Histórico de Ações
    const logsContainer = document.getElementById('audit-logs-container');
    if (logsContainer) {
        logsContainer.innerHTML = '';
        if (!data.auditLogs || data.auditLogs.length === 0) {
            logsContainer.innerHTML = '<div style="color:#71717a;font-size:12px;padding:16px;text-align:center;">Nenhum evento registrado no histórico recente.</div>';
        } else {
            data.auditLogs.slice().reverse().forEach(l => {
                const item = document.createElement('div');
                item.className = 'audit-log-item';
                item.innerHTML = `
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
                        <span style="font-weight:700;color:#60a5fa;text-transform:uppercase;font-size:10px;">${escapeHtml(l.action)}</span>
                        <span style="font-size:10px;color:#71717a;">${escapeHtml(l.timeStr || '')}</span>
                    </div>
                    <div>${escapeHtml(l.details || '')}</div>
                `;
                logsContainer.appendChild(item);
            });
        }
    }
}

function setupAuditModalTabs() {
    const modal = document.getElementById('user-audit-modal');
    if (!modal) return;

    const tabMsgs = document.getElementById('tab-btn-audit-msgs');
    const tabWarns = document.getElementById('tab-btn-audit-warns');
    const tabLogs = document.getElementById('tab-btn-audit-logs');

    const contentMsgs = document.getElementById('audit-tab-msgs-content');
    const contentWarns = document.getElementById('audit-tab-warns-content');
    const contentLogs = document.getElementById('audit-tab-logs-content');

    const setTab = (activeTab, activeContent) => {
        [tabMsgs, tabWarns, tabLogs].forEach(t => t?.classList.remove('active'));
        [contentMsgs, contentWarns, contentLogs].forEach(c => { if (c) c.style.display = 'none'; });
        activeTab?.classList.add('active');
        if (activeContent) activeContent.style.display = 'block';
    };

    tabMsgs?.addEventListener('click', () => setTab(tabMsgs, contentMsgs));
    tabWarns?.addEventListener('click', () => setTab(tabWarns, contentWarns));
    tabLogs?.addEventListener('click', () => setTab(tabLogs, contentLogs));

    // Fechar Modal
    document.getElementById('btn-close-audit-modal')?.addEventListener('click', () => modal.style.display = 'none');
    document.getElementById('btn-close-audit-secondary')?.addEventListener('click', () => modal.style.display = 'none');

    // Botão Aplicar Advertência (Warn)
    document.getElementById('btn-apply-warn')?.addEventListener('click', () => {
        if (!state.activeAuditUserId) return;
        const input = document.getElementById('audit-warn-reason-input');
        const reason = input ? input.value.trim() : '';
        if (!reason) {
            alert('Por favor, informe o motivo da advertência.');
            return;
        }
        sendWs({
            type: 'admin_warn_user',
            targetUserId: state.activeAuditUserId,
            targetUsername: state.currentAuditData?.targetUsername || '',
            reason: reason
        });
        if (input) input.value = '';
    });

    // Botão Purgar Todas as Mensagens
    document.getElementById('btn-audit-purge-all')?.addEventListener('click', () => {
        if (!state.activeAuditUserId) return;
        const name = state.currentAuditData?.targetUsername || 'este usuário';
        if (confirm(`Tem certeza que deseja apagar TODAS as mensagens de ${name} em todos os canais do servidor?`)) {
            sendWs({
                type: 'admin_purge_user_messages',
                targetUserId: state.activeAuditUserId,
                targetUsername: name
            });
        }
    });

    // Botão Mutar no Servidor
    document.getElementById('btn-audit-toggle-mute')?.addEventListener('click', () => {
        if (!state.activeAuditUserId) return;
        sendWs({
            type: 'admin_toggle_server_mute',
            targetUserId: state.activeAuditUserId,
            targetUsername: state.currentAuditData?.targetUsername || ''
        });
    });

    // Botão Expulsar (Kick)
    document.getElementById('btn-audit-kick')?.addEventListener('click', () => {
        if (!state.activeAuditUserId) return;
        const name = state.currentAuditData?.targetUsername || 'este usuário';
        if (confirm(`Deseja expulsar ${name} do servidor?`)) {
            sendWs({
                type: 'admin_kick_user',
                targetUserId: state.activeAuditUserId,
                targetUsername: name
            });
            modal.style.display = 'none';
        }
    });

    // Botão Banir (Ban)
    document.getElementById('btn-audit-ban')?.addEventListener('click', () => {
        if (!state.activeAuditUserId) return;
        const name = state.currentAuditData?.targetUsername || 'este usuário';
        if (confirm(`ATENÇÃO: Deseja banir PERMANENTEMENTE ${name} do servidor? Ele não conseguirá mais entrar.`)) {
            sendWs({
                type: 'admin_ban_user',
                targetUserId: state.activeAuditUserId,
                targetUsername: name
            });
            modal.style.display = 'none';
        }
    });
}

// Inicializa controles do VOX após o carregamento da página
function startVoxApp() {
    initVoxStatusAndActivity();
    if (typeof initVoxDiscordSettings === 'function') initVoxDiscordSettings();
    renderMembersSidebar();
    updateMyProfileUI();
    // Sincronização em tempo real para amigos sempre se enxergarem
    setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            sendWs({ type: 'request_sync_users' });
        }
        renderMembersSidebar();
        renderVoiceUsers();
    }, 3000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startVoxApp);
} else {
    startVoxApp();
}


// =========================================================================
// PULSO CLIENTE 24/7 (KEEPALIVE DO VOX)
// =========================================================================
setInterval(() => {
    fetch('/ping').catch(() => {});
}, 300000); // A cada 5 minutos envia um pulso leve

// =========================================================================
// CONFIGURAÇÕES COMPLETAS ESTILO DISCORD (FUNCIONAIS - SEM COBRANÇA)
// =========================================================================
window.voxPrefs = (() => {
    const defaults = {
        theme: 'default',
        accent: '#00f2fe',
        uiZoom: 100,
        chatFontSize: 14,
        compactChat: false,
        reduceMotion: false,
        highContrast: false,
        soundVoice: true,
        soundChat: true,
        showToasts: true,
        shareActivity: true,
        showOnline: true,
        enableKeybinds: true,
        timeFormat: '24h',
        devMode: false,
        micVolume: 100,
        outVolume: 100,
        inputMode: 'vad',
        pttKey: 'v',
        micSensitivity: 50,
        soundboardVol: 80
    };
    try {
        const saved = JSON.parse(localStorage.getItem('vox_user_prefs') || '{}');
        return { ...defaults, ...saved };
    } catch (e) {
        return defaults;
    }
})();

function saveVoxPrefs() {
    try { localStorage.setItem('vox_user_prefs', JSON.stringify(window.voxPrefs)); } catch (e) {}
    applyVoxVisualPrefs();
}

function applyVoxVisualPrefs() {
    const p = window.voxPrefs;
    let styleEl = document.getElementById('vox-dynamic-prefs-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'vox-dynamic-prefs-style';
        document.head.appendChild(styleEl);
    }

    let themeCss = '';
    if (p.theme === 'amoled') {
        themeCss = `
            body, .main-stage-area, .chat-container { background-color: #000000 !important; }
            .channels-sidebar, .members-sidebar, .user-footer, .servers-rail { background-color: #06070a !important; }
        `;
    } else if (p.theme === 'cyber') {
        themeCss = `
            body, .main-stage-area, .chat-container { background-color: #130b24 !important; }
            .channels-sidebar, .members-sidebar, .user-footer { background-color: #0d0719 !important; }
            .servers-rail { background-color: #080410 !important; }
        `;
    } else if (p.theme === 'ocean') {
        themeCss = `
            body, .main-stage-area, .chat-container { background-color: #0a192f !important; }
            .channels-sidebar, .members-sidebar, .user-footer { background-color: #071324 !important; }
            .servers-rail { background-color: #040c18 !important; }
        `;
    } else if (p.theme === 'emerald') {
        themeCss = `
            body, .main-stage-area, .chat-container { background-color: #061b14 !important; }
            .channels-sidebar, .members-sidebar, .user-footer { background-color: #04130e !important; }
            .servers-rail { background-color: #020a07 !important; }
        `;
    }

    const accentCss = p.accent && p.accent !== '#00f2fe'
        ? `:root { --kord-accent: ${p.accent}; } .opt-card.active, .settings-tab.active { border-color: ${p.accent} !important; }`
        : '';
    const zoomCss = (p.uiZoom && p.uiZoom !== 100) ? `body { zoom: ${p.uiZoom}%; }` : '';
    const compactCss = p.compactChat ? `.chat-msg, .message-row { padding-top: 2px !important; padding-bottom: 2px !important; margin-bottom: 2px !important; }` : '';
    const motionCss = p.reduceMotion ? `*, *::before, *::after { transition: none !important; animation: none !important; }` : '';
    const contrastCss = p.highContrast ? `body, .chat-text, .member-name { color: #ffffff !important; } .channel-item, .voice-channel { border: 1px solid rgba(255,255,255,0.08); }` : '';

    styleEl.textContent = `
        ${themeCss}
        ${accentCss}
        ${zoomCss}
        .chat-text { font-size: ${p.chatFontSize || 14}px !important; }
        ${compactCss}
        ${motionCss}
        ${contrastCss}
    `;
}

function initVoxDiscordSettings() {
    applyVoxVisualPrefs();
    const p = window.voxPrefs;

    // 1. Atualiza mini cabeçalho da sidebar + info dev ao abrir configurações
    const refreshSettingsMeta = () => {
        const sbName = document.getElementById('settings-sidebar-name');
        const sbAv = document.getElementById('settings-sidebar-avatar');
        if (sbName) sbName.textContent = state.username || 'Você';
        if (sbAv) applyAvatarToElement(sbAv, state.username, state.avatarColor, state.avatarUrl);

        const devUid = document.getElementById('dev-my-userid');
        const devSrv = document.getElementById('dev-current-server');
        const devWs = document.getElementById('dev-ws-status');
        if (devUid) devUid.textContent = state.userId || '-';
        if (devSrv) devSrv.textContent = state.currentServerId || 'default';
        if (devWs) {
            const isOpen = (typeof socket !== 'undefined' && socket && socket.readyState === WebSocket.OPEN);
            devWs.textContent = isOpen ? 'Conectado (Tempo Real)' : 'Reconectando...';
            devWs.style.color = isOpen ? '#22c55e' : '#f59e0b';
        }

        const curGameEl = document.getElementById('settings-games-current');
        if (curGameEl) {
            curGameEl.textContent = (state.userActivity && state.userActivity.name)
                ? `🎮 Jogando ${state.userActivity.name}`
                : 'Nenhuma atividade definida';
        }
    };

    const origOpenSettings = window.openUserSettingsModal || openUserSettingsModal;
    if (typeof origOpenSettings === 'function' && !window._voxSettingsWrapped) {
        window._voxSettingsWrapped = true;
        const _orig = origOpenSettings;
        openUserSettingsModal = function(tabName = 'profile') {
            _orig(tabName);
            refreshSettingsMeta();
        };
    }

    // 2. Busca em tempo real nas abas da sidebar
    const searchInp = document.getElementById('settings-search-input');
    if (searchInp) {
        searchInp.addEventListener('input', () => {
            const q = searchInp.value.trim().toLowerCase();
            document.querySelectorAll('.settings-sidebar .settings-tab').forEach(tab => {
                if (tab.id === 'btn-settings-logout') return;
                tab.style.display = (!q || tab.textContent.toLowerCase().includes(q)) ? 'flex' : 'none';
            });
        });
    }

    // 3. Checkboxes sincronizados com voxPrefs
    const bindChk = (id, key, onChangeExtra = null) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.checked = !!p[key];
        el.addEventListener('change', () => {
            p[key] = el.checked;
            saveVoxPrefs();
            if (onChangeExtra) onChangeExtra(el.checked);
        });
    };

    bindChk('pref-share-activity', 'shareActivity', (val) => {
        if (!val && typeof clearUserActivity === 'function') clearUserActivity();
        showToast(val ? '🎮 Exibição de atividade ativada.' : '🔒 Atividade ocultada.');
    });
    bindChk('pref-show-online', 'showOnline', (val) => {
        if (typeof setUserStatus === 'function') setUserStatus(val ? 'online' : 'invisible');
    });
    bindChk('pref-sound-voice', 'soundVoice');
    bindChk('pref-sound-chat', 'soundChat');
    bindChk('pref-show-toasts', 'showToasts');
    bindChk('pref-compact-chat', 'compactChat');
    bindChk('pref-reduce-motion', 'reduceMotion');
    bindChk('pref-high-contrast', 'highContrast');
    bindChk('pref-enable-keybinds', 'enableKeybinds');
    bindChk('pref-dev-mode', 'devMode');

    // 4. Temas, Cor de Destaque e Zoom (Aparência PRO)
    document.querySelectorAll('#pref-opt-theme .opt-card').forEach(card => {
        card.classList.toggle('active', card.dataset.theme === p.theme);
        card.addEventListener('click', () => {
            document.querySelectorAll('#pref-opt-theme .opt-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            p.theme = card.dataset.theme;
            saveVoxPrefs();
            showToast(`🎨 Tema alterado!`);
        });
    });

    document.querySelectorAll('#pref-opt-accent .opt-card').forEach(card => {
        card.classList.toggle('active', card.dataset.accent === p.accent);
        card.addEventListener('click', () => {
            document.querySelectorAll('#pref-opt-accent .opt-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            p.accent = card.dataset.accent;
            saveVoxPrefs();
            showToast('✨ Cor de destaque atualizada!');
        });
    });

    const zoomSlider = document.getElementById('pref-ui-zoom');
    const zoomVal = document.getElementById('pref-zoom-val');
    if (zoomSlider) {
        zoomSlider.value = p.uiZoom || 100;
        if (zoomVal) zoomVal.textContent = `${zoomSlider.value}%`;
        zoomSlider.addEventListener('input', () => {
            p.uiZoom = parseInt(zoomSlider.value);
            if (zoomVal) zoomVal.textContent = `${p.uiZoom}%`;
            saveVoxPrefs();
        });
    }

    // 4.5 Voz PRO: Volume Entrada, Volume Saída, Push-to-Talk e Sensibilidade
    const micVolSlider = document.getElementById('pref-mic-volume');
    const micVolVal = document.getElementById('pref-mic-vol-val');
    if (micVolSlider) {
        micVolSlider.value = p.micVolume ?? 100;
        if (micVolVal) micVolVal.textContent = `${micVolSlider.value}%`;
        micVolSlider.addEventListener('input', () => {
            p.micVolume = parseInt(micVolSlider.value);
            if (micVolVal) micVolVal.textContent = `${p.micVolume}%`;
            if (voiceGateGain && voiceAudioCtx && !state.isMuted) {
                try { voiceGateGain.gain.setTargetAtTime(Math.max(0.05, p.micVolume / 100), voiceAudioCtx.currentTime, 0.02); } catch (e) {}
            }
            saveVoxPrefs();
        });
    }

    const outVolSlider = document.getElementById('pref-out-volume');
    const outVolVal = document.getElementById('pref-out-vol-val');
    if (outVolSlider) {
        outVolSlider.value = p.outVolume ?? 100;
        if (outVolVal) outVolVal.textContent = `${outVolSlider.value}%`;
        outVolSlider.addEventListener('input', () => {
            p.outVolume = parseInt(outVolSlider.value);
            if (outVolVal) outVolVal.textContent = `${p.outVolume}%`;
            const factor = Math.min(1.0, Math.max(0, p.outVolume / 100));
            state.remoteAudioElements.forEach((el, uid) => {
                if (!state.isDeafened && !state.userMutedLocally.has(uid)) {
                    const uVol = (state.userVolumes.get(uid) ?? 100) / 100;
                    el.volume = Math.min(1.0, uVol * factor);
                }
            });
            saveVoxPrefs();
        });
    }

    const pttBox = document.getElementById('ptt-key-config-box');
    const pttBtn = document.getElementById('btn-record-ptt-key');
    const updatePttUI = () => {
        if (pttBox) pttBox.style.display = (p.inputMode === 'ptt') ? 'block' : 'none';
        if (pttBtn) pttBtn.textContent = `Tecla: ${(p.pttKey || 'v').toUpperCase()}`;
    };
    updatePttUI();

    document.querySelectorAll('#pref-opt-input-mode .opt-card').forEach(card => {
        card.classList.toggle('active', card.dataset.mode === p.inputMode);
        card.addEventListener('click', () => {
            document.querySelectorAll('#pref-opt-input-mode .opt-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            p.inputMode = card.dataset.mode;
            saveVoxPrefs();
            updatePttUI();
            if (p.inputMode === 'ptt') {
                setMicrophoneMuted(true);
                showToast(`⌨️ Push-to-Talk ativado! Segure [${(p.pttKey || 'v').toUpperCase()}] para falar.`);
            } else {
                setMicrophoneMuted(false);
                showToast('🎙️ Atividade de Voz automática ativada!');
            }
        });
    });

    let recordingPtt = false;
    if (pttBtn) {
        pttBtn.addEventListener('click', () => {
            recordingPtt = true;
            pttBtn.textContent = 'Pressione qualquer tecla...';
        });
    }
    document.addEventListener('keydown', (e) => {
        if (recordingPtt) {
            e.preventDefault();
            recordingPtt = false;
            p.pttKey = e.key.toLowerCase();
            saveVoxPrefs();
            updatePttUI();
            showToast(`⌨️ Tecla Push-to-Talk definida: ${p.pttKey.toUpperCase()}`);
            return;
        }
        if (p.inputMode === 'ptt' && !e.repeat && e.key.toLowerCase() === (p.pttKey || 'v') && document.activeElement?.tagName !== 'INPUT') {
            if (state.currentVoiceChannel && state.currentVoiceChannel !== 'afk' && state.isMuted) {
                setMicrophoneMuted(false);
            }
        }
    });
    document.addEventListener('keyup', (e) => {
        if (p.inputMode === 'ptt' && e.key.toLowerCase() === (p.pttKey || 'v') && document.activeElement?.tagName !== 'INPUT') {
            if (state.currentVoiceChannel && !state.isMuted) {
                setMicrophoneMuted(true);
            }
        }
    });

    const sensSlider = document.getElementById('pref-mic-sensitivity');
    const sensVal = document.getElementById('pref-mic-sens-val');
    if (sensSlider) {
        sensSlider.value = p.micSensitivity ?? 50;
        if (sensVal) sensVal.textContent = `${sensSlider.value}%`;
        sensSlider.addEventListener('input', () => {
            p.micSensitivity = parseInt(sensSlider.value);
            if (sensVal) sensVal.textContent = `${p.micSensitivity}%`;
            saveVoxPrefs();
        });
    }

    // 4.6 Soundboard (Painel de Efeitos Sonoros sintetizado em Web Audio API)
    const sbVolSlider = document.getElementById('pref-soundboard-vol');
    const sbVolVal = document.getElementById('pref-sb-vol-val');
    if (sbVolSlider) {
        sbVolSlider.value = p.soundboardVol ?? 80;
        if (sbVolVal) sbVolVal.textContent = `${sbVolSlider.value}%`;
        sbVolSlider.addEventListener('input', () => {
            p.soundboardVol = parseInt(sbVolSlider.value);
            if (sbVolVal) sbVolVal.textContent = `${p.soundboardVol}%`;
            saveVoxPrefs();
        });
    }

    const playSoundboardFx = (type) => {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const vol = Math.max(0.05, (p.soundboardVol ?? 80) / 100) * 0.35;
            const now = ctx.currentTime;
            const playTone = (freq, start, dur, wave = 'sine', endFreq = null) => {
                const osc = ctx.createOscillator();
                const g = ctx.createGain();
                osc.type = wave;
                osc.frequency.setValueAtTime(freq, now + start);
                if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, now + start + dur);
                g.gain.setValueAtTime(vol, now + start);
                g.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
                osc.connect(g);
                g.connect(ctx.destination);
                osc.start(now + start);
                osc.stop(now + start + dur + 0.02);
            };
            if (type === 'fanfare') { playTone(523, 0, 0.14, 'triangle'); playTone(659, 0.13, 0.14, 'triangle'); playTone(784, 0.26, 0.35, 'triangle'); }
            else if (type === 'alert') { playTone(880, 0, 0.15, 'sawtooth'); playTone(660, 0.16, 0.2, 'sawtooth'); }
            else if (type === 'coin') { playTone(988, 0, 0.09, 'square'); playTone(1319, 0.09, 0.28, 'square'); }
            else if (type === 'laser') { playTone(1400, 0, 0.25, 'sawtooth', 180); }
            else if (type === 'bell') { playTone(1046, 0, 0.6, 'sine'); playTone(2093, 0, 0.4, 'sine'); }
            else if (type === 'fail') { playTone(380, 0, 0.2, 'sawtooth', 320); playTone(290, 0.22, 0.4, 'sawtooth', 180); }
        } catch (e) {}
    };

    document.querySelectorAll('.vox-sb-btn').forEach(btn => {
        btn.addEventListener('click', () => playSoundboardFx(btn.dataset.sound));
    });

    // 5. Tamanho da fonte do chat
    const fontSlider = document.getElementById('pref-chat-font-size');
    const fontVal = document.getElementById('pref-font-size-val');
    if (fontSlider) {
        fontSlider.value = p.chatFontSize || 14;
        if (fontVal) fontVal.textContent = `${fontSlider.value}px`;
        fontSlider.addEventListener('input', () => {
            p.chatFontSize = parseInt(fontSlider.value);
            if (fontVal) fontVal.textContent = `${p.chatFontSize}px`;
            saveVoxPrefs();
        });
    }

    // 6. Formato do relógio (24h / 12h)
    document.querySelectorAll('#pref-opt-timeformat .opt-card').forEach(card => {
        card.classList.toggle('active', card.dataset.timefmt === p.timeFormat);
        card.addEventListener('click', () => {
            document.querySelectorAll('#pref-opt-timeformat .opt-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            p.timeFormat = card.dataset.timefmt;
            saveVoxPrefs();
            showToast(`🕒 Formato de horário: ${p.timeFormat === '12h' ? '12 horas' : '24 horas'}`);
        });
    });

    // 7. Jogos registrados (botões rápidos)
    document.querySelectorAll('.settings-quick-game-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const game = btn.getAttribute('data-game') || '';
            if (!game) {
                if (typeof clearUserActivity === 'function') clearUserActivity();
            } else {
                state.userActivity = { type: 'playing', name: game };
                try { localStorage.setItem('vox_user_activity', JSON.stringify(state.userActivity)); } catch (e) {}
                sendWs({ type: 'set_activity', activity: state.userActivity });
                renderMembersSidebar();
                showToast(`🎮 Atividade definida: Jogando ${game}`);
            }
            refreshSettingsMeta();
        });
    });

    const openActFromSettings = document.getElementById('btn-settings-open-activity');
    if (openActFromSettings) {
        openActFromSettings.addEventListener('click', () => {
            closeUserSettingsModal();
            const actModal = document.getElementById('user-activity-modal');
            if (actModal) actModal.style.display = 'flex';
        });
    }

    // 8. Limpar Cache Local
    const clearCacheBtn = document.getElementById('btn-clear-local-cache');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            if (confirm('Limpar preferências locais e volumes salvos neste navegador? Sua conta e VIP na nuvem continuarão intactos.')) {
                try {
                    localStorage.removeItem('dc_user_volumes');
                    localStorage.removeItem('vox_user_prefs');
                } catch (e) {}
                showToast('🧹 Cache local limpo! Recarregando...');
                setTimeout(() => location.reload(), 800);
            }
        });
    }

    // 9. Copiar User ID (Desenvolvedor)
    const copyUidBtn = document.getElementById('btn-copy-my-userid');
    if (copyUidBtn) {
        copyUidBtn.addEventListener('click', () => {
            if (navigator.clipboard && state.userId) {
                navigator.clipboard.writeText(state.userId).then(() => showToast('📋 User ID copiado!'));
            }
        });
    }

    // 10. Botão Sair
    const logoutBtn = document.getElementById('btn-settings-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            if (confirm('Deseja sair da sua sessão atual no VOX?')) {
                if (state.currentVoiceChannel) leaveVoiceChannel(true);
                try {
                    localStorage.removeItem('kord_user_profile');
                    localStorage.removeItem('discord_user_profile');
                    localStorage.removeItem('dc_username');
                    localStorage.removeItem('vox_username');
                    localStorage.removeItem('vox_avatar_url');
                } catch (e) {}
                location.reload();
            }
        });
    }

    // 11. Atalhos de teclado globais funcionais (Ctrl+Shift+M, Ctrl+Shift+D, Escape)
    document.addEventListener('keydown', (e) => {
        if (!window.voxPrefs || window.voxPrefs.enableKeybinds === false) return;
        if (e.key === 'Escape') {
            ['user-settings-modal', 'stream-modal', 'iptv-modal', 'vip-modal', 'create-server-modal', 'invite-modal', 'user-activity-modal'].forEach(id => {
                const m = document.getElementById(id);
                if (m && m.style.display !== 'none') m.style.display = 'none';
            });
            return;
        }
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            document.getElementById('btn-mic')?.click();
        } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            document.getElementById('btn-deafen')?.click();
        }
    });
}
