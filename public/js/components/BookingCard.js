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
        // Enforce single active booking visualization for now (as per UI design)
        // If there are multiple, we still iterate but design favors rows.
        activeBookings.forEach(booking => {
            const isOwner = booking.participation_type === 'owner';
            const btnText = isOwner ? 'Cancelar' : 'Abandonar';
            const action = isOwner ? 'cancel' : 'leave';

            const dateObj = new Date(booking.start_time);

            // Format Date: "18 de diciembre, 2025"
            const dateOptions = { day: 'numeric', month: 'long', year: 'numeric' };
            const formattedDate = dateObj.toLocaleDateString('es-ES', dateOptions);

            // Format Time: "10:30 AM"
            const timeOptions = { hour: '2-digit', minute: '2-digit', hour12: true };
            const formattedTime = dateObj.toLocaleTimeString('es-ES', timeOptions).toUpperCase();

            const courtName = booking.court_name || 'Pista Central'; // Default if missing

            const cardHTML = `
                <div class="bg-white border border-slate-200 rounded-xl p-4 md:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
                    <div class="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                        <span class="text-slate-900 font-bold text-lg" id="booking-court-name">${courtName}</span>
                        <div class="flex items-center gap-2 text-slate-600">
                            <span>${formattedDate}</span>
                            <span class="text-slate-400 font-normal">|</span>
                            <span>${formattedTime}</span>
                        </div>
                        <span class="inline-flex items-center rounded-md bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 ring-1 ring-inset ring-blue-700/10">
                            Próxima
                        </span>
                    </div>
                    <button class="action-btn w-full md:w-auto inline-flex justify-center items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors" data-action="${action}" data-id="${booking.id}">
                       <span class="material-icons-round text-lg mr-1.5 pointer-events-none">cancel</span>
                       ${btnText}
                    </button>
                </div>
            `;

            // Append to container
            container.innerHTML += cardHTML;
        });
    } else {
        // This state should be handled by dashboard.js logic (EMPTY_BOOKING_STATE),
        // but as a fallback:
        container.innerHTML = '<p class="text-slate-500">No tienes ninguna reserva activa.</p>';
    }
}

/**
 * Inicializa los listeners de eventos para las acciones de la tarjeta.
 * @param {HTMLElement} container - El contenedor de las reservas.
 * @param {object} handlers - Objeto con handlers { onCancel: (id) => {}, onLeave: (id) => {} }
 */
export function init(container, handlers) {
    container.addEventListener('click', (e) => {
        // Handle click on button or inside button (e.g. icon)
        const btn = e.target.closest('.action-btn');
        if (!btn) return;

        const id = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'cancel' && handlers.onCancel) {
            handlers.onCancel(id);
        } else if (action === 'leave' && handlers.onLeave) {
            handlers.onLeave(id);
        }
    });
}
