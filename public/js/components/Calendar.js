import { formatDate, formatTime } from '../utils.js';

/**
 * Renderiza la vista semanal (escritorio).
 */
export function renderWeekly(container, scheduleData, weekStart, weekEnd, userActiveBookings, selectedCourtId) {
    container.innerHTML = '';

    // Título o header opcional si se quiere renderizar dentro
    // (En dashboard.js se actualiza weekDatesTitle externamente, aquí solo el grid)

    const grid = document.createElement('div');
    grid.className = 'calendar-grid';

    // Cabeceras de días
    ['Horas', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach(d => {
        const div = document.createElement('div');
        div.className = 'grid-cell header';
        div.textContent = d;
        grid.appendChild(div);
    });

    const weekDays = Object.keys(scheduleData).sort();
    if(weekDays.length === 0) {
         container.innerHTML = '<p>No hay datos disponibles.</p>';
         return;
    }

    const timeSlots = scheduleData[weekDays[0]];
    const now = new Date();

    timeSlots.forEach((slot, index) => {
        // Columna Hora
        const timeDiv = document.createElement('div');
        timeDiv.className = 'grid-cell time-header';
        timeDiv.textContent = formatTime(new Date(slot.startTime));
        grid.appendChild(timeDiv);

        weekDays.forEach(dayKey => {
            const daySlot = scheduleData[dayKey][index];
            const cell = document.createElement('div');
            const slotTime = new Date(daySlot.startTime);

            let status = daySlot.status;
            if (slotTime < now) status = 'past';

            cell.className = `grid-cell slot ${status}`;

            // Identificar si es 'mío'
            const myBooking = userActiveBookings.find(b => {
                const bStart = new Date(b.start_time).getTime();
                const sStart = slotTime.getTime();
                // Margen de error pequeño o igualdad exacta
                return Math.abs(bStart - sStart) < 1000 && b.court_id === selectedCourtId;
            });

            if (myBooking) {
                cell.classList.add('my-booking');
                status = myBooking.is_open_match ? 'my_open_match' : 'my_private_booking';
                cell.dataset.participationType = myBooking.participation_type; // 'owner' or 'participant'
                cell.dataset.bookingId = myBooking.id;
            } else if (daySlot.bookingId) {
                cell.dataset.bookingId = daySlot.bookingId;
            }

            // Atributos de datos
            cell.dataset.status = status;
            cell.dataset.starttime = daySlot.startTime;
            if (daySlot.participants) cell.dataset.participants = daySlot.participants;
            if (daySlot.maxParticipants) cell.dataset.maxParticipants = daySlot.maxParticipants;

            // Texto de la celda
            let text = '';
            if (status === 'available') text = 'Libre';
            else if (status === 'booked') text = 'Ocupado';
            else if (status === 'blocked') text = daySlot.reason || 'X';
            else if (status === 'open_match_available') text = `Abierta ${daySlot.participants}/${daySlot.maxParticipants}`;
            else if (status === 'open_match_full') text = 'Llena';
            else if (status === 'my_private_booking') text = 'Mía';
            else if (status === 'my_open_match') text = 'Inscrito';
            else if (status === 'past') text = '.';

            cell.textContent = text;
            grid.appendChild(cell);
        });
    });

    container.appendChild(grid);
}

/**
 * Renderiza la vista diaria (móvil) como acordeón.
 */
export function renderMobileDaily(container, slots) {
    const accordionContainer = container.querySelector('.accordion-container');
    if (!accordionContainer) return; // Debe existir la estructura base

    accordionContainer.innerHTML = '';
    const now = new Date();

    if (!slots || slots.length === 0) {
        accordionContainer.innerHTML = '<p class="empty-text">No hay slots disponibles.</p>';
        return;
    }

    slots.forEach((slot, index) => {
        const slotTime = new Date(slot.startTime);
        let status = slot.status;
        if (slotTime < now) {
            status = 'past';
        }

        const div = document.createElement('div');
        div.className = `daily-slot ${status}`;
        div.innerHTML = `
            <div class="slot-header" data-status="${status}" data-index="${index}">
                <span class="slot-time">${formatTime(slotTime)}</span>
                <span class="slot-status-text">${getMobileStatusText({ ...slot, status })}</span>
                <span class="chevron">▼</span>
            </div>
            <div class="slot-details"></div>
        `;
        accordionContainer.appendChild(div);

        // Guardar referencia al slot para expandirlo
        div.querySelector('.slot-header')._slotData = slot;
    });
}

function getMobileStatusText(slot) {
    switch (slot.status) {
        case 'available': return 'Disponible';
        case 'booked': return 'Ocupado';
        case 'blocked': return slot.reason || 'Bloqueado';
        case 'open_match_available': return `Partida Abierta (${slot.participants || 1}/${slot.maxParticipants || 4})`;
        case 'open_match_full': return `Partida Llena`;
        case 'my_private_booking': return 'Mi Reserva';
        case 'my_open_match': return `Inscrito`;
        case 'past': return 'Finalizado';
        default: return 'No disponible';
    }
}

/**
 * Inicializa la delegación de eventos para el calendario (Escritorio y Móvil).
 * @param {HTMLElement} container - El contenedor padre (puede ser el document o una sección específica).
 * @param {Function} onSlotClick - Callback (slotData) => {}.
 */
export function init(container, onSlotClick) {

    // Delegación para Grid (Escritorio)
    container.addEventListener('click', (e) => {
        const cell = e.target.closest('.slot');
        if (!cell) return;

        const dataset = cell.dataset;
        // Convertimos dataset a objeto plano y casteamos tipos básicos
        const slotData = {
            status: dataset.status,
            startTime: dataset.starttime,
            bookingId: dataset.bookingId,
            participationType: dataset.participationType,
            participants: dataset.participants,
            maxParticipants: dataset.maxParticipants
        };

        onSlotClick(slotData);
    });
}
