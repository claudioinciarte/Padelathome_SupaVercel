import { fetchApi, authToken } from './js/services/api.js';
import { formatDate, formatTime, showNotification } from './js/utils.js';
import * as Modals from './js/ui/modals.js';

// --- Utilidades Locales ---
// (Podríamos mover esto a utils.js si se usa en más sitios)
const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
};

function toISODateString(date) {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Inicializar conexión WebSocket
// Asegúrate de que socket.io.js se carga antes en el HTML
const socket = io();
socket.on('connect', () => console.log('Connected to WebSocket'));

document.addEventListener('DOMContentLoaded', () => {
    if (!authToken) {
        window.location.href = '/login.html';
        return;
    }

    // --- Estado Global ---
    let currentDisplayedDate = new Date();
    let weeklyScheduleData = {};
    let selectedCourtId = null;
    let courtsData = [];
    let dailySlotsData = [];
    let userActiveBookings = [];

    // --- Elementos del DOM ---
    const welcomeMessage = document.getElementById('welcome-message');
    const myBookingContainer = document.getElementById('my-booking');
    const calendarContainer = document.getElementById('weekly-calendar-container');
    const dailySlotsContainer = document.getElementById('daily-slots-container');
    const prevWeekBtn = document.getElementById('prev-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');
    const weekDatesTitle = document.getElementById('week-dates-title');
    const logoutButton = document.getElementById('logout-button');
    const adminPanelBtn = document.getElementById('admin-panel-btn');
    const courtSelectorContainer = document.querySelector('.court-selector-container');
    const courtSelectDropdown = document.getElementById('court-select');
    const profileBtn = document.getElementById('profile-btn');
    const faqBtn = document.getElementById('faq-button');

    // --- WebSocket Listeners ---
    const refreshDataAndRender = async () => {
        await fetchMyBooking();
        await handleViewChange();
    };
    socket.on('booking:created', () => refreshDataAndRender());
    socket.on('booking:cancelled', () => refreshDataAndRender());
    socket.on('match:updated', () => refreshDataAndRender());


    // --- Lógica de Negocio ---

    const fetchUserProfile = async () => {
        try {
            const user = await fetchApi('/users/me');
            welcomeMessage.textContent = `Bienvenido, ${user.name}!`;
            if (user.role === 'admin') {
                adminPanelBtn.style.display = 'inline-block';
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchMyBooking = async () => {
        try {
            const bookings = await fetchApi('/bookings/me'); // Espera array o null
            // Si la API devuelve null o undefined, tratamos como array vacío
            userActiveBookings = bookings ? (Array.isArray(bookings) ? bookings : [bookings]) : [];
            renderMyBookings(userActiveBookings);
        } catch (error) {
            console.error(error);
            myBookingContainer.innerHTML = '<p class="error-text">Error al cargar reservas.</p>';
        }
    };

    function renderMyBookings(bookings) {
        myBookingContainer.innerHTML = '';
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
                myBookingContainer.appendChild(div);
            });
        } else {
            myBookingContainer.innerHTML = '<p>No tienes ninguna reserva activa.</p>';
        }
    }

    async function initializeCourtSelector() {
        try {
            courtsData = await fetchApi('/courts');
            if (courtsData.length === 0) {
                 showNotification('No hay pistas disponibles.', 'error');
                 return;
            }

            // Si hay solo una pista, seleccionarla pero ocultar el selector si se desea (o dejarlo visible)
            // Aquí la lógica original ocultaba el contenedor si <= 1 pista.
            if (courtsData.length <= 1) {
                if (courtSelectorContainer) courtSelectorContainer.classList.add('hidden');
                selectedCourtId = courtsData[0].id;
            } else {
                courtSelectDropdown.innerHTML = courtsData.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
                selectedCourtId = parseInt(courtSelectDropdown.value, 10);
                if (courtSelectorContainer) courtSelectorContainer.classList.remove('hidden');
                
                courtSelectDropdown.addEventListener('change', (e) => {
                    selectedCourtId = parseInt(e.target.value, 10);
                    handleViewChange();
                });
            }
            handleViewChange();
        } catch (error) {
            console.error(error);
            showNotification('Error al cargar pistas.', 'error');
        }
    }

    function handleViewChange() {
        if (!selectedCourtId) return;
        const isMobile = window.innerWidth <= 768;

        // Toggle de visibilidad
        if (isMobile) {
            calendarContainer.style.display = 'none';
            dailySlotsContainer.style.display = 'block';
            // Títulos diferenciados
            document.querySelector('.desktop-only').style.display = 'none';
            document.querySelector('.mobile-only').style.display = 'block';
            renderMobileView(currentDisplayedDate); // Usar la fecha actual seleccionada
        } else {
            dailySlotsContainer.style.display = 'none';
            calendarContainer.style.display = 'block';
            document.querySelector('.desktop-only').style.display = 'block';
            document.querySelector('.mobile-only').style.display = 'none';
            renderWeeklyCalendar(currentDisplayedDate);
        }
    }

    // --- Renderizado de la Vista Móvil ---
    async function renderMobileView(date) {
        // Estructura base si no existe
        if (!dailySlotsContainer.querySelector('.date-strip-container')) {
             dailySlotsContainer.innerHTML = `
                <div class="date-strip-container">
                    <div class="date-strip"></div>
                </div>
                <div class="accordion-container"></div>
            `;
        }
        renderDateStrip(date);
        await renderDaySlots(date);
    }

    function renderDateStrip(selectedDate) {
        const strip = dailySlotsContainer.querySelector('.date-strip');
        strip.innerHTML = '';

        // Mostrar 14 días a partir de hoy (o centrado en la fecha seleccionada,
        // pero para simplificar, mostramos desde "hoy" y marcamos la seleccionada)
        let iteratorDate = new Date();
        // Resetear a medianoche
        iteratorDate.setHours(0,0,0,0);

        // Comparación segura de fechas
        const isSameDay = (d1, d2) =>
            d1.getDate() === d2.getDate() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getFullYear() === d2.getFullYear();

        for (let i = 0; i < 14; i++) {
            const dayItem = document.createElement('div');
            dayItem.className = 'date-item';
            if (isSameDay(iteratorDate, selectedDate)) {
                dayItem.classList.add('selected');
            }
            // Guardamos la fecha en ISO para recuperarla al clickar
            dayItem.dataset.date = toISODateString(iteratorDate);

            dayItem.innerHTML = `
                <span class="day-name">${iteratorDate.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                <span class="day-number">${iteratorDate.getDate()}</span>
            `;
            strip.appendChild(dayItem);

            // Avanzar un día
            iteratorDate.setDate(iteratorDate.getDate() + 1);
        }
    }

    async function renderDaySlots(date) {
        const accordionContainer = dailySlotsContainer.querySelector('.accordion-container');
        accordionContainer.innerHTML = '<p class="loading-text">Cargando disponibilidad...</p>';

        const dateString = toISODateString(date);
        try {
            // Nota: El endpoint /schedule/day no existe en la API actual mostrada en el contexto.
            // La API tiene /schedule/availability (un día) y /schedule/week.
            // Usaremos /schedule/availability que devuelve { availability: [], blocked: [] }

            const data = await fetchApi(`/schedule/availability?courtId=${selectedCourtId}&date=${dateString}`);

            if (!data.availability || data.availability.length === 0) {
                accordionContainer.innerHTML = '<p class="empty-text">No hay slots disponibles para este día (o está todo ocupado/cerrado).</p>';
                return;
            }

            accordionContainer.innerHTML = '';
            const now = new Date();

            // La respuesta de availability es: [{ startTime: '...', availableDurations: [60, 90] }, ...]
            // NO incluye los ocupados. Para mostrar una lista completa (libres y ocupados) en móvil
            // necesitaríamos una API que devuelva todo el día.
            // Como fallback, usaremos getWeekSchedule filtrando por el día, ya que esa sí devuelve TODOS los estados.

            // CAMBIO DE ESTRATEGIA: Usar getWeekSchedule para tener info completa del día
            const weekData = await fetchApi(`/schedule/week?courtId=${selectedCourtId}&date=${dateString}`);
            const dayKey = dateString; // La API devuelve claves 'YYYY-MM-DD'
            const slots = weekData.schedule[dayKey];

            if (!slots) {
                 accordionContainer.innerHTML = '<p>No hay información para este día.</p>';
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
                        <span class="slot-status-text">${getSlotStatusText({ ...slot, status })}</span>
                        <span class="chevron">▼</span>
                    </div>
                    <div class="slot-details"></div>
                `;
                accordionContainer.appendChild(div);

                // Guardamos la referencia al objeto slot en el elemento DOM para usarlo al expandir
                div.querySelector('.slot-header')._slotData = slot;
            });

        } catch (error) {
            accordionContainer.innerHTML = `<p class="error-text">${error.message}</p>`;
        }
    }

    function getSlotStatusText(slot) {
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

    function renderSlotDetails(detailsContainer, slot) {
        detailsContainer.innerHTML = '';
        const { status, startTime, bookingId } = slot;

        // Calculamos duraciones disponibles (esto venía de la lógica de week, pero week no devuelve availableDurations explícitamente)
        // Simplificación: Asumimos 60 y 90 min disponibles si es 'available', o permitimos elegir en el modal.
        // En móvil, mostraremos botones directos.

        if (status === 'available') {
            detailsContainer.innerHTML = `
                <p>Reservar pista:</p>
                <div class="mobile-actions">
                    <button class="btn-primary" data-duration="60">60 min</button>
                    <button class="btn-primary" data-duration="90">90 min</button>
                </div>
                <div class="form-group-inline">
                    <input type="checkbox" id="mobile-open-match-${startTime}">
                    <label for="mobile-open-match-${startTime}">Crear como Partida Abierta</label>
                </div>
            `;

            const buttons = detailsContainer.querySelectorAll('button');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const duration = parseInt(btn.dataset.duration);
                    const isOpenMatch = detailsContainer.querySelector(`input[type="checkbox"]`).checked;

                    // Usamos el modal de confirmación simplificado para móvil (si existe) o el normal
                    // Por ahora, reutilizamos la lógica de confirmación directa
                    if(confirm(`¿Confirmar reserva de ${duration} min para las ${formatTime(startTime)}?`)) {
                         modalHandlers.onConfirmBooking({
                            startTime,
                            durationMinutes: duration,
                            isOpenMatch
                        });
                    }
                });
            });

        } else if (status === 'my_private_booking') {
            detailsContainer.innerHTML = `
                <p>Esta es tu reserva.</p>
                <button class="btn-danger cancel-booking-btn">Cancelar Reserva</button>
            `;
            detailsContainer.querySelector('.cancel-booking-btn').addEventListener('click', () => {
                modalHandlers.onCancelBooking({ bookingId });
            });

        } else if (status === 'my_open_match') {
             detailsContainer.innerHTML = `
                <p>Estás inscrito en esta partida.</p>
                <button class="btn-warning leave-match-btn">Abandonar Partida</button>
            `;
            detailsContainer.querySelector('.leave-match-btn').addEventListener('click', () => {
                modalHandlers.onLeaveMatch({ bookingId });
            });

        } else if (status === 'booked' || status === 'open_match_full') {
             detailsContainer.innerHTML = `
                <p>Horario no disponible.</p>
                <button class="btn-secondary join-waitlist-btn">Avisadme si se libera</button>
            `;
            detailsContainer.querySelector('.join-waitlist-btn').addEventListener('click', () => {
                modalHandlers.onJoinWaitlist({ courtId: selectedCourtId, startTime });
            });

        } else if (status === 'open_match_available') {
             detailsContainer.innerHTML = `
                <p>Hay plazas libres.</p>
                <button class="btn-success join-match-btn">Unirse a la Partida</button>
            `;
            detailsContainer.querySelector('.join-match-btn').addEventListener('click', () => {
                modalHandlers.onJoinMatch({ bookingId });
            });
        }
    }


    // --- Renderizado del Calendario Semanal (Escritorio) ---
    async function renderWeeklyCalendar(date) {
        calendarContainer.innerHTML = '<p>Cargando calendario...</p>';
        const dateString = toISODateString(date);
        try {
            const data = await fetchApi(`/schedule/week?courtId=${selectedCourtId}&date=${dateString}`);
            weeklyScheduleData = data.schedule;

            // Actualizar título
            weekDatesTitle.textContent = `Semana del ${formatDate(data.weekStart)} al ${formatDate(data.weekEnd)}`;

            const grid = document.createElement('div');
            grid.className = 'calendar-grid';
            
            // Cabeceras de días
            ['Horas', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach(d => {
                const div = document.createElement('div');
                div.className = 'grid-cell header';
                div.textContent = d;
                grid.appendChild(div);
            });

            const weekDays = Object.keys(weeklyScheduleData).sort();
            if(weekDays.length === 0) {
                 calendarContainer.innerHTML = '<p>No hay datos disponibles.</p>';
                 return;
            }

            const timeSlots = weeklyScheduleData[weekDays[0]];
            const now = new Date();

            timeSlots.forEach((slot, index) => {
                // Columna Hora
                const timeDiv = document.createElement('div');
                timeDiv.className = 'grid-cell time-header';
                timeDiv.textContent = formatTime(new Date(slot.startTime));
                grid.appendChild(timeDiv);

                weekDays.forEach(dayKey => {
                    const daySlot = weeklyScheduleData[dayKey][index];
                    const cell = document.createElement('div');
                    const slotTime = new Date(daySlot.startTime);
                    
                    let status = daySlot.status;
                    if (slotTime < now) status = 'past';

                    cell.className = `grid-cell slot ${status}`;

                    // Identificar si es 'mío' para pintarlo diferente
                    // La API debería devolver si el usuario actual es dueño o participante.
                    // Si no lo hace, no podemos saberlo 100% solo con el status genérico 'booked'
                    // Pero asumimos que 'my_private_booking' podría venir si el backend lo soportara
                    // O comparamos con userActiveBookings

                    const myBooking = userActiveBookings.find(b => {
                        const bStart = new Date(b.start_time).getTime();
                        const sStart = slotTime.getTime();
                        // Margen de error pequeño o igualdad exacta
                        return Math.abs(bStart - sStart) < 1000 && b.court_id === selectedCourtId;
                    });

                    if (myBooking) {
                        cell.classList.add('my-booking');
                        status = myBooking.is_open_match ? 'my_open_match' : 'my_private_booking';
                        // Sobreescribimos el status visual para lógica de click
                        cell.dataset.participationType = myBooking.participation_type; // 'owner' or 'participant'
                        cell.dataset.bookingId = myBooking.id;
                    } else if (daySlot.bookingId) {
                        cell.dataset.bookingId = daySlot.bookingId;
                    }

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

            calendarContainer.innerHTML = '';
            calendarContainer.appendChild(grid);

        } catch (error) {
            calendarContainer.innerHTML = `<p class="error-text">${error.message}</p>`;
        }
    }


    // --- Inicialización de Modales ---
    const modalHandlers = {
        onConfirmBooking: async (data) => {
            try {
                const body = { ...data, courtId: selectedCourtId };
                if (data.isOpenMatch) body.maxParticipants = 4;
                
                await fetchApi('/bookings', { method: 'POST', body: JSON.stringify(body) });
                showNotification('Reserva creada con éxito', 'success');
                Modals.hideAllModals();
                refreshDataAndRender();
            } catch (e) { showNotification(e.message, 'error'); }
        },
        onJoinWaitlist: async (data) => {
            try {
                const end = new Date(new Date(data.startTime).getTime() + 90*60000).toISOString();
                await fetchApi('/waiting-list', { 
                    method: 'POST', 
                    body: JSON.stringify({ courtId: parseInt(data.courtId), slotStartTime: data.startTime, slotEndTime: end })
                });
                showNotification('Te hemos apuntado a la lista de espera', 'success');
                Modals.hideAllModals();
            } catch (e) { showNotification(e.message, 'error'); }
        },
        onJoinMatch: async (data) => {
            try {
                await fetchApi(`/matches/${data.bookingId}/join`, { method: 'POST' });
                showNotification('Te has unido a la partida', 'success');
                Modals.hideAllModals();
                refreshDataAndRender();
            } catch (e) { showNotification(e.message, 'error'); }
        },
        onCancelBooking: async (data) => {
            if (!confirm('¿Seguro que quieres cancelar esta reserva?')) return;
            try {
                await fetchApi(`/bookings/${data.bookingId}`, { method: 'DELETE' });
                showNotification('Reserva cancelada', 'success');
                Modals.hideAllModals();
                refreshDataAndRender();
            } catch (e) { showNotification(e.message, 'error'); }
        },
        onLeaveMatch: async (data) => {
            if (!confirm('¿Seguro que quieres abandonar la partida?')) return;
            try {
                await fetchApi(`/matches/${data.bookingId}/leave`, { method: 'DELETE' });
                showNotification('Has abandonado la partida', 'success');
                Modals.hideAllModals();
                refreshDataAndRender();
            } catch (e) { showNotification(e.message, 'error'); }
        }
    };

    Modals.initModals(modalHandlers);


    // --- Listeners Globales ---
    async function init() {
        await fetchUserProfile();
        await initializeCourtSelector(); 
        await fetchMyBooking();

        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = '/login.html';
        });
        if(adminPanelBtn) adminPanelBtn.addEventListener('click', () => window.location.href = '/admin.html');
        if (profileBtn) profileBtn.addEventListener('click', () => window.location.href = '/profile.html');
        if(faqBtn) faqBtn.addEventListener('click', () => window.location.href = '/faq.html');

        prevWeekBtn.addEventListener('click', () => {
            currentDisplayedDate.setDate(currentDisplayedDate.getDate() - 7);
            handleViewChange();
        });
        nextWeekBtn.addEventListener('click', () => {
            currentDisplayedDate.setDate(currentDisplayedDate.getDate() + 7);
            handleViewChange();
        });
        
        // Delegación "Mis Reservas"
        myBookingContainer.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON') return;
            const id = e.target.dataset.id;
            const action = e.target.dataset.action;
            if (action === 'cancel') modalHandlers.onCancelBooking({ bookingId: id });
            if (action === 'leave') modalHandlers.onLeaveMatch({ bookingId: id });
        });

        // Delegación Calendario (Escritorio)
        calendarContainer.addEventListener('click', async (e) => {
            const cell = e.target.closest('.slot');
            if (!cell) return;
            const status = cell.dataset.status;
            if(status === 'past' || status === 'blocked') return;

            const startTime = cell.dataset.starttime;
            const bookingId = cell.dataset.bookingId;

            // Manejo simplificado de clicks en escritorio
            switch (status) {
                case 'available':
                    Modals.showBookingModal(startTime, [60, 90]);
                    break;
                case 'my_private_booking':
                    Modals.showMyBookingModal(bookingId, startTime);
                    break;
                case 'my_open_match':
                    {
                         const { participants } = await fetchApi(`/matches/${bookingId}/participants`);
                         Modals.showMyMatchModal({ bookingId, startTime, isOwner: cell.dataset.participationType === 'owner' }, participants);
                    }
                    break;
                case 'open_match_available':
                    {
                        const { participants } = await fetchApi(`/matches/${bookingId}/participants`);
                        Modals.showOpenMatchModal({
                            bookingId,
                            starttime: startTime,
                            participants: cell.dataset.participants,
                            maxParticipants: cell.dataset.maxParticipants
                        }, participants);
                    }
                    break;
                case 'booked':
                case 'open_match_full':
                    // Permitir lista de espera si la celda tiene el flag
                    // (En la lógica de render añadimos waitlistable si booked)
                    Modals.showWaitlistModal(startTime, selectedCourtId);
                    break;
            }
        });

        // Delegación Acordeón (Móvil)
        dailySlotsContainer.addEventListener('click', async (e) => {
            // Click en fecha
            const dateItem = e.target.closest('.date-item');
            if (dateItem) {
                currentDisplayedDate = new Date(dateItem.dataset.date + 'T00:00:00');
                renderDateStrip(currentDisplayedDate);
                await renderDaySlots(currentDisplayedDate);
                return;
            }

            // Click en cabecera slot
            const header = e.target.closest('.slot-header');
            if (header) {
                const status = header.dataset.status;
                if (status === 'past') return;
                
                const details = header.nextElementSibling;
                const isActive = details.classList.contains('active');

                // Cerrar todos
                document.querySelectorAll('.slot-details').forEach(d => {
                    d.classList.remove('active');
                    d.innerHTML = '';
                    d.previousElementSibling.classList.remove('expanded');
                });
                
                if (!isActive) {
                    details.classList.add('active');
                    header.classList.add('expanded');
                    renderSlotDetails(details, header._slotData);
                }
            }
        });

        window.addEventListener('resize', debounce(handleViewChange, 250));
    }

    init();
});
