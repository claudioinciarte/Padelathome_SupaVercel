import { fetchApi } from './js/services/api.js';
import { showNotification } from './js/utils.js';
import { subscribeToMatchChat } from './js/services/supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    const token = localStorage.getItem('authToken');

    if (!bookingId || !token) {
        window.location.href = '/dashboard.html';
        return;
    }

    let currentUser = null;
    let matchData = null;
    let renderedMessageCount = 0;
    const renderedMessageIds = new Set(); // Deduplicación POST-echo vs Realtime

    // Inicializar elementos del DOM
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatWindow = document.getElementById('chat-messages');

    // 1. Cargar datos del usuario actual y de la partida
    try {
        currentUser = await fetchApi('/users/me');
        matchData = await fetchApi(`/matches/${bookingId}/details`);

        renderMatch(matchData, currentUser.id);

        // Top right avatar update
        if (currentUser && currentUser.name) {
            const names = currentUser.name.split(' ');
            const initials = names.length > 1
                ? names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase()
                : names[0].substring(0, 2).toUpperCase();
            const avatarSpan = document.getElementById('user-avatar-text');
            if (avatarSpan) {
                avatarSpan.textContent = initials;
            }
        }

        joinChat(bookingId, currentUser);
        setupActions(bookingId);
    } catch (err) {
        console.error("Error cargando detalles:", err);
        showNotification("Error cargando los detalles de la partida.", "error");
    }

    function setupActions(id) {
        const btnLeaveDesktop = document.getElementById('btn-leave-desktop');
        const btnLeaveMobile = document.getElementById('btn-leave-mobile');

        const handleLeave = async () => {
            if(confirm("¿Estás seguro de que quieres retirarte de la partida?")) {
                try {
                    await fetchApi(`/matches/${id}/leave`, { method: 'DELETE' });
                    showNotification("Te has retirado de la partida.", "success");
                    setTimeout(() => window.location.href = '/dashboard.html', 1500);
                } catch(e) {
                    showNotification("Error al retirarse de la partida.", "error");
                }
            }
        };

        if(btnLeaveDesktop) btnLeaveDesktop.addEventListener('click', handleLeave);
        if(btnLeaveMobile) btnLeaveMobile.addEventListener('click', handleLeave);
    }

    function renderMatch(data, currentUserId) {
        const match = data.matchInfo;

        // Match Headers Info
        document.getElementById('match-court-name').textContent = match.court_name;

        // Date and Time Parsing
        const start = new Date(match.start_time);
        const end = new Date(match.end_time);

        const dateOptions = { day: 'numeric', month: 'long' };
        const timeOptions = { hour: '2-digit', minute: '2-digit' };

        const dateStr = start.toLocaleDateString('es-ES', dateOptions);
        const timeStr = `${start.toLocaleTimeString('es-ES', timeOptions)} - ${end.toLocaleTimeString('es-ES', timeOptions)}`;

        const durMinutes = Math.round((end - start) / 60000);

        document.getElementById('match-date-desktop').textContent = dateStr;
        document.getElementById('match-date-mobile').textContent = dateStr;
        document.getElementById('match-time-desktop').textContent = timeStr;
        document.getElementById('match-time-mobile').textContent = timeStr;
        document.getElementById('match-duration').textContent = `${durMinutes} Minutos`;

        const maxPlayers = 4; // Assuming 4 for padel
        const currentPlayersCount = data.players.length;
        document.getElementById('match-players-count').textContent = `${maxPlayers} Jugadores`;
        document.getElementById('players-completion').textContent = `${currentPlayersCount}/${maxPlayers} Completado`;

        // Render Players
        const grid = document.getElementById('players-grid');
        let gridHtml = '';

        // 1. Confirmed Players
        data.players.forEach((p, idx) => {
            const isOwner = p.id === match.user_id;
            const names = p.name.split(' ');
            const initials = names.length > 1
                ? names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase()
                : names[0].substring(0, 2).toUpperCase();

            gridHtml += `
                <div class="bg-surface-container-lowest p-4 rounded-3xl flex flex-col items-center text-center space-y-3 shadow-sm border border-outline-variant/10">
                    <div class="relative">
                        <div class="w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center bg-primary/10 text-primary font-bold text-xl uppercase tracking-wider">
                            ${initials}
                        </div>
                        <div class="absolute -bottom-1 -right-1 bg-secondary text-white rounded-full p-0.5 shadow-md">
                            <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                        </div>
                    </div>
                    <div>
                        <p class="font-bold text-on-surface leading-tight">${p.name}</p>
                        <p class="text-[10px] text-secondary font-bold uppercase tracking-wider">Confirmado</p>
                    </div>
                </div>
            `;
        });

        // 2. Empty Slots
        const emptySlots = maxPlayers - currentPlayersCount;
        if(emptySlots > 0) {
            // First empty slot is 'Join'
            gridHtml += `
                <div class="bg-surface-container-low border-2 border-dashed border-outline-variant/30 p-4 rounded-3xl flex flex-col items-center justify-center text-center space-y-2 group active:scale-95 transition-all cursor-pointer hover:bg-surface-container-high" onclick="window.location.href='/dashboard.html'">
                    <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <span class="material-symbols-outlined">add</span>
                    </div>
                    <p class="text-xs font-bold text-primary uppercase tracking-tight">Únete ahora</p>
                </div>
            `;

            // Remaining empty slots are 'Invite'
            for(let i=1; i < emptySlots; i++) {
                gridHtml += `
                <div class="bg-surface-container-low border-2 border-dashed border-outline-variant/30 p-4 rounded-3xl flex flex-col items-center justify-center text-center space-y-2 group active:scale-95 transition-all cursor-pointer hover:bg-surface-container-high" onclick="alert('Funcionalidad de invitar en desarrollo')">
                    <div class="w-12 h-12 rounded-full bg-outline-variant/10 flex items-center justify-center text-outline">
                        <span class="material-symbols-outlined">person_add</span>
                    </div>
                    <p class="text-xs font-bold text-on-surface-variant uppercase tracking-tight">Invitar amigo</p>
                </div>
                `;
            }
        }

        grid.innerHTML = gridHtml;

        // Render Chat History
        chatWindow.innerHTML = data.messages.map(m => createMessageHtml(m, currentUserId)).join('');
        chatWindow.scrollTop = chatWindow.scrollHeight;
        renderedMessageCount = data.messages.length;
        renderedMessageIds.clear();
        data.messages.forEach(m => renderedMessageIds.add(m.id));
    }

    function createMessageHtml(data, currentUserId) {
        const isSent = data.user_id === currentUserId || data.userId === currentUserId; // handle both historic (user_id) and realtime (userId) properties
        const time = new Date(data.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const userName = data.user_name || data.userName;

        // Derive initials for avatar fallback if needed, or just use the name above the bubble as in the design
        if (isSent) {
            return `
            <div class="flex items-start justify-end gap-3 w-full">
                <div class="bg-primary text-white p-3 rounded-2xl rounded-tr-none shadow-sm max-w-[85%]">
                    <p class="text-sm leading-relaxed font-medium">${data.message}</p>
                    <div class="flex items-center justify-end gap-1 mt-1">
                        <p class="text-[10px] text-white/70">${time}</p>
                        <span class="material-symbols-outlined text-[12px] text-white/90" style="font-variation-settings: 'FILL' 1;">done_all</span>
                    </div>
                </div>
            </div>`;
        } else {
            return `
            <div class="flex items-start gap-3 w-full">
                <div class="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                    ${userName.substring(0,2).toUpperCase()}
                </div>
                <div class="bg-surface-container-lowest p-3 rounded-2xl rounded-tl-none shadow-sm border border-outline-variant/10 max-w-[85%]">
                    <p class="text-[10px] font-bold text-primary uppercase mb-1">${userName}</p>
                    <p class="text-sm text-on-surface leading-relaxed">${data.message}</p>
                    <p class="text-[10px] text-outline text-right mt-1">${time}</p>
                </div>
            </div>`;
        }
    }

    function joinChat(id, user) {
        // Envío siempre por REST (persiste en la BD).
        // Recepción en tiempo real con Supabase Realtime (replicación de
        // Postgres); si el canal no conecta, cae a sondeo periódico.
        const playerNames = {};
        (matchData.players || []).forEach(p => { playerNames[p.id] = p.name; });

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const msg = chatInput.value.trim();
            if(!msg) return;

            try {
                const savedMessage = await fetchApi(`/matches/${id}/messages`, {
                    method: 'POST',
                    body: JSON.stringify({ message: msg })
                });
                if (savedMessage) {
                    savedMessage.user_name = user.name;
                    appendMessage(savedMessage, user.id);
                }
                chatInput.value = '';
            } catch (err) {
                console.error('Error enviando mensaje:', err);
                showNotification('No se pudo enviar el mensaje.', 'error');
            }
        });

        let realtimeActive = false;
        let pollingTimer = null;

        const stopPolling = () => {
            if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null; }
        };
        const startPolling = () => {
            if (pollingTimer) return;
            pollingTimer = setInterval(async () => {
                try {
                    const data = await fetchApi(`/matches/${id}/details`);
                    if (data.messages.length !== renderedMessageCount) {
                        chatWindow.innerHTML = data.messages.map(m => createMessageHtml(m, user.id)).join('');
                        chatWindow.scrollTop = chatWindow.scrollHeight;
                        renderedMessageCount = data.messages.length;
                        renderedMessageIds.clear();
                        data.messages.forEach(m => renderedMessageIds.add(m.id));
                    }
                } catch (err) {
                    // Silencioso: reintentará en el siguiente ciclo
                }
            }, 5000);
        };

        subscribeToMatchChat(id, (msg) => {
            realtimeActive = true;
            stopPolling();
            msg.user_name = playerNames[msg.user_id] || 'Usuario';
            appendMessage(msg, user.id);
        }, (status) => {
            if (status === 'SUBSCRIBED') {
                realtimeActive = true;
                stopPolling();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                if (!realtimeActive) startPolling();
            }
        });
    }

    function appendMessage(data, currentUserId) {
        if (data.id && renderedMessageIds.has(data.id)) return; // Ya renderizado (POST-echo o duplicado)
        if (data.id) renderedMessageIds.add(data.id);
        if (renderedMessageIds.size > 500) renderedMessageIds.clear(); // Evita crecer sin límite
        const messageEl = createMessageHtml(data, currentUserId);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = messageEl;
        chatWindow.appendChild(tempDiv.firstElementChild);
        chatWindow.scrollTop = chatWindow.scrollHeight;
        renderedMessageCount++;
    }
});
