import { fetchApi } from './js/services/api.js';
import { showNotification } from './js/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    const token = localStorage.getItem('authToken');
    const socket = window.io ? window.io() : { emit: () => {}, on: () => {} }; // graceful fallback

    if (!bookingId || !token) {
        window.location.href = '/dashboard.html';
        return;
    }

    let currentUser = null;
    let matchData = null;

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
                    await fetchApi(`/bookings/${id}/leave`, { method: 'POST' });
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
        socket.emit('joinMatchChat', id);

        chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const msg = chatInput.value.trim();
            if(!msg) return;

            socket.emit('sendMessage', {
                bookingId: id,
                userId: user.id,
                message: msg,
                userName: user.name
            });
            chatInput.value = '';
        });

        socket.on('receiveMessage', (data) => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = createMessageHtml(data, user.id);
            // Append the child inside tempDiv to chatWindow
            chatWindow.appendChild(tempDiv.firstElementChild);
            chatWindow.scrollTop = chatWindow.scrollHeight;
        });
    }
});
