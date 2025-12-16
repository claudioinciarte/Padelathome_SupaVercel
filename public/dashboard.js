import { fetchApi, authToken } from './js/services/api.js';
import { formatDate, showNotification } from './js/utils.js';
import * as Modals from './js/ui/modals.js';
import * as Calendar from './js/components/Calendar.js';
import * as BookingCard from './js/components/BookingCard.js';
import * as CourtSelector from './js/components/CourtSelector.js';

// --- Utilidades Locales ---
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

// Inicializar WebSocket
const socket = io();
socket.on('connect', () => console.log('Connected to WebSocket'));

document.addEventListener('DOMContentLoaded', () => {
    if (!authToken) {
        window.location.href = '/login.html';
        return;
    }

    // --- Estado Global ---
    let currentDisplayedDate = new Date();
    let selectedCourtId = null;
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

    // --- Handlers de Modales (Lógica de Negocio) ---
    const modalHandlers = {
        onConfirmBooking: async (data) => {
            try {
                            const body = { 
                                startTime: data.startTime,
                                durationMinutes: data.durationMinutes, // Fix: Use data.durationMinutes
                                isOpenMatch: data.isOpenMatch,
                                courtId: selectedCourtId 
                            };                if (data.isOpenMatch) {
                    body.maxParticipants = 4;
                }
                await fetchApi('/bookings', { method: 'POST', body: JSON.stringify(body) });
                showNotification('Reserva creada con éxito', 'success');
                Modals.hideAllModals();
                refreshData();
            } catch (e) { 
                showNotification(e.message, 'error'); 
            }
        },
        onJoinWaitlist: async (data) => {
            try {
                const end = new Date(new Date(data.startTime).getTime() + 90*60000).toISOString();
                await fetchApi('/waiting-list', {
                    method: 'POST',
                    body: JSON.stringify({ courtId: parseInt(data.courtId), slotStartTime: data.startTime, slotEndTime: end })
                });
                showNotification('Apuntado a lista de espera', 'success');
                Modals.hideAllModals();
            } catch (e) { showNotification(e.message, 'error'); }
        },
        onJoinMatch: async (data) => {
            try {
                await fetchApi(`/matches/${data.bookingId}/join`, { method: 'POST' });
                showNotification('Te has unido a la partida', 'success');
                Modals.hideAllModals();
                refreshData();
            } catch (e) { showNotification(e.message, 'error'); }
        },
        onCancelBooking: async (bookingId) => {
            if (!confirm('¿Seguro que quieres cancelar?')) return;
            try {
                await fetchApi(`/bookings/${bookingId}`, { method: 'DELETE' });
                showNotification('Reserva cancelada', 'success');
                Modals.hideAllModals(); // Por si venía de un modal de detalle
                refreshData();
            } catch (e) { showNotification(e.message, 'error'); }
        },
        onLeaveMatch: async (bookingId) => {
            if (!confirm('¿Seguro que quieres abandonar?')) return;
            try {
                await fetchApi(`/matches/${bookingId}/leave`, { method: 'DELETE' });
                showNotification('Has abandonado la partida', 'success');
                Modals.hideAllModals();
                refreshData();
            } catch (e) { showNotification(e.message, 'error'); }
        }
    };

    // --- Funciones de Datos ---
    const refreshData = async () => {
        await Promise.all([fetchMyBooking(), updateCalendarView()]);
    };

    const fetchUserProfile = async () => {
        try {
            const user = await fetchApi('/users/me');
            welcomeMessage.textContent = `Bienvenido, ${user.name}!`;
            if (user.role === 'admin') adminPanelBtn.style.display = 'inline-block';
        } catch (e) { console.error(e); }
    };

    const fetchMyBooking = async () => {
        try {
            const bookings = await fetchApi('/bookings/me');
            userActiveBookings = bookings ? (Array.isArray(bookings) ? bookings : [bookings]) : [];
            BookingCard.render(myBookingContainer, userActiveBookings);
        } catch (e) {
            console.error(e);
            myBookingContainer.innerHTML = '<p class="error-text">Error al cargar reservas.</p>';
        }
    };

    const updateCalendarView = async () => {
        if (!selectedCourtId) return;
        const isMobile = window.innerWidth <= 768;

        // Toggle UI
        if (isMobile) {
            calendarContainer.style.display = 'none';
            dailySlotsContainer.style.display = 'block';
            document.querySelector('.desktop-only').style.display = 'none';
            document.querySelector('.mobile-only').style.display = 'block';
            await renderMobileView();
        } else {
            dailySlotsContainer.style.display = 'none';
            calendarContainer.style.display = 'block';
            document.querySelector('.desktop-only').style.display = 'block';
            document.querySelector('.mobile-only').style.display = 'none';
            await renderDesktopView();
        }
    };

    const renderDesktopView = async () => {
        calendarContainer.innerHTML = '<p>Cargando...</p>';
        const dateString = toISODateString(currentDisplayedDate);
        try {
            const data = await fetchApi(`/schedule/week?courtId=${selectedCourtId}&date=${dateString}`);
            weekDatesTitle.textContent = `Semana del ${formatDate(data.weekStart)} al ${formatDate(data.weekEnd)}`;
            Calendar.renderWeekly(calendarContainer, data.schedule, data.weekStart, data.weekEnd, userActiveBookings, selectedCourtId);
        } catch (e) {
            calendarContainer.innerHTML = `<p class="error-text">${e.message}</p>`;
        }
    };

    const renderMobileView = async () => {
        // La lógica de acordeón móvil compleja se mantiene aquí por ahora o se mueve a Calendar si se prefiere.
        // Por simplicidad en esta refactorización, asumimos que Calendar.renderMobileDaily maneja la lista de slots,
        // pero la lógica de fechas (date-strip) se queda aquí o se abstrae después.
        // Para cumplir con "delegar todo el HTML a los componentes", idealmente Calendar.js manejaría todo el div mobile.
        // Pero dado el estado actual, vamos a reutilizar la lógica simple de Calendar.renderMobileDaily para los slots.

        // TODO: Mover lógica completa de Mobile View a un componente MobileCalendar.js en el futuro.
        // Por ahora, solo limpiamos el contenedor si es necesario.
        if (!dailySlotsContainer.querySelector('.date-strip-container')) {
             dailySlotsContainer.innerHTML = `
                <div class="date-strip-container"><div class="date-strip"></div></div>
                <div class="accordion-container"></div>
            `;
            renderDateStrip();
        }

        // Cargar slots del día
        const accordion = dailySlotsContainer.querySelector('.accordion-container');
        accordion.innerHTML = '<p>Cargando...</p>';
        const dateString = toISODateString(currentDisplayedDate);
        try {
            const weekData = await fetchApi(`/schedule/week?courtId=${selectedCourtId}&date=${dateString}`);
            const slots = weekData.schedule[dateString];
            Calendar.renderMobileDaily(dailySlotsContainer, slots);
        } catch (e) {
            accordion.innerHTML = `<p class="error-text">${e.message}</p>`;
        }
    };

    // Renderiza la tira de fechas (lógica simple local por ahora)
    function renderDateStrip() {
        const strip = dailySlotsContainer.querySelector('.date-strip');
        strip.innerHTML = '';
        let iterator = new Date(); iterator.setHours(0,0,0,0);

        for (let i = 0; i < 14; i++) {
            const div = document.createElement('div');
            div.className = 'date-item';
            if (iterator.toDateString() === currentDisplayedDate.toDateString()) div.classList.add('selected');
            div.dataset.date = toISODateString(iterator);
            div.innerHTML = `<span class="day-name">${iterator.toLocaleDateString('es-ES',{weekday:'short'})}</span><span class="day-number">${iterator.getDate()}</span>`;
            strip.appendChild(div);
            iterator.setDate(iterator.getDate() + 1);
        }

        // Evento click en fecha
        strip.onclick = (e) => {
            const item = e.target.closest('.date-item');
            if (item) {
                currentDisplayedDate = new Date(item.dataset.date + 'T00:00:00');
                renderDateStrip(); // Re-render para actualizar selección
                renderMobileView(); // Recargar slots
            }
        };
    }


    // --- Inicialización ---
    const init = async () => {
        Modals.initModals(modalHandlers);

        // Init Components
        BookingCard.init(myBookingContainer, {
            onCancel: modalHandlers.onCancelBooking,
            onLeave: modalHandlers.onLeaveMatch
        });

        const calendarRoot = document.getElementById('weekly-calendar-container').parentElement;
        Calendar.init(calendarRoot, (slotData) => {
            const { action, status, startTime, bookingId, participationType, participants, maxParticipants, duration, isOpenMatch } = slotData;

            const effectiveStatus = action || status;

            switch (effectiveStatus) {
                case 'book': 
                case 'available':
                    if (action === 'book') { 
                        modalHandlers.onConfirmBooking({ startTime, durationMinutes: parseInt(duration), isOpenMatch });
                        refreshData();
                    } else { 
                        Modals.showBookingModal(startTime, [60, 90]);
                    }
                    break;
                case 'cancel':
                case 'my_private_booking':
                     modalHandlers.onCancelBooking(bookingId);
                    break;
                case 'leave':
                case 'my_open_match':
                    if(action === 'leave'){
                        modalHandlers.onLeaveMatch(bookingId);
                    } else {
                        fetchApi(`/matches/${bookingId}/participants`).then(({ participants: p }) => {
                            Modals.showMyMatchModal({ bookingId, startTime, isOwner: participationType === 'owner' }, p);
                        });
                    }
                    break;
                case 'join':
                case 'open_match_available':
                    if(action === 'join'){
                        modalHandlers.onJoinMatch(slotData)
                    }else {
                        fetchApi(`/matches/${bookingId}/participants`).then(({ participants: p }) => {
                            Modals.showOpenMatchModal({ bookingId, starttime: startTime, participants, maxParticipants }, p);
                        });
                    }
                    break;
                case 'waitlist':
                case 'booked':
                case 'open_match_full':
                    modalHandlers.onJoinWaitlist({startTime, courtId: selectedCourtId});
                    break;
            }
        });

        CourtSelector.init(courtSelectDropdown, (newId) => {
            selectedCourtId = newId;
            updateCalendarView();
        });

        // Carga inicial
        await fetchUserProfile();
        try {
            const courts = await fetchApi('/courts');
            if (courts.length > 0) {
                CourtSelector.render(courtSelectDropdown, courts, courts[0].id);
                selectedCourtId = courts[0].id;
                CourtSelector.toggleVisibility(courtSelectorContainer, courts.length > 1);
                refreshData();
            } else {
                showNotification('No hay pistas disponibles', 'error');
            }
        } catch (e) { showNotification(e.message, 'error'); }

        // Event Listeners UI Generales
        logoutButton.addEventListener('click', () => { localStorage.removeItem('authToken'); window.location.href = '/login.html'; });
        if(adminPanelBtn) adminPanelBtn.addEventListener('click', () => window.location.href = '/admin.html');
        if(profileBtn) profileBtn.addEventListener('click', () => window.location.href = '/profile.html');
        if(faqBtn) faqBtn.addEventListener('click', () => window.location.href = '/faq.html');

        prevWeekBtn.addEventListener('click', () => {
            currentDisplayedDate.setDate(currentDisplayedDate.getDate() - 7);
            updateCalendarView();
        });
        nextWeekBtn.addEventListener('click', () => {
            currentDisplayedDate.setDate(currentDisplayedDate.getDate() + 7);
            updateCalendarView();
        });

        window.addEventListener('resize', debounce(updateCalendarView, 250));

        // Websocket update
        socket.on('booking:created', refreshData);
        socket.on('booking:cancelled', refreshData);
        socket.on('match:updated', refreshData);
    };

    init();
});
