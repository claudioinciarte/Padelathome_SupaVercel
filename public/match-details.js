import { fetchApi } from './js/services/api.js';
import { showNotification } from './js/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookingId = urlParams.get('id');
    const token = localStorage.getItem('authToken');
    const socket = io();

    if (!bookingId || !token) {
        window.location.href = '/dashboard.html';
        return;
    }

    let currentUser = null;

    // Inicializar elementos del DOM
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatWindow = document.getElementById('chat-messages');

    // 1. Cargar datos del usuario actual y de la partida
    try {
        // Fetch current user details
        currentUser = await fetchApi('/users/me');

        // Fetch match details
        const data = await fetchApi(`/matches/${bookingId}/details`);

        renderMatch(data, currentUser.id);
        joinChat(bookingId, currentUser);
    } catch (err) {
        console.error("Error cargando detalles:", err);
        showNotification("Error cargando los detalles de la partida.", "error");
    }

    function renderMatch(data, currentUserId) {
        document.getElementById('match-title').textContent = data.matchInfo.court_name;

        // Renderizar jugadores (usando avatar del dashboard)
        const list = document.getElementById('players-list');

        // El diseñador solicitó que los avatares se parezcan a los de open matches
        // Re-usamos la estructura visual del diseño original, pero adaptada
        let listHtml = '';
        data.players.forEach((p, idx) => {
            const isOwner = p.id === data.matchInfo.user_id; // Verificar si es el creador de la partida (dueño de la reserva)

            // Get initials
            const names = p.name.split(' ');
            const initials = names.length > 1
                ? names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase()
                : names[0].substring(0, 2).toUpperCase();

            // Ciclo a través de clases de gradiente definidas en style.css (1-5)
            const gradientNum = (p.id % 5) + 1;
            const gradientClass = `avatar-gradient-${gradientNum}`;

            const isMe = p.id === currentUserId;

            listHtml += `
                <div class="flex items-center p-3 rounded-lg bg-slate-50 border border-slate-100 mb-2">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ${gradientClass} flex-shrink-0">
                        ${initials}
                    </div>
                    <div class="ml-3 flex flex-col min-w-0 flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-slate-800 font-medium truncate ${isMe ? 'font-bold text-primary' : ''}">${p.name} ${isMe ? '(Tú)' : ''}</span>
                            ${isOwner ? '<span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-wide">Organizador</span>' : ''}
                        </div>
                        <span class="text-xs text-slate-500 truncate">
                            ${p.role === 'admin' ? 'Administrador' : 'Jugador'}
                        </span>
                    </div>
                </div>
            `;
        });

        list.className = ""; // Remove the CSS grid styling from the container as we use a list now
        list.innerHTML = listHtml;

        // Renderizar histórico de mensajes
        chatWindow.innerHTML = data.messages.map(m => {
            const isSent = m.user_id === currentUserId;
            const msgClass = isSent ? 'sent' : 'received';
            const time = new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            return `
            <div class="msg ${msgClass}">
                <span class="msg-user">${m.user_name}</span>
                ${m.message}
                <span class="msg-time">${time}</span>
            </div>
        `}).join('');

        // Scroll to bottom
        chatWindow.scrollTop = chatWindow.scrollHeight;
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
            const isSent = data.userId === user.id;
            const msgClass = isSent ? 'sent' : 'received';
            const time = new Date(data.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

            const div = document.createElement('div');
            div.className = `msg ${msgClass}`;
            div.innerHTML = `
                <span class="msg-user">${data.userName}</span>
                ${data.message}
                <span class="msg-time">${time}</span>
            `;
            chatWindow.appendChild(div);

            // Scroll to bottom
            chatWindow.scrollTop = chatWindow.scrollHeight;
        });
    }
});
