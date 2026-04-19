import api from './js/services/api.js';
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

    // 1. Cargar datos del usuario actual y de la partida
    try {
        // Fetch current user details
        currentUser = await api.get('/users/me');

        // Fetch match details
        const data = await api.get(`/matches/${bookingId}/details`);

        renderMatch(data, currentUser.id);
        joinChat(bookingId, currentUser);
    } catch (err) {
        console.error("Error cargando detalles:", err);
        showNotification("Error cargando los detalles de la partida.", "error");
    }

    // 2. Lógica del Chat
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const chatWindow = document.getElementById('chat-messages');

    function renderMatch(data, currentUserId) {
        document.getElementById('match-title').textContent = data.matchInfo.court_name;

        // Renderizar jugadores (sin piso ni puerta, y usando iniciales o icono)
        const list = document.getElementById('players-list');
        list.innerHTML = data.players.map(p => {
            // Get initials
            const initials = p.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            // Assign a gradient class based on user id (1-5)
            const gradientClass = `avatar-gradient-${(p.id % 5) + 1}`;
            const roleBadge = p.role === 'admin' ? '<span class="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full mt-1">Admin</span>' : '';

            return `
            <div class="player-card">
                <div class="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl mb-3 ${gradientClass}">
                    ${initials}
                </div>
                <span class="player-name">${p.name} ${p.id === currentUserId ? '(Tú)' : ''}</span>
                ${roleBadge}
            </div>
        `}).join('');

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

        chatForm.onsubmit = (e) => {
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
        };

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
