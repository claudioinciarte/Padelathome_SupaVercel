/**
 * Renderiza la lista de reservas en el contenedor.
 * @param {HTMLElement} container - El elemento DOM donde renderizar.
 * @param {Array} bookings - Array de objetos booking.
 */
export function render(container, bookings) {
    container.innerHTML = '';
    // Filtrar bookings válidos (a veces la API puede devolver un objeto nulo si no hay reservas)
    const activeBookings = bookings.filter(b => b && b.id);

    if (activeBookings.length > 0) {
        activeBookings.forEach(booking => {
            const isOwner = booking.participation_type === 'owner';
            const btnText = isOwner ? 'Cancelar Reserva' : 'Abandonar Partida';

            const div = document.createElement('div');
            div.className = 'booking-item';

            const p = document.createElement('p');
            const strong = document.createElement('strong');
            strong.textContent = booking.court_name || 'Pista';
            p.appendChild(strong);
            p.append(` - ${new Date(booking.start_time).toLocaleString()}`);

            const btn = document.createElement('button');
            btn.className = 'action-btn';
            // Usamos clases de utilidad para estilos (rojo para cancelar)
            btn.classList.add(isOwner ? 'btn-danger' : 'btn-warning');
            btn.dataset.action = isOwner ? 'cancel' : 'leave';
            btn.dataset.id = booking.id;
            btn.textContent = btnText;

            div.appendChild(p);
            div.appendChild(btn);
            container.appendChild(div);
        });
    } else {
        container.innerHTML = '<p>No tienes ninguna reserva activa.</p>';
    }
}

/**
 * Inicializa los listeners de eventos para las acciones de la tarjeta.
 * @param {HTMLElement} container - El contenedor de las reservas.
 * @param {object} handlers - Objeto con handlers { onCancel: (id) => {}, onLeave: (id) => {} }
 */
export function init(container, handlers) {
    container.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' || !e.target.classList.contains('action-btn')) return;

        const id = e.target.dataset.id;
        const action = e.target.dataset.action;

        if (action === 'cancel' && handlers.onCancel) {
            handlers.onCancel(id);
        } else if (action === 'leave' && handlers.onLeave) {
            handlers.onLeave(id);
        }
    });
}
