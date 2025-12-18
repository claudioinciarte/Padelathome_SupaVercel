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

const EMPTY_BOOKING_STATE = `
    <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
        <span class="material-icons-outlined text-primary text-2xl">event_busy</span>
    </div>
    <p class="text-slate-600 dark:text-slate-400 font-medium">No tienes ninguna reserva activa.</p>
    <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">Selecciona una fecha en el calendario para reservar.</p>
`;

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
    let userWaitingListEntries = [];

    // --- Elementos del DOM ---
    const welcomeMessage = document.getElementById('welcome-message');
    const myBookingContainer = document.getElementById('my-booking'); // The inner content div
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
                if (!data.startTime || !data.courtId) {
                    throw new Error('No se pudieron obtener los datos del slot.');
                }
                const startDate = new Date(data.startTime);
                if (isNaN(startDate.getTime())) {
                    throw new Error('La hora de inicio recibida no es válida.');
                }
                // Use a default duration (90 min) as the API may not provide it for already-booked slots.
                const defaultDurationInMs = 90 * 60 * 1000;
                const endDate = new Date(startDate.getTime() + defaultDurationInMs);

                await fetchApi('/waiting-list', {
                    method: 'POST',
                    body: JSON.stringify({
                        courtId: data.courtId,
                        slotStartTime: data.startTime,
                        slotEndTime: endDate.toISOString()
                    })
                });
                // If the POST succeeds, they were NOT on the list. They are now.
                showNotification('¡Apuntado! Se te notificará si la pista se libera.', 'success');
                Modals.hideAllModals();
                // Update client-side array immediately, now including duration.
                userWaitingListEntries.push({ court_id: data.courtId, slot_start_time: data.startTime, duration: data.duration });
                updateCalendarView(); // Use updateCalendarView to avoid extra 404 noise.
            } catch (e) {
                // The POST failed. Check if it's because they were already on the list.
                if (e.message && e.message.includes('Ya estás en la lista de espera')) {
                    // The API confirmed the state. Update our client-side knowledge if it's not already known.
                    const alreadyKnown = userWaitingListEntries.some(entry => 
                        entry.court_id === data.courtId && entry.slot_start_time === data.startTime
                    );
                    if (!alreadyKnown) {
                        // Add to client-side state, including duration.
                        userWaitingListEntries.push({ court_id: data.courtId, slot_start_time: data.startTime, duration: data.duration });
                        // Trigger a re-render in the background to visually update the slot to "En lista".
                        updateCalendarView();
                    }
                    
                    // Now, show the correct modal for the current state.
                    Modals.hideAllModals(); 
                    Modals.showAlreadyOnWaitlistModal({ startTime: data.startTime, courtId: data.courtId });
                } else {
                    // Any other error.
                    showNotification(e.message, 'error');
                }
            }
        },
        onWithdrawWaitlist: async (data) => {
            try {
                await fetchApi('/waiting-list', {
                    method: 'DELETE',
                    body: JSON.stringify({
                        courtId: data.courtId,
                        slotStartTime: data.startTime
                    })
                });
                showNotification('Has sido retirado de la lista de espera.', 'success');
                Modals.hideAllModals();
                refreshData();
            } catch (e) {
                showNotification(e.message, 'error');
            }
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
            // Remove confirm(), assuming confirmation is handled by the UI (modal or other button)
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
        await Promise.all([fetchMyBooking(), fetchMyWaitingListEntries(), updateCalendarView()]);
    };

    const fetchMyWaitingListEntries = async () => {
        try {
            // This endpoint is required for the "on waitlist" visual feature.
            const entries = await fetchApi('/waiting-list/me');
            userWaitingListEntries = Array.isArray(entries) ? entries : [];
        } catch (e) {
            console.error('Could not fetch waiting list entries. The feature to visually see your status on slots will not work until the API endpoint /api/waiting-list/me is available.');
            userWaitingListEntries = []; // Ensure it does not crash the app.
        }
    };

    const fetchUserProfile = async () => {
        try {
            const user = await fetchApi('/users/me');
            welcomeMessage.textContent = `Bienvenido, ${user.name}!`;
            if (user.role === 'admin') adminPanelBtn.style.display = 'flex'; // Changed from inline-block to flex
        } catch (e) { console.error(e); }
    };

    const fetchMyBooking = async () => {
        try {
            const bookings = await fetchApi('/bookings/me');
            userActiveBookings = bookings ? (Array.isArray(bookings) ? bookings : [bookings]) : [];

            // Logic to toggle Empty State vs Booking Card
            if (userActiveBookings.length === 0) {
                myBookingContainer.innerHTML = EMPTY_BOOKING_STATE;
                // Add classes for styling if they were removed (the render function might wipe them)
                myBookingContainer.className = "flex flex-col items-center justify-center py-8 bg-slate-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-200 dark:border-slate-700";
            } else {
                // BookingCard.render will replace innerHTML with the card
                BookingCard.render(myBookingContainer, userActiveBookings);
                // Remove the "center/dashed" styling which is for empty state only
                myBookingContainer.className = "mt-4"; // Simple margin for the active card
            }
        } catch (e) {
            console.error(e);
            myBookingContainer.innerHTML = '<p class="text-red-500 font-medium">Error al cargar reservas.</p>';
        }
    };

    const updateCalendarView = async () => {
        if (!selectedCourtId) return;
        const isMobile = window.innerWidth <= 768;

        // Toggle UI logic handled by CSS classes (hidden/block) in HTML mostly, but we ensure visibility here
        // The HTML structure has specific containers.
        if (isMobile) {
            calendarContainer.style.display = 'none';
            dailySlotsContainer.style.display = 'block';
            await renderMobileView();
        } else {
            dailySlotsContainer.style.display = 'none';
            calendarContainer.style.display = 'block';
            await renderDesktopView();
        }
    };

    const renderDesktopView = async () => {
        // Keep the container structure, just loading text
        calendarContainer.innerHTML = '<div class="p-8 text-center text-slate-500">Cargando...</div>';
        const dateString = toISODateString(currentDisplayedDate);
        try {
            const data = await fetchApi(`/schedule/week?courtId=${selectedCourtId}&date=${dateString}`);
            weekDatesTitle.textContent = `${formatDate(data.weekStart)} - ${formatDate(data.weekEnd)}`;
            Calendar.renderWeekly(calendarContainer, data.schedule, data.weekStart, data.weekEnd, userActiveBookings, userWaitingListEntries, selectedCourtId);
        } catch (e) {
            calendarContainer.innerHTML = `<p class="p-8 text-center text-red-500">${e.message}</p>`;
        }
    };

    const renderMobileView = async () => {
        if (!dailySlotsContainer.querySelector('.date-strip-container')) {
             dailySlotsContainer.innerHTML = `
                <div class="date-strip-container overflow-x-auto pb-4 mb-4"><div class="date-strip flex space-x-2"></div></div>
                <div class="accordion-container space-y-3"></div>
            `;
            renderDateStrip();
        }

        const accordion = dailySlotsContainer.querySelector('.accordion-container');
        accordion.innerHTML = '<div class="text-center py-4 text-slate-500">Cargando...</div>';
        const dateString = toISODateString(currentDisplayedDate);
        try {
            const weekData = await fetchApi(`/schedule/week?courtId=${selectedCourtId}&date=${dateString}`);
            const slots = weekData.schedule[dateString];
            Calendar.renderMobileDaily(dailySlotsContainer, slots);
        } catch (e) {
            accordion.innerHTML = `<p class="text-center py-4 text-red-500">${e.message}</p>`;
        }
    };

    // Renderiza la tira de fechas (lógica simple local por ahora, styled with Tailwind)
    function renderDateStrip() {
        const strip = dailySlotsContainer.querySelector('.date-strip');
        strip.innerHTML = '';
        let iterator = new Date(); iterator.setHours(0,0,0,0);

        for (let i = 0; i < 14; i++) {
            const div = document.createElement('div');
            // Tailwind classes for date item
            const isSelected = iterator.toDateString() === currentDisplayedDate.toDateString();
            div.className = `date-item flex-shrink-0 w-14 h-16 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all border ${
                isSelected
                ? 'bg-primary text-white border-primary shadow-md'
                : 'bg-white dark:bg-surface-dark text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-primary/50'
            }`;
            div.dataset.date = toISODateString(iterator);

            div.innerHTML = `
                <span class="text-xs font-medium uppercase">${iterator.toLocaleDateString('es-ES',{weekday:'short'}).replace('.','')}</span>
                <span class="text-lg font-bold">${iterator.getDate()}</span>
            `;
            strip.appendChild(div);
            iterator.setDate(iterator.getDate() + 1);
        }

        strip.onclick = (e) => {
            const item = e.target.closest('.date-item');
            if (item) {
                currentDisplayedDate = new Date(item.dataset.date + 'T00:00:00');
                renderDateStrip();
                renderMobileView();
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

        // The Calendar component might try to append to innerHTML, so we ensure the parent is clean
        // Note: Calendar.init in the old code took a root element.
        // Here we just use the module functions directly in renderWeekly/renderMobile.

        // Pass a dummy element or refactor Calendar.init if it sets global event delegation
        // Checking Calendar.js (from memory/context): it likely sets up event delegation on the container.
        // We will call init on the wrapper of the calendar to capture clicks.
        const calendarRoot = document.getElementById('weekly-calendar-container').parentElement;

        // We need to re-bind the click listener for the calendar slots
        // Since the Calendar module might assume a specific structure, we'll verify it works with the new layout
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
                    Modals.showMyBookingModal(bookingId, startTime);
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
                case 'on_waitlist':
                    Modals.showAlreadyOnWaitlistModal({ startTime, courtId: selectedCourtId });
                    break;
                case 'waitlist':
                case 'booked':
                case 'open_match_full':
                    Modals.showWaitlistModal({startTime, courtId: selectedCourtId, duration});
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
                // If there's only one court, we might hide the selector container
                if (courts.length <= 1) {
                    courtSelectorContainer.style.display = 'none';
                }
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
