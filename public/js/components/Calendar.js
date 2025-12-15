import { formatDate, formatTime, showNotification } from '../utils.js';

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
function renderSlotDetails(detailsContainer, slotData, onSlotClick) {
    const wasActive = detailsContainer.classList.contains('active');
    
    document.querySelectorAll('.slot-details.active').forEach(d => {
        d.classList.remove('active');
        d.innerHTML = '';
    });

    if (wasActive) return;

    detailsContainer.classList.add('active');

    const { status, startTime, bookingId, participants, maxParticipants } = slotData;

    const closeAccordion = () => {
        detailsContainer.classList.remove('active');
        detailsContainer.innerHTML = '';
    };

    switch (status) {
        case 'available':
            const durations = [60, 90];
            const optionsHtml = durations.map(d => `<button class="duration-btn" data-duration="${d}">${d} min</button>`).join('');
            
            detailsContainer.innerHTML = `
                <p>Elige duración:</p>
                <div class="duration-options">${optionsHtml}</div>
                <div class="form-group open-match-toggle">
                    <input type="checkbox" class="open-match-checkbox">
                    <label>Abrir partida (4 jugadores)</label>
                </div>
                <button class="confirm-booking-btn">Confirmar</button>
                <button class="cancel-action-btn">Cancelar</button>
            `;

            detailsContainer.querySelector('.confirm-booking-btn').addEventListener('click', () => {
                const duration = detailsContainer.querySelector('.duration-btn.selected')?.dataset.duration;
                if (!duration) {
                    showNotification('Por favor, selecciona una duración.', 'error');
                    return;
                }
                const isOpenMatch = detailsContainer.querySelector('.open-match-checkbox').checked;
                onSlotClick({ ...slotData, action: 'book', duration, isOpenMatch });
                closeAccordion();
            });
            
            detailsContainer.querySelectorAll('.duration-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    detailsContainer.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('selected'));
                    e.target.classList.add('selected');
                });
            });
            
            detailsContainer.querySelector('.cancel-action-btn').addEventListener('click', closeAccordion);
            break;
            
        case 'open_match_available':
            detailsContainer.innerHTML = `
                <p>Partida abierta con ${participants}/${maxParticipants} jugadores.</p>
                <button class="join-match-btn">Unirse a la Partida</button>
                <button class="cancel-action-btn">Cancelar</button>
            `;
            detailsContainer.querySelector('.join-match-btn').addEventListener('click', () => {
                onSlotClick({ ...slotData, action: 'join' });
                closeAccordion();
            });
            detailsContainer.querySelector('.cancel-action-btn').addEventListener('click', closeAccordion);
            break;

        case 'booked':
        case 'open_match_full':
            detailsContainer.innerHTML = `
                <p>Este horario está ocupado.</p>
                <button class="join-waitlist-btn">Apuntarse a Lista de Espera</button>
                <button class="cancel-action-btn">Cancelar</button>
            `;
            detailsContainer.querySelector('.join-waitlist-btn').addEventListener('click', () => {
                onSlotClick({ ...slotData, action: 'waitlist' });
                closeAccordion();
            });
            detailsContainer.querySelector('.cancel-action-btn').addEventListener('click', closeAccordion);
            break;
            
        case 'my_private_booking':
            detailsContainer.innerHTML = `<p>Tienes una reserva privada aquí.</p><button class="cancel-booking-btn">Cancelar Reserva</button> <button class="cancel-action-btn">Cerrar</button>`;
            detailsContainer.querySelector('.cancel-booking-btn').addEventListener('click', () => {
                onSlotClick({ ...slotData, action: 'cancel' });
                closeAccordion();
            });
            detailsContainer.querySelector('.cancel-action-btn').addEventListener('click', closeAccordion);
            break;

        case 'my_open_match':
            detailsContainer.innerHTML = `<p>Estás en esta partida.</p><button class="leave-match-btn">Abandonar Partida</button> <button class="cancel-action-btn">Cerrar</button>`;
            detailsContainer.querySelector('.leave-match-btn').addEventListener('click', () => {
                onSlotClick({ ...slotData, action: 'leave' });
                closeAccordion();
            });
            detailsContainer.querySelector('.cancel-action-btn').addEventListener('click', closeAccordion);
            break;

        default:
            detailsContainer.innerHTML = `<p>No hay acciones disponibles.</p><button class="cancel-action-btn">Cerrar</button>`;
            detailsContainer.querySelector('.cancel-action-btn').addEventListener('click', closeAccordion);
    }
}

export function init(container, onSlotClick) {
    container.addEventListener('click', (e) => {
        const desktopCell = e.target.closest('.slot');
        const mobileHeader = e.target.closest('.slot-header');

        if (desktopCell) {
            const dataset = desktopCell.dataset;
            const slotData = {
                status: dataset.status,
                startTime: dataset.starttime,
                bookingId: dataset.bookingId,
                participationType: dataset.participationType,
                participants: dataset.participants,
                maxParticipants: dataset.maxParticipants
            };
            if (slotData.status && slotData.status !== 'past') {
                onSlotClick(slotData);
            }
        } else if (mobileHeader) {
            const slotData = mobileHeader._slotData;
            if (slotData && slotData.status !== 'past') {
                const detailsContainer = mobileHeader.nextElementSibling;
                if (detailsContainer && detailsContainer.classList.contains('slot-details')) {
                    renderSlotDetails(detailsContainer, slotData, onSlotClick);
                }
            }
        }
    });
}
