import { formatDate, formatTime, showNotification } from '../utils.js';

/**
 * Renderiza la vista semanal (escritorio) usando una tabla HTML con Tailwind CSS.
 */
export function renderWeekly(container, scheduleData, weekStart, weekEnd, userActiveBookings, userWaitingListEntries, selectedCourtId) {
    container.innerHTML = '';
    const weekDays = Object.keys(scheduleData).sort();

    if (weekDays.length === 0) {
         container.innerHTML = '<p class="text-center p-4 text-slate-500">No hay datos disponibles.</p>';
         return;
    }

    const timeSlots = scheduleData[weekDays[0]];
    const now = new Date();

    // Determine "Today" for highlighting (if within the view)
    const todayStr = now.toISOString().split('T')[0];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // Create Table Structure
    const table = document.createElement('table');
    table.className = 'min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm border-separate border-spacing-0';

    // --- Header ---
    const thead = document.createElement('thead');
    thead.className = 'bg-slate-50 dark:bg-slate-800';

    const headerRow = document.createElement('tr');

    // Time Column Header
    const timeHeader = document.createElement('th');
    timeHeader.scope = 'col';
    timeHeader.className = 'px-4 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider w-20 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 border-b border-slate-200 dark:border-slate-700 shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]';
    timeHeader.textContent = 'Horas';
    headerRow.appendChild(timeHeader);

    // Day Columns Headers
    weekDays.forEach(dayKey => {
        const date = new Date(dayKey);
        const dayName = dayNames[date.getDay()];
        const isToday = dayKey === todayStr;

        const th = document.createElement('th');
        th.scope = 'col';
        th.className = `px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 ${
            isToday
            ? 'text-slate-900 dark:text-white bg-blue-50/50 dark:bg-blue-900/20'
            : 'text-slate-500 dark:text-slate-400'
        }`;
        th.textContent = dayName;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // --- Body ---
    const tbody = document.createElement('tbody');
    tbody.className = 'bg-white dark:bg-surface-dark divide-y divide-slate-200 dark:divide-slate-700';

    timeSlots.forEach((slotTemplate, index) => {
        const row = document.createElement('tr');

        // Time Cell (Sticky Left)
        const timeCell = document.createElement('td');
        timeCell.className = 'px-4 py-3 whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 sticky left-0 z-10 border-r border-slate-100 dark:border-slate-700 shadow-[1px_0_0_0_rgba(226,232,240,1)] dark:shadow-[1px_0_0_0_rgba(51,65,85,1)]';
        timeCell.textContent = formatTime(new Date(slotTemplate.startTime));
        row.appendChild(timeCell);

        // Slot Cells
        weekDays.forEach(dayKey => {
            const daySlot = scheduleData[dayKey][index];
            const td = document.createElement('td');
            const isToday = dayKey === todayStr;
            td.className = `px-2 py-2 text-center ${isToday ? 'bg-blue-50/10 dark:bg-blue-900/5' : ''}`;

            // Logic to determine status and styling
            const slotTime = new Date(daySlot.startTime);
            let status = daySlot.status;
            if (slotTime < now) status = 'past';

            // Check for user's bookings
            const myBooking = userActiveBookings.find(b => {
                const bStart = new Date(b.start_time).getTime();
                const sStart = slotTime.getTime();
                return Math.abs(bStart - sStart) < 1000 && b.court_id === selectedCourtId;
            });

            if (myBooking) {
                status = myBooking.is_open_match ? 'my_open_match' : 'my_private_booking';
                // Attach extra data for callbacks
                daySlot.bookingId = myBooking.id;
                daySlot.participationType = myBooking.participation_type;
                daySlot.durationMinutes = myBooking.duration_minutes;
            }

             // Check Waitlist logic
             if (status === 'booked' || status === 'open_match_full') {
                const isOnWaitlist = userWaitingListEntries.some(entry => {
                    if (entry.court_id !== selectedCourtId) return false;
                    const entryStartTime = new Date(entry.slot_start_time).getTime();
                    // Use stored duration or default 90
                    const duration = parseInt(entry.duration, 10) || 90;
                    const entryEndTime = entryStartTime + (duration * 60 * 1000);
                    const currentSlotTime = slotTime.getTime();
                    return currentSlotTime >= entryStartTime && currentSlotTime < entryEndTime;
                });
                if (isOnWaitlist) status = 'on_waitlist';
            }

            // --- Render Content based on Status ---
            const button = document.createElement('button');
            // Base button styles for interactive elements
            button.className = 'h-8 w-full rounded transition flex items-center justify-center text-xs font-medium';

            // Attach data to the BUTTON (since it's the click target) or the TD?
            // In init(), we check for closest('[data-status]'). Let's put data on the button for simplicity,
            // or the TD if we want the whole cell clickable. The user asked for "buttons".
            // Let's attach data to the button.

            button.dataset.status = status;
            button.dataset.starttime = daySlot.startTime;
            if (daySlot.bookingId) button.dataset.bookingId = daySlot.bookingId;
            if (daySlot.participants) button.dataset.participants = daySlot.participants;
            if (daySlot.maxParticipants) button.dataset.maxParticipants = daySlot.maxParticipants;
            if (daySlot.durationMinutes) button.dataset.duration = daySlot.durationMinutes;
            if (daySlot.participationType) button.dataset.participationType = daySlot.participationType;


            switch (status) {
                case 'available':
                    button.classList.add('bg-green-100', 'dark:bg-green-900/30', 'text-green-700', 'dark:text-green-300', 'hover:bg-green-200', 'dark:hover:bg-green-900/50');
                    button.textContent = 'Libre';
                    td.appendChild(button);
                    break;

                case 'booked':
                    button.classList.add('bg-red-100', 'dark:bg-red-900/30', 'text-red-700', 'dark:text-red-300', 'hover:bg-red-200', 'dark:hover:bg-red-900/50');
                    button.textContent = 'Ocupado';
                    td.appendChild(button);
                    break;

                case 'open_match_available':
                    button.classList.add('bg-amber-100', 'dark:bg-amber-900/30', 'text-amber-700', 'dark:text-amber-300', 'hover:bg-amber-200', 'dark:hover:bg-amber-900/50');
                    button.textContent = `Abierta ${daySlot.participants || 0}/${daySlot.maxParticipants || 4}`;
                    td.appendChild(button);
                    break;

                case 'open_match_full':
                    button.classList.add('bg-amber-50', 'dark:bg-amber-900/20', 'text-amber-800/60', 'dark:text-amber-500/60');
                    button.textContent = 'Llena';
                    td.appendChild(button);
                    break;

                case 'maintenance':
                case 'blocked':
                    // Non-interactive generally, but maybe admin can click? Keeping simple for user.
                    const divMaint = document.createElement('div');
                    divMaint.className = 'h-8 w-full rounded bg-slate-600 dark:bg-slate-700 text-white flex items-center justify-center text-xs font-medium cursor-not-allowed opacity-75';
                    divMaint.title = daySlot.reason || 'Mantenimiento';
                    divMaint.innerHTML = `
                        <span class="hidden lg:inline">${daySlot.reason || 'Mantenimiento'}</span>
                        <span class="lg:hidden material-icons-outlined text-sm">build</span>
                    `;
                    td.appendChild(divMaint);
                    break;

                case 'past':
                    const divPast = document.createElement('div');
                    divPast.className = 'h-8 w-full rounded bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center cursor-not-allowed text-slate-300 dark:text-slate-600';
                    divPast.innerHTML = '<span class="material-icons-outlined text-xs">block</span>';
                    td.appendChild(divPast);
                    break;

                case 'my_private_booking':
                    button.classList.add('bg-blue-100', 'dark:bg-blue-900/40', 'text-blue-700', 'dark:text-blue-300', 'border', 'border-blue-200', 'dark:border-blue-800', 'hover:bg-blue-200');
                    button.innerHTML = '<span class="material-icons-outlined text-xs mr-1">bookmark</span> Mía';
                    td.appendChild(button);
                    break;

                case 'my_open_match':
                    button.classList.add('bg-blue-50', 'dark:bg-blue-900/20', 'text-blue-600', 'dark:text-blue-400', 'border', 'border-blue-100', 'dark:border-blue-800');
                    button.innerHTML = '<span class="material-icons-outlined text-xs mr-1">groups</span> Inscrito';
                    td.appendChild(button);
                    break;

                case 'on_waitlist':
                     button.classList.add('bg-purple-100', 'dark:bg-purple-900/30', 'text-purple-700', 'dark:text-purple-300', 'hover:bg-purple-200');
                     button.innerHTML = '<span class="material-icons-outlined text-xs mr-1">access_time</span> Lista';
                     td.appendChild(button);
                     break;

                default:
                    // Fallback for unknown states
                    const divUnk = document.createElement('div');
                    divUnk.textContent = '-';
                    td.appendChild(divUnk);
            }

            row.appendChild(td);
        });

        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
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
        accordionContainer.innerHTML = '<p class="text-center py-4 text-slate-500">No hay slots disponibles.</p>';
        return;
    }

    slots.forEach((slot, index) => {
        const slotTime = new Date(slot.startTime);
        let status = slot.status;
        if (slotTime < now) {
            status = 'past';
        }

        const div = document.createElement('div');
        div.className = `accordion-item ${status === 'past' ? 'opacity-60' : ''}`;

        // Status indicator color
        let statusColorClass = 'bg-slate-100 text-slate-600';
        let statusText = getMobileStatusText({ ...slot, status });

        switch(status) {
            case 'available': statusColorClass = 'bg-green-100 text-green-700'; break;
            case 'booked': statusColorClass = 'bg-red-100 text-red-700'; break;
            case 'open_match_available': statusColorClass = 'bg-amber-100 text-amber-700'; break;
            case 'my_private_booking': statusColorClass = 'bg-blue-100 text-blue-700'; break;
        }

        div.innerHTML = `
            <div class="accordion-header p-4 flex justify-between items-center bg-white dark:bg-surface-dark cursor-pointer" data-status="${status}" data-index="${index}">
                <div class="flex items-center gap-3">
                    <span class="font-bold text-slate-900 dark:text-white">${formatTime(slotTime)}</span>
                    <span class="px-2 py-1 rounded text-xs font-medium ${statusColorClass}">${statusText}</span>
                </div>
                <span class="material-icons-outlined text-slate-400 transition-transform duration-200 chevron">expand_more</span>
            </div>
            <div class="slot-details hidden bg-slate-50 dark:bg-slate-800/50 p-4 border-t border-slate-100 dark:border-slate-700"></div>
        `;
        accordionContainer.appendChild(div);

        // Guardar referencia al slot para expandirlo
        div.querySelector('.accordion-header')._slotData = slot;
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
    // Only one accordion active at a time logic could go here if needed
    // For now we just render into the container
    
    // Toggle logic is handled in the click listener below, this just renders content
    const { status, startTime, bookingId, participants, maxParticipants } = slotData;

    const closeAccordion = () => {
         // This needs to find the parent accordion item and toggle it closed
         const header = detailsContainer.previousElementSibling;
         header.click(); // Trigger the toggle logic again to close
    };

    let content = '';

    switch (status) {
        case 'available':
            const durations = [60, 90];
            const optionsHtml = durations.map(d => `<button class="px-3 py-1 border rounded hover:bg-slate-100 dark:hover:bg-slate-700 duration-btn" data-duration="${d}">${d} min</button>`).join('');
            
            content = `
                <div class="flex flex-col gap-3">
                    <p class="text-sm text-slate-600 dark:text-slate-400">Elige duración:</p>
                    <div class="flex gap-2 duration-options">${optionsHtml}</div>
                    <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input type="checkbox" class="rounded border-slate-300 text-primary focus:ring-primary open-match-checkbox">
                        Abrir partida (4 jugadores)
                    </label>
                    <div class="flex gap-2 mt-2">
                         <button class="flex-1 py-2 bg-primary text-white rounded font-medium text-sm confirm-booking-btn">Confirmar</button>
                    </div>
                </div>
            `;
            break;
            
        case 'open_match_available':
            content = `
                <div class="flex flex-col gap-3">
                    <p class="text-sm text-slate-600 dark:text-slate-400">Partida abierta con ${participants}/${maxParticipants} jugadores.</p>
                    <button class="w-full py-2 bg-amber-500 text-white rounded font-medium text-sm join-match-btn">Unirse a la Partida</button>
                </div>
            `;
            break;

        case 'booked':
        case 'open_match_full':
            content = `
                <div class="flex flex-col gap-3">
                    <p class="text-sm text-slate-600 dark:text-slate-400">Este horario está ocupado.</p>
                    <button class="w-full py-2 bg-primary text-white rounded font-medium text-sm join-waitlist-btn">Apuntarse a Lista de Espera</button>
                </div>
            `;
            break;
            
        case 'my_private_booking':
            content = `
                <div class="flex flex-col gap-3">
                    <p class="text-sm text-slate-600 dark:text-slate-400">Tienes una reserva privada aquí.</p>
                    <button class="w-full py-2 bg-red-100 text-red-700 border border-red-200 rounded font-medium text-sm cancel-booking-btn">Cancelar Reserva</button>
                </div>
            `;
            break;

        case 'my_open_match':
            content = `
                <div class="flex flex-col gap-3">
                    <p class="text-sm text-slate-600 dark:text-slate-400">Estás inscrito en esta partida.</p>
                    <button class="w-full py-2 bg-red-100 text-red-700 border border-red-200 rounded font-medium text-sm leave-match-btn">Abandonar Partida</button>
                </div>
            `;
            break;

        default:
            content = `<p class="text-sm text-slate-500">No hay acciones disponibles.</p>`;
    }

    detailsContainer.innerHTML = content;

    // Attach listeners
    if (status === 'available') {
         const confirmBtn = detailsContainer.querySelector('.confirm-booking-btn');
         const durationBtns = detailsContainer.querySelector('.duration-options');

         // Select first duration by default
         const firstDuration = durationBtns.querySelector('.duration-btn');
         if(firstDuration) firstDuration.classList.add('bg-blue-50', 'border-primary', 'text-primary', 'selected');

         durationBtns.addEventListener('click', (e) => {
             if(e.target.classList.contains('duration-btn')) {
                 detailsContainer.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('bg-blue-50', 'border-primary', 'text-primary', 'selected'));
                 e.target.classList.add('bg-blue-50', 'border-primary', 'text-primary', 'selected');
             }
         });

         confirmBtn.addEventListener('click', () => {
             const selectedBtn = detailsContainer.querySelector('.duration-btn.selected');
             const duration = selectedBtn ? selectedBtn.dataset.duration : '60';
             const isOpenMatch = detailsContainer.querySelector('.open-match-checkbox').checked;
             onSlotClick({ ...slotData, action: 'book', duration, isOpenMatch });
         });
    }
    else if (status === 'open_match_available') {
        detailsContainer.querySelector('.join-match-btn').addEventListener('click', () => onSlotClick({ ...slotData, action: 'join' }));
    }
    else if (status === 'booked' || status === 'open_match_full') {
        detailsContainer.querySelector('.join-waitlist-btn').addEventListener('click', () => onSlotClick({ ...slotData, action: 'waitlist' }));
    }
    else if (status === 'my_private_booking') {
        detailsContainer.querySelector('.cancel-booking-btn').addEventListener('click', () => onSlotClick({ ...slotData, action: 'cancel' }));
    }
    else if (status === 'my_open_match') {
        detailsContainer.querySelector('.leave-match-btn').addEventListener('click', () => onSlotClick({ ...slotData, action: 'leave' }));
    }
}

export function init(container, onSlotClick) {
    container.addEventListener('click', (e) => {
        // Desktop Click (Buttons inside Table Cells)
        const btn = e.target.closest('button');

        // Mobile Click (Accordion Headers)
        const mobileHeader = e.target.closest('.accordion-header');

        if (btn && container.contains(btn)) {
            // Check if it's inside the desktop table (simple heuristic or class check)
            // But since mobile view doesn't use buttons for the slot header, this is safe for desktop.
            // UNLESS mobile details view buttons bubble up.
            // We should ensure we are clicking a slot button, not an action button inside details.
            // Slot buttons are direct children of TDs. Action buttons are deep inside .slot-details.
            if (btn.parentElement.tagName === 'TD') {
                const dataset = btn.dataset;
                const slotData = {
                    status: dataset.status,
                    startTime: dataset.starttime,
                    bookingId: dataset.bookingId,
                    participationType: dataset.participationType,
                    participants: dataset.participants,
                    maxParticipants: dataset.maxParticipants,
                    duration: dataset.duration
                };
                if (slotData.status && slotData.status !== 'past') {
                    onSlotClick(slotData);
                }
            }
        }

        if (mobileHeader && container.contains(mobileHeader)) {
            // Mobile Toggle Logic
            const details = mobileHeader.nextElementSibling;
            const chevron = mobileHeader.querySelector('.chevron');

            // Toggle
            if (details.classList.contains('hidden')) {
                // Close others? Optional but good UX
                container.querySelectorAll('.slot-details').forEach(d => d.classList.add('hidden'));
                container.querySelectorAll('.chevron').forEach(c => c.style.transform = 'rotate(0deg)');

                details.classList.remove('hidden');
                if(chevron) chevron.style.transform = 'rotate(180deg)';

                // Render details if empty
                if (!details.innerHTML.trim()) {
                    renderSlotDetails(details, mobileHeader._slotData, onSlotClick);
                }
            } else {
                details.classList.add('hidden');
                if(chevron) chevron.style.transform = 'rotate(0deg)';
            }
        }
    });
}
