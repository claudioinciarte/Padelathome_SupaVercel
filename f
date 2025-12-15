[33mcommit 12bb858c3162c67b80f73373d6af0c88185d8a60[m[33m ([m[1;36mHEAD -> [m[1;32mmain[m[33m, [m[1;31morigin/main[m[33m)[m
Author: inciartej86 <inciartej86@gmail.com>
Date:   Sun Nov 23 17:46:51 2025 +0100

    modulacion de dashboard.js y funcionalidad web y desktop

[1mdiff --git a/public/dashboard.html b/public/dashboard.html[m
[1mindex b656269..7deff7a 100644[m
[1m--- a/public/dashboard.html[m
[1m+++ b/public/dashboard.html[m
[36m@@ -13,6 +13,7 @@[m
             <h1 id="welcome-message">Bienvenido a Padel@Home</h1>[m
             <div class="header-buttons">[m
                 <button id="admin-panel-btn" style="display: none;">Panel de Admin</button>[m
[32m+[m[32m                <button id="profile-btn">Mi Perfil</button>[m
                 <button id="faq-button" onclick="location.href='/faq.html'">FAQ</button>[m
                 <button id="logout-button">Cerrar Sesión</button>[m
             </div>[m
[1mdiff --git a/public/dashboard.js b/public/dashboard.js[m
[1mindex 3f587fe..97c913b 100644[m
[1m--- a/public/dashboard.js[m
[1m+++ b/public/dashboard.js[m
[36m@@ -2,6 +2,22 @@[m [mimport { fetchApi, authToken } from './js/services/api.js';[m
 import { formatDate, formatTime, showNotification } from './js/utils.js';[m
 import * as Modals from './js/ui/modals.js';[m
 [m
[32m+[m[32m// --- Utilidades ---[m
[32m+[m[32mconst debounce = (func, delay) => {[m
[32m+[m[32m    let timeout;[m
[32m+[m[32m    return (...args) => {[m
[32m+[m[32m        clearTimeout(timeout);[m
[32m+[m[32m        timeout = setTimeout(() => func.apply(this, args), delay);[m
[32m+[m[32m    };[m
[32m+[m[32m};[m
[32m+[m
[32m+[m[32mfunction toISODateString(date) {[m
[32m+[m[32m    const year = date.getFullYear();[m
[32m+[m[32m    const month = (date.getMonth() + 1).toString().padStart(2, '0');[m
[32m+[m[32m    const day = date.getDate().toString().padStart(2, '0');[m
[32m+[m[32m    return `${year}-${month}-${day}`;[m
[32m+[m[32m}[m
[32m+[m
 // Inicializar conexión WebSocket[m
 const socket = io();[m
 socket.on('connect', () => console.log('Connected to WebSocket'));[m
[36m@@ -15,9 +31,10 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
     // --- Estado Global ---[m
     let currentDisplayedDate = new Date();[m
     let weeklyScheduleData = {};[m
[31m-    let userActiveBooking = null;[m
[32m+[m[32m    let userActiveBookings = [];[m
     let selectedCourtId = null;[m
     let courtsData = [];[m
[32m+[m[32m    let dailySlotsData = [];[m
 [m
     // --- Elementos del DOM ---[m
     const welcomeMessage = document.getElementById('welcome-message');[m
[36m@@ -61,8 +78,7 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
     const fetchMyBooking = async () => {[m
         try {[m
             const bookings = await fetchApi('/bookings/me'); // Espera array[m
[31m-            // Tomamos el primero si existe, para la lógica de "active"[m
[31m-            userActiveBooking = (bookings && bookings.length > 0) ? bookings[0] : null;[m
[32m+[m[32m            userActiveBookings = bookings || [];[m
             renderMyBookings(bookings);[m
         } catch (error) {[m
             console.error(error);[m
[36m@@ -76,15 +92,24 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
             bookings.forEach(booking => {[m
                 const isOwner = booking.participation_type === 'owner';[m
                 const btnText = isOwner ? 'Cancelar Reserva' : 'Abandonar Partida';[m
[31m-                // Usamos data attributes para delegación[m
[31m-                const btn = `<button class="action-btn" data-action="${isOwner ? 'cancel' : 'leave'}" data-id="${booking.id}">${btnText}</button>`;[m
                 [m
                 const div = document.createElement('div');[m
                 div.className = 'booking-item';[m
[31m-                div.innerHTML = `[m
[31m-                    <p><strong>${booking.court_name}</strong> - ${new Date(booking.start_time).toLocaleString()}</p>[m
[31m-                    ${btn}[m
[31m-                `;[m
[32m+[m
[32m+[m[32m                const p = document.createElement('p');[m
[32m+[m[32m                const strong = document.createElement('strong');[m
[32m+[m[32m                strong.textContent = booking.court_name;[m
[32m+[m[32m                p.appendChild(strong);[m
[32m+[m[32m                p.append(` - ${new Date(booking.start_time).toLocaleString()}`);[m
[32m+[m
[32m+[m[32m                const btn = document.createElement('button');[m
[32m+[m[32m                btn.className = 'action-btn';[m
[32m+[m[32m                btn.dataset.action = isOwner ? 'cancel' : 'leave';[m
[32m+[m[32m                btn.dataset.id = booking.id;[m
[32m+[m[32m                btn.textContent = btnText;[m
[32m+[m[41m                [m
[32m+[m[32m                div.appendChild(p);[m
[32m+[m[32m                div.appendChild(btn);[m
                 myBookingContainer.appendChild(div);[m
             });[m
         } else {[m
[36m@@ -120,8 +145,7 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
         if (isMobile) {[m
             calendarContainer.style.display = 'none';[m
             dailySlotsContainer.style.display = 'block';[m
[31m-            // TODO: Implementar renderMobileDailyView si se desea[m
[31m-            dailySlotsContainer.innerHTML = '<p>Vista móvil en construcción.</p>'; [m
[32m+[m[32m            renderMobileView(new Date());[m
         } else {[m
             dailySlotsContainer.style.display = 'none';[m
             calendarContainer.style.display = 'block';[m
[36m@@ -129,10 +153,184 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
         }[m
     }[m
 [m
[32m+[m[32m    // --- Renderizado de la Vista Móvil ---[m
[32m+[m[32m    async function renderMobileView(date) {[m
[32m+[m[32m        dailySlotsContainer.innerHTML = `[m
[32m+[m[32m            <div class="date-strip-container">[m
[32m+[m[32m                <div class="date-strip"></div>[m
[32m+[m[32m            </div>[m
[32m+[m[32m            <div class="accordion-container"></div>[m
[32m+[m[32m        `;[m
[32m+[m[32m        renderDateStrip(date);[m
[32m+[m[32m        await renderDaySlots(date);[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    function renderDateStrip(selectedDate) {[m
[32m+[m[32m        const strip = dailySlotsContainer.querySelector('.date-strip');[m
[32m+[m[32m        strip.innerHTML = '';[m
[32m+[m[32m        let date = new Date();[m
[32m+[m[32m        for (let i = 0; i < 14; i++) {[m
[32m+[m[32m            const dayItem = document.createElement('div');[m
[32m+[m[32m            dayItem.className = 'date-item';[m
[32m+[m[32m            if (date.toDateString() === selectedDate.toDateString()) {[m
[32m+[m[32m                dayItem.classList.add('selected');[m
[32m+[m[32m            }[m
[32m+[m[32m            dayItem.dataset.date = toISODateString(date);[m
[32m+[m[32m            dayItem.innerHTML = `[m
[32m+[m[32m                <span class="day-name">${date.toLocaleDateString('es-ES', { weekday: 'short' })}</span>[m
[32m+[m[32m                <span class="day-number">${date.getDate()}</span>[m
[32m+[m[32m            `;[m
[32m+[m[32m            strip.appendChild(dayItem);[m
[32m+[m[32m            date.setDate(date.getDate() + 1);[m
[32m+[m[32m        }[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    async function renderDaySlots(date) {[m
[32m+[m[32m        const accordionContainer = dailySlotsContainer.querySelector('.accordion-container');[m
[32m+[m[32m        accordionContainer.innerHTML = '<p>Cargando slots...</p>';[m
[32m+[m[32m        const dateString = toISODateString(date);[m
[32m+[m[32m        try {[m
[32m+[m[32m            dailySlotsData = await fetchApi(`/schedule/day?courtId=${selectedCourtId}&date=${dateString}`);[m
[32m+[m[32m            if (!dailySlotsData || dailySlotsData.length === 0) {[m
[32m+[m[32m                accordionContainer.innerHTML = '<p>No hay slots disponibles para este día.</p>';[m
[32m+[m[32m                return;[m
[32m+[m[32m            }[m
[32m+[m[32m            accordionContainer.innerHTML = '';[m
[32m+[m[32m            const now = new Date();[m
[32m+[m[32m            dailySlotsData.forEach((slot, index) => {[m
[32m+[m[32m                const slotTime = new Date(slot.startTime);[m
[32m+[m[32m                let status = slot.status;[m
[32m+[m[32m                if (slotTime < now) {[m
[32m+[m[32m                    status = 'past';[m
[32m+[m[32m                }[m
[32m+[m
[32m+[m[32m                const div = document.createElement('div');[m
[32m+[m[32m                div.className = 'daily-slot';[m
[32m+[m[32m                div.innerHTML = `[m
[32m+[m[32m                    <div class="slot-header" data-status="${status}" data-index="${index}">[m
[32m+[m[32m                        <span class="slot-time">${formatTime(slotTime)}</span>[m
[32m+[m[32m                        <span class="slot-status" data-status="${status}">${getSlotStatusText({ ...slot, status })}</span>[m
[32m+[m[32m                    </div>[m
[32m+[m[32m                    <div class="slot-details"></div>[m
[32m+[m[32m                `;[m
[32m+[m[32m                accordionContainer.appendChild(div);[m
[32m+[m[32m            });[m
[32m+[m[32m        } catch (error) {[m
[32m+[m[32m            accordionContainer.innerHTML = `<p class="error-text">${error.message}</p>`;[m
[32m+[m[32m        }[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    function getSlotStatusText(slot) {[m
[32m+[m[32m        switch (slot.status) {[m
[32m+[m[32m            case 'available': return 'Disponible';[m
[32m+[m[32m            case 'booked': return 'Ocupado';[m
[32m+[m[32m            case 'blocked': return 'Bloqueado';[m
[32m+[m[32m            case 'open_match_available': return `Abierta ${slot.participants_count || 1}/${slot.max_participants || 4}`;[m
[32m+[m[32m            case 'open_match_full': return `Llena ${slot.participants_count || 4}/${slot.max_participants || 4}`;[m
[32m+[m[32m            case 'my_private_booking': return 'Mi Reserva';[m
[32m+[m[32m            case 'my_joined_match': return `Inscrito`;[m
[32m+[m[32m            case 'past': return 'Pasado';[m
[32m+[m[32m            default: return 'No disponible';[m
[32m+[m[32m        }[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m[32m    function renderSlotDetails(detailsContainer, slot) {[m
[32m+[m[32m        detailsContainer.innerHTML = ''; // Limpiar[m
[32m+[m[32m        const { status, startTime, bookingId, availableDurations } = slot;[m
[32m+[m
[32m+[m[32m        if (status === 'available') {[m
[32m+[m[32m            detailsContainer.innerHTML = `[m
[32m+[m[32m                <div class="form-group open-match-toggle">[m
[32m+[m[32m                    <input type="checkbox" id="mobile-open-match-checkbox">[m
[32m+[m[32m                    <label for="mobile-open-match-checkbox">Abrir partida (4 jugadores)</label>[m
[32m+[m[32m                </div>[m
[32m+[m[32m                <div class="duration-options">[m
[32m+[m[32m                    ${availableDurations.map(d => `<button data-duration="${d}">${d} min</button>`).join('')}[m
[32m+[m[32m                </div>[m
[32m+[m[32m                <button class="cancel-booking">Cancelar</button>[m
[32m+[m[32m            `;[m
[32m+[m[32m            detailsContainer.querySelector('.cancel-booking').addEventListener('click', () => {[m
[32m+[m[32m                detailsContainer.classList.remove('active');[m
[32m+[m[32m                detailsContainer.innerHTML = '';[m
[32m+[m[32m            });[m
[32m+[m[32m            detailsContainer.querySelector('.duration-options').addEventListener('click', (e) => {[m
[32m+[m[32m                if (e.target.tagName === 'BUTTON') {[m
[32m+[m[32m                    const duration = e.target.dataset.duration;[m
[32m+[m[32m                    const isOpenMatch = detailsContainer.querySelector('#mobile-open-match-checkbox').checked;[m
[32m+[m[32m                    modalHandlers.onConfirmBooking({[m
[32m+[m[32m                        startTime: startTime,[m
[32m+[m[32m                        durationMinutes: parseInt(duration, 10),[m
[32m+[m[32m                        isOpenMatch: isOpenMatch[m
[32m+[m[32m                    });[m
[32m+[m[32m                }[m
[32m+[m[32m            });[m
[32m+[m[32m        } else if (status === 'my_private_booking') {[m
[32m+[m[32m            detailsContainer.innerHTML = `<p><strong>Mi Reserva Privada</strong></p><button class="cancel-booking-btn">Cancelar Reserva</button>`;[m
[32m+[m[32m            detailsContainer.querySelector('.cancel-booking-btn').addEventListener('click', () => {[m
[32m+[m[32m                modalHandlers.onCancelBooking({ bookingId: bookingId });[m
[32m+[m[32m            });[m
[32m+[m[32m        } else if (status === 'my_joined_match') {[m
[32m+[m[32m            detailsContainer.innerHTML = `[m
[32m+[m[32m                <p><strong>Partida Abierta (Inscrito)</strong></p>[m
[32m+[m[32m                <p>Participantes:</p>[m
[32m+[m[32m                <ul class="participants-list"></ul>[m
[32m+[m[32m                <button class="leave-match-btn">Abandonar Partida</button>[m
[32m+[m[32m            `;[m
[32m+[m[32m            const participantsList = detailsContainer.querySelector('.participants-list');[m
[32m+[m[32m            fetchApi(`/matches/${bookingId}/participants`).then(({ participants }) => {[m
[32m+[m[32m                if (participants && participants.length > 0) {[m
[32m+[m[32m                    participants.forEach(p => {[m
[32m+[m[32m                        const li = document.createElement('li');[m
[32m+[m[32m                        li.textContent = p.name;[m
[32m+[m[32m                        participantsList.appendChild(li);[m
[32m+[m[32m                    });[m
[32m+[m[32m                } else {[m
[32m+[m[32m                    participantsList.innerHTML = '<li>Cargando...</li>';[m
[32m+[m[32m                }[m
[32m+[m[32m            });[m
[32m+[m[32m            detailsContainer.querySelector('.leave-match-btn').addEventListener('click', () => {[m
[32m+[m[32m                modalHandlers.onLeaveMatch({ bookingId: bookingId });[m
[32m+[m[32m            });[m
[32m+[m[32m        } else if (status === 'booked' || status === 'open_match_full') {[m
[32m+[m[32m            detailsContainer.innerHTML = `<p>Este horario no está disponible.</p><button class="join-waitlist-btn">Apuntarse a lista de espera</button>`;[m
[32m+[m[32m            detailsContainer.querySelector('.join-waitlist-btn').addEventListener('click', () => {[m
[32m+[m[32m                modalHandlers.onJoinWaitlist({ courtId: selectedCourtId, startTime: startTime });[m
[32m+[m[32m            });[m
[32m+[m[32m        } else if (status === 'open_match_available') {[m
[32m+[m[32m            detailsContainer.innerHTML = `[m
[32m+[m[32m                <p><strong>Partida Abierta</strong></p>[m
[32m+[m[32m                <p>Participantes:</p>[m
[32m+[m[32m                <ul class="participants-list"></ul>[m
[32m+[m[32m                <button class="join-match-btn">Unirse a la Partida</button>[m
[32m+[m[32m                <button class="cancel-booking">Cancelar</button>[m
[32m+[m[32m            `;[m
[32m+[m[32m            const participantsList = detailsContainer.querySelector('.participants-list');[m
[32m+[m[32m            fetchApi(`/matches/${bookingId}/participants`).then(({ participants }) => {[m
[32m+[m[32m                if (participants && participants.length > 0) {[m
[32m+[m[32m                    participants.forEach(p => {[m
[32m+[m[32m                        const li = document.createElement('li');[m
[32m+[m[32m                        li.textContent = p.name;[m
[32m+[m[32m                        participantsList.appendChild(li);[m
[32m+[m[32m                    });[m
[32m+[m[32m                } else {[m
[32m+[m[32m                    participantsList.innerHTML = '<li>¡Sé el primero en unirte!</li>';[m
[32m+[m[32m                }[m
[32m+[m[32m            });[m
[32m+[m[32m            detailsContainer.querySelector('.join-match-btn').addEventListener('click', () => {[m
[32m+[m[32m                modalHandlers.onJoinMatch({ bookingId: bookingId });[m
[32m+[m[32m            });[m
[32m+[m[32m            detailsContainer.querySelector('.cancel-booking').addEventListener('click', () => {[m
[32m+[m[32m                detailsContainer.classList.remove('active');[m
[32m+[m[32m                detailsContainer.innerHTML = '';[m
[32m+[m[32m            });[m
[32m+[m[32m        }[m
[32m+[m[32m    }[m
[32m+[m
[32m+[m
     // --- Renderizado del Calendario (Grid) ---[m
     async function renderWeeklyCalendar(date) {[m
         calendarContainer.innerHTML = '<p>Cargando...</p>';[m
[31m-        const dateString = date.toISOString().split('T')[0];[m
[32m+[m[32m        const dateString = toISODateString(date);[m
         try {[m
             const data = await fetchApi(`/schedule/week?courtId=${selectedCourtId}&date=${dateString}`);[m
             weeklyScheduleData = data.schedule;[m
[36m@@ -169,13 +367,17 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
                     let status = daySlot.status;[m
                     if (slotTime < now) status = 'past';[m
 [m
[31m-                    // Clase CSS base[m
[32m+[m[32m                    // Clase CSS base y específicas[m
                     cell.className = `grid-cell slot ${status}`;[m
[32m+[m[32m                     if (status === 'my_open_match' || status === 'my_private_booking') {[m
[32m+[m[32m                        cell.classList.add('my-booking');[m
[32m+[m[32m                    }[m
                     [m
                     // Data attributes para el click[m
                     cell.dataset.status = status;[m
                     cell.dataset.starttime = daySlot.startTime;[m
                     if (daySlot.bookingId) cell.dataset.bookingId = daySlot.bookingId;[m
[32m+[m[32m                    if (daySlot.participation_type) cell.dataset.participationType = daySlot.participation_type;[m
                     [m
                     // Lógica de texto y atributos específicos[m
                     let text = '';[m
[36m@@ -187,24 +389,18 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
                     } else if (status === 'blocked') {[m
                         text = daySlot.reason || 'Bloqueado';[m
                     } else if (status === 'open_match_available') {[m
[31m-                        text = `Abierta ${daySlot.participants}/4`;[m
[31m-                        cell.dataset.action = 'join_match';[m
[31m-                        cell.dataset.participants = daySlot.participants;[m
[31m-                        cell.dataset.maxParticipants = daySlot.maxParticipants;[m
[32m+[m[32m                        text = `Abierta ${daySlot.participants || 1}/${daySlot.maxParticipants || 4}`;[m
                     } else if (status === 'open_match_full') {[m
                         text = 'Llena';[m
                         cell.dataset.waitlistable = 'true';[m
[32m+[m[32m                    } else if (status === 'my_private_booking') {[m
[32m+[m[32m                        text = 'Mi Reserva';[m
[32m+[m[32m                    } else if (status === 'my_open_match') {[m
[32m+[m[32m                        text = `Inscrito`;[m
                     } else if (status === 'past') {[m
                         text = 'Pasado';[m
                     }[m
[31m-[m
[31m-                    // Sobreescribir si es MI reserva[m
[31m-                    // Buscamos en la lista de mis reservas activas si alguna coincide con este slot[m
[31m-                    // Nota: userActiveBooking es un array ahora en la lógica global, pero aquí simplificamos[m
[31m-                    // Para hacerlo perfecto, deberíamos iterar sobre userActiveBookings (array)[m
[31m-                    // Pero como optimización, confiamos en el renderMyBookings para la gestión[m
                     [m
[31m-                    // Importante: NO ponemos botones HTML dentro. El clic lo maneja el contenedor.[m
                     cell.textContent = text;[m
                     grid.appendChild(cell);[m
                 });[m
[36m@@ -228,9 +424,7 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
                 [m
                 await fetchApi('/bookings', { method: 'POST', body: JSON.stringify(body) });[m
                 showNotification('Reserva creada', 'success');[m
[31m-                Modals.hideAllModals(); // Asegúrate de exportar esto en modals.js o cerrar manualmente[m
[31m-                // Hack si hideAllModals no es exportada:[m
[31m-                document.getElementById('modal-overlay').classList.add('hidden');[m
[32m+[m[32m                Modals.hideAllModals();[m
                 refreshDataAndRender();[m
             } catch (e) { showNotification(e.message, 'error'); }[m
         },[m
[36m@@ -243,14 +437,14 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
                     body: JSON.stringify({ courtId: parseInt(data.courtId), slotStartTime: data.startTime, slotEndTime: end })[m
                 });[m
                 showNotification('Apuntado a lista de espera', 'success');[m
[31m-                document.getElementById('waitlist-modal-overlay').classList.add('hidden');[m
[32m+[m[32m                Modals.hideAllModals();[m
             } catch (e) { showNotification(e.message, 'error'); }[m
         },[m
         onJoinMatch: async (data) => {[m
             try {[m
                 await fetchApi(`/matches/${data.bookingId}/join`, { method: 'POST' });[m
                 showNotification('Te has unido a la partida', 'success');[m
[31m-                document.getElementById('join-match-modal-overlay').classList.add('hidden');[m
[32m+[m[32m                Modals.hideAllModals();[m
                 refreshDataAndRender();[m
             } catch (e) { showNotification(e.message, 'error'); }[m
         },[m
[36m@@ -289,7 +483,7 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
             window.location.href = '/login.html';[m
         });[m
         adminPanelBtn.addEventListener('click', () => window.location.href = '/admin.html');[m
[31m-        profileBtn.addEventListener('click', () => window.location.href = '/profile.html');[m
[32m+[m[32m        if (profileBtn) profileBtn.addEventListener('click', () => window.location.href = '/profile.html');[m
         if(faqBtn) faqBtn.addEventListener('click', () => window.location.href = '/faq.html');[m
 [m
         prevWeekBtn.addEventListener('click', () => {[m
[36m@@ -314,29 +508,93 @@[m [mdocument.addEventListener('DOMContentLoaded', () => {[m
         calendarContainer.addEventListener('click', async (e) => {[m
             const cell = e.target.closest('.slot');[m
             if (!cell) return;[m
[32m+[m
             const status = cell.dataset.status;[m
             const startTime = cell.dataset.starttime;[m
[31m-            [m
[31m-            if (status === 'available') {[m
[31m-                Modals.showBookingModal(startTime, [60, 90]);[m
[31m-            } else if (status === 'booked' || status === 'open_match_full') {[m
[31m-                // Solo si tiene el flag waitlistable[m
[31m-                if (cell.dataset.waitlistable) Modals.showWaitlistModal(startTime, selectedCourtId);[m
[31m-            } else if (status === 'open_match_available') {[m
[31m-                const bookingId = cell.dataset.bookingId;[m
[31m-                try {[m
[31m-                    const participants = await fetchApi(`/matches/${bookingId}/participants`);[m
[31m-                    Modals.showOpenMatchModal({[m
[31m-                        bookingId, [m
[31m-                        starttime: startTime,[m
[31m-                        participants: cell.dataset.participants,[m
[31m-                        maxParticipants: cell.dataset.maxParticipants[m
[32m+[m[32m            const bookingId = cell.dataset.bookingId ? parseInt(cell.dataset.bookingId, 10) : null;[m
[32m+[m[32m            const participationType = cell.dataset.participationType;[m
[32m+[m
[32m+[m[32m            // Lógica de click basada en el nuevo status[m
[32m+[m[32m            switch (status) {[m
[32m+[m[32m                case 'available':[m
[32m+[m[32m                    Modals.showBookingModal(startTime, [60, 90]);[m
[32m+[m[32m                    break;[m
[32m+[m[41m                [m
[32m+[m[32m                case 'my_private_booking':[m
[32m+[m[32m                    Modals.showMyBookingModal(bookingId, startTime);[m
[32m+[m[32m                    break;[m
[32m+[m
[32m+[m[32m                case 'my_open_match': {[m
[32m+[m[32m                    const { participants } = await fetchApi(`/matches/${bookingId}/participants`);[m
[32m+[m[32m                    Modals.showMyMatchModal({[m
[32m+[m[32m                        bookingId: bookingId,[m
[32m+[m[32m                        startTime: startTime,[m
[32m+[m[32m                        isOwner: participationType === 'owner'[m
                     }, participants);[m
[31m-                } catch (e) { console.error(e); }[m
[32m+[m[32m                    break;[m
[32m+[m[32m                }[m
[32m+[m
[32m+[m[32m                case 'open_match_available': {[m
[32m+[m[32m                    try {[m
[32m+[m[32m                        const { participants } = await fetchApi(`/matches/${bookingId}/participants`);[m
[32m+[m[32m                        Modals.showOpenMatchModal({[m
[32m+[m[32m                            bookingId,[m
[32m+[m[32m                            starttime: startTime,[m
[32m+[m[32m                            participants: cell.dataset.participants,[m
[32m+[m[32m                            maxParticipants: cell.dataset.maxParticipants[m
[32m+[m[32m                        }, participants);[m
[32m+[m[32m                    } catch (err) {[m
[32m+[m[32m                        console.error('Error fetching participants:', err);[m
[32m+[m[32m                        showNotification('No se pudieron cargar los participantes.', 'error');[m
[32m+[m[32m                    }[m
[32m+[m[32m                    break;[m
[32m+[m[32m                }[m
[32m+[m
[32m+[m[32m                case 'booked':[m
[32m+[m[32m                case 'open_match_full':[m
[32m+[m[32m                    if (cell.dataset.waitlistable) {[m
[32m+[m[32m                        Modals.showWaitlistModal(startTime, selectedCourtId);[m
[32m+[m[32m                    }[m
[32m+[m[32m                    break;[m
[32m+[m[32m            }[m
[32m+[m[32m        });[m
[32m+[m
[32m+[m[32m        dailySlotsContainer.addEventListener('click', async (e) => {[m
[32m+[m[32m            if (e.target.closest('.date-item')) {[m
[32m+[m[32m                const dateItem = e.target.closest('.date-item');[m
[32m+[m[32m                const selectedDate = new Date(dateItem.dataset.date + 'T00:00:00');[m
[32m+[m[32m                renderDateStrip(selectedDate);[m
[32m+[m[32m                await renderDaySlots(selectedDate);[m
[32m+[m[32m            }[m
[32m+[m
[32m+[m[32m            if (e.target.closest('.slot-header')) {[m
[32m+[m[32m                const header = e.target.closest('.slot-header');[m
[32m+[m[32m                const status = header.dataset.status;[m
[32m+[m[32m                if (status === 'past') return;[m
[32m+[m[41m                [m
[32m+[m[32m                const details = header.nextElementSibling;[m
[32m+[m[32m                const index = header.dataset.index;[m
[32m+[m[32m                const slot = dailySlotsData[index];[m
[32m+[m
[32m+[m[32m                // Cerrar otros abiertos[m
[32m+[m[32m                document.querySelectorAll('.slot-details.active').forEach(d => {[m
[32m+[m[32m                    if (d !== details) {[m
[32m+[m[32m                        d.classList.remove('active');[m
[32m+[m[32m                        d.innerHTML = '';[m
[32m+[m[32m                    }[m
[32m+[m[32m                });[m
[32m+[m[41m                [m
[32m+[m[32m                details.classList.toggle('active');[m
[32m+[m
[32m+[m[32m                if (details.classList.contains('active')) {[m
[32m+[m[32m                    renderSlotDetails(details, slot);[m
[32m+[m[32m                } else {[m
[32m+[m[32m                    details.innerHTML = '';[m
[32m+[m[32m                }[m
             }[m
         });[m
 [m
[31m-        window.addEventListener('resize', handleViewChange);[m
[32m+[m[32m        window.addEventListener('resize', debounce(handleViewChange, 250));[m
     }[m
 [m
     init();[m
[1mdiff --git a/public/js/services/api.js b/public/js/services/api.js[m
[1mindex e5336a7..cfb8737 100644[m
[1m--- a/public/js/services/api.js[m
[1m+++ b/public/js/services/api.js[m
[36m@@ -1,4 +1,4 @@[m
[31m-const API_BASE_URL = 'https://padelathome.wincicloud.win';[m
[32m+[m[32mconst API_BASE_URL = '';[m
 export const authToken = localStorage.getItem('authToken');[m
 [m
 /**[m
[1mdiff --git a/public/style.css b/public/style.css[m
[1mindex 41b01c3..32434a2 100644[m
[1m--- a/public/style.css[m
[1m+++ b/public/style.css[m
[36m@@ -1,516 +1,571 @@[m
[31m-/* --- 1. Definición de Variables (Nuestra Paleta de Colores) --- */[m
[31m-:root {[m
[31m-  --primary-color: #0d6efd;      /* Azul profesional */[m
[31m-  --primary-color-rgb: 13, 110, 253; /* RGB values for --primary-color */[m
[31m-  --secondary-color: #6c757d;   /* Gris neutro */[m
[31m-  --accent-color: #527853;       /* Verde salvia (sage green) */[m
[31m-  --background-color: #f8f9fa;  /* Gris muy claro de fondo */[m
[31m-  --surface-color: #ffffff;     /* Blanco para "tarjetas" */[m
[31m-  --text-color: #212529;        /* Negro/gris oscuro de texto */[m
[31m-  --border-color: #dee2e6;      /* Gris claro de bordes */[m
[31m-  --success-color: #198754;     /* Verde de éxito */[m
[31m-  --danger-color: #dc3545;       /* Rojo de error/peligro */[m
[31m-}[m
[31m-[m
[31m-/* --- 2. Estilos Globales y Reset Básico --- */[m
[31m-body {[m
[31m-  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;[m
[31m-  margin: 0;[m
[31m-  background-color: var(--background-color);[m
[31m-  color: var(--text-color);[m
[31m-  line-height: 1.5;[m
[31m-}[m
[31m-[m
[31m-h1, h2, h3 {[m
[31m-  color: var(--primary-color);[m
[31m-  font-weight: 500;[m
[31m-}[m
[31m-[m
[31m-/* --- 3. Clases de Utilidad --- */[m
[31m-.container {[m
[31m-  max-width: 960px;[m
[31m-  margin: 20px auto;[m
[31m-  padding: 0 15px;[m
[31m-}[m
[31m-[m
[31m-.card {[m
[31m-  background-color: var(--surface-color);[m
[31m-  border: 1px solid var(--border-color);[m
[31m-  border-radius: 8px;[m
[31m-  padding: 24px;[m
[31m-  margin-bottom: 20px;[m
[31m-  box-shadow: 0 2px 4px rgba(0,0,0,0.05);[m
[31m-}[m
[31m-[m
[31m-.hidden {[m
[31m-  display: none !important;[m
[31m-}[m
[31m-[m
[31m-/* --- Estilos para Botones --- */[m
[31m-button {[m
[31m-  background-color: var(--primary-color);[m
[31m-  color: white;[m
[31m-  border: none;[m
[31m-  padding: 12px 20px; /* Slightly more padding */[m
[31m-  border-radius: 8px; /* Softer corners */[m
[31m-  cursor: pointer;[m
[31m-  font-size: 1em;[m
[31m-  transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;[m
[31m-  box-shadow: 0 2px 4px rgba(0,0,0,0.1); /* Subtle shadow */[m
[31m-}[m
[31m-button:hover {[m
[31m-  background-color: #0b5ed7;[m
[31m-  transform: translateY(-1px); /* Slight lift effect */[m
[31m-  box-shadow: 0 4px 8px rgba(0,0,0,0.15);[m
[31m-}[m
[31m-button:active {[m
[31m-  transform: translateY(0);[m
[31m-  box-shadow: 0 2px 4px rgba(0,0,0,0.1);[m
[31m-}[m
[31m-[m
[31m-/* --- Estilos para Formularios --- */[m
[31m-.form-group {[m
[31m-  margin-bottom: 1.5em;[m
[31m-}[m
[31m-.form-group label {[m
[31m-  display: block;[m
[31m-  margin-bottom: 0.5em;[m
[31m-  font-weight: 500;[m
[31m-}[m
[31m-input[type="text"], input[type="email"], input[type="password"],[m
[31m-input[type="tel"], input[type="date"], input[type="time"],[m
[31m-input[type="number"], input[type="datetime-local"],[m
[31m-textarea, select {[m
[31m-  width: 100%;[m
[31m-  padding: 12px; /* Slightly more padding */[m
[31m-  border: 1px solid var(--border-color); /* Keep border, but enhance focus */[m
[31m-  border-radius: 8px; /* Softer corners */[m
[31m-  box-sizing: border-box;[m
[31m-  font-size: 1em;[m
[31m-  transition: border-color 0.2s ease, box-shadow 0.2s ease; /* Smooth transitions */[m
[31m-}[m
[31m-input[type="text"]:focus, input[type="email"]:focus, input[type="password"]:focus,[m
[31m-input[type="tel"]:focus, input[type="date"]:focus, input[type="time"]:focus,[m
[31m-input[type="number"]:focus, input[type="datetime-local"]:focus,[m
[31m-textarea:focus, select:focus {[m
[31m-  border-color: var(--primary-color); /* Highlight border on focus */[m
[31m-  outline: none; /* Remove default outline */[m
[31m-  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.25); /* Subtle glow */[m
[31m-}[m
[31m-[m
[31m-/* --- Estilos para Páginas de Login/Registro --- */[m
[31m-.auth-container {[m
[31m-  display: flex;[m
[31m-  justify-content: center;[m
[31m-  align-items: center;[m
[31m-  min-height: 100vh;[m
[31m-  padding: 20px;[m
[31m-  box-sizing: border-box;[m
[31m-}[m
[31m-.auth-card {[m
[31m-  width: 100%;[m
[31m-  max-width: 400px;[m
[31m-}[m
[31m-.auth-card h1 { text-align: center; margin-bottom: 0.5em; }[m
[31m-.auth-card p { text-align: center; color: var(--secondary-color); margin-top: 0; margin-bottom: 2em; }[m
[31m-button.full-width { width: 100%; padding: 12px; font-size: 1.1em; margin-top: 1em; }[m
[31m-.switch-form-text { text-align: center; margin-top: 1.5em; }[m
[31m-a { color: var(--primary-color); text-decoration: none; }[m
[31m-a:hover { text-decoration: underline; }[m
[31m-.error-text { color: var(--danger-color); text-align: center; font-weight: bold; }[m
[31m-.success-text { color: var(--success-color); text-align: center; font-weight: bold; }[m
[31m-[m
[31m-/* --- Estilos para el Dashboard --- */[m
[31m-.main-header {[m
[31m-  display: flex;[m
[31m-  justify-content: space-between;[m
[31m-  align-items: center;[m
[31m-  margin-bottom: 20px;[m
[31m-}[m
[31m-.header-buttons { display: flex; gap: 10px; }[m
[31m-#logout-button { background-color: var(--secondary-color); }[m
[31m-#logout-button:hover { background-color: #5c636a; }[m
[31m-button#cancel-booking-btn { background-color: var(--danger-color); }[m
[31m-button#cancel-booking-btn:hover { background-color: #bb2d3b; }[m
[31m-button#leave-match-btn { background-color: var(--secondary-color); }[m
[31m-[m
[31m-/* --- Estilos para el Calendario Semanal --- */[m
[31m-.calendar-header {[m
[31m-  display: flex;[m
[31m-  justify-content: space-between;[m
[31m-  align-items: center;[m
[31m-  margin-bottom: 1em;[m
[31m-}[m
[31m-#weekly-calendar-container { overflow-x: auto; }[m
[31m-.calendar-grid {[m
[31m-  display: grid;[m
[31m-  grid-template-columns: 60px repeat(7, 1fr); [m
[31m-  gap: 2px;[m
[31m-  background-color: var(--border-color);[m
[31m-  border: 1px solid var(--border-color);[m
[31m-}[m
[31m-.grid-cell {[m
[31m-  background-color: var(--surface-color);[m
[31m-  padding: 8px;[m
[31m-  min-height: 40px;[m
[31m-  font-size: 0.85em;[m
[31m-  display: flex;[m
[31m-  align-items: center;[m
[31m-  justify-content: center;[m
[31m-  flex-direction: column;[m
[31m-  text-align: center;[m
[31m-}[m
[31m-.day-header, .time-header {[m
[31m-  background-color: #e9ecef;[m
[31m-  font-weight: bold;[m
[31m-  position: sticky; top: 0; z-index: 10;[m
[31m-}[m
[31m-.time-header { left: 0; z-index: 20; }[m
[31m-.slot { cursor: pointer; transition: transform 0.1s ease; }[m
[31m-.slot:hover { transform: scale(1.05); z-index: 30; }[m
[31m-[m
[31m-/* Colores de estado del slot */[m
[31m-.slot.available { background-color: #d4edda; }[m
[31m-.slot.open-match { background-color: #fff3cd; }[m
[31m-.slot.booked { background-color: #f8d7da; color: #58151d; }[m
[31m-.slot.blocked { background-color: #6c757d; color: white; }[m
[31m-.slot.past-slot { background-color: #adb5bd; color: #495057; cursor: not-allowed; }[m
[31m-.slot button.join-waitlist-btn {[m
[31m-  background-color: var(--primary-color);[m
[31m-  color: white;[m
[31m-  font-size: 0.9em;[m
[31m-  padding: 3px 6px;[m
[31m-  margin-top: 5px;[m
[31m-  border: none;[m
[31m-  border-radius: 3px;[m
[31m-}[m
[31m-.legend { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 15px; font-size: 0.9em; }[m
[31m-.color-box { display: inline-block; width: 15px; height: 15px; border: 1px solid #ccc; vertical-align: middle; margin-right: 5px;}[m
[31m-.color-box.available { background-color: #d4edda; }[m
[31m-.color-box.open-match { background-color: #fff3cd; }[m
[31m-.color-box.booked { background-color: #f8d7da; }[m
[31m-[m
[31m-/* --- Estilos para los Modales --- */[m
[31m-#modal-overlay, #waitlist-modal-overlay, #join-match-modal-overlay, #my-booking-modal-overlay, #my-match-modal-overlay {[m
[31m-  position: fixed; top: 0; left: 0; width: 100%; height: 100%;[m
[31m-  background-color: rgba(0, 0, 0, 0.6);[m
[31m-  display: flex; justify-content: center; align-items: center;[m
[31m-  z-index: 1000;[m
[31m-}[m
[31m-#booking-modal, #waitlist-modal, #join-match-modal, #my-booking-modal, #my-match-modal {[m
[31m-  width: 100%; max-width: 450px; text-align: center;[m
[31m-}[m
[31m-.open-match-toggle {[m
[31m-  display: flex; align-items: center; justify-content: center;[m
[31m-  gap: 10px; background-color: #f8f9fa; padding: 10px;[m
[31m-  border-radius: 5px; margin-bottom: 1em;[m
[31m-}[m
[31m-#modal-options-container, #waitlist-modal-options, #join-match-modal-options, #my-booking-modal-options, #my-match-modal-options {[m
[31m-  display: flex; justify-content: center; gap: 15px; margin: 20px 0;[m
[31m-}[m
[31m-#modal-options-container button, #waitlist-join-btn, #join-match-confirm-btn {[m
[31m-  background-color: var(--success-color);[m
[31m-}[m
[31m-#modal-cancel-btn, #waitlist-cancel-btn, #join-match-cancel-btn, #my-booking-close-btn, #my-match-close-btn {[m
[31m-  background-color: var(--secondary-color);[m
[31m-}[m
[31m-#my-booking-cancel-btn, #my-match-leave-btn {[m
[31m-  background-color: var(--danger-color);[m
[31m-}[m
[31m-[m
[31m-#my-match-participants-list, #join-match-participants-list {[m
[31m-  list-style: none;[m
[31m-  padding: 0;[m
[31m-  margin: 10px 0;[m
[31m-  max-height: 150px;[m
[31m-  overflow-y: auto;[m
[31m-  border: 1px solid var(--border-color);[m
[31m-  border-radius: 5px;[m
[31m-  background-color: var(--background-color);[m
[31m-}[m
[31m-[m
[31m-#my-match-participants-list li, #join-match-participants-list li {[m
[31m-  padding: 8px 15px;[m
[31m-  border-bottom: 1px solid var(--border-color);[m
[31m-  text-align: left;[m
[31m-  color: var(--text-color);[m
[31m-}[m
[31m-[m
[31m-#my-match-participants-list li:last-child, #join-match-participants-list li:last-child {[m
[31m-  border-bottom: none;[m
[31m-}[m
[31m-[m
[31m-/* --- Estilos para el Panel de Administración --- */[m
[31m-.admin-grid {[m
[31m-  display: grid;[m
[31m-  grid-template-columns: 1fr 1fr;[m
[31m-  gap: 20px;[m
[31m-}[m
[31m-.admin-card { display: flex; flex-direction: column; }[m
[31m-.full-width-card { grid-column: 1 / -1; }[m
[31m-table { width: 100%; border-collapse: collapse; margin-top: 1em; }[m
[31m-th, td { border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; vertical-align: middle; }[m
[31m-th { background-color: #f8f9fa; font-weight: 600; }[m
[31m-tr:nth-child(even) { background-color: #f8f9fa; }[m
[31m-td button { padding: 5px 10px; margin-right: 5px; font-size: 0.9em; }[m
[31m-#courts-list-container ul, #blocks-list-container ul, #buildings-list-container ul {[m
[31m-  list-style-type: none; padding: 0;[m
[31m-}[m
[31m-#courts-list-container li, #blocks-list-container li, #buildings-list-container li {[m
[31m-  padding: 10px; border-bottom: 1px solid var(--border-color);[m
[31m-}[m
[31m-#courts-list-container li:last-child, #blocks-list-container li:last-child, #buildings-list-container li:last-child {[m
[31m-  border-bottom: none;[m
[31m-}[m
[31m-.form-buttons { margin-top: 1em; }[m
[31m-.settings-grid {[m
[31m-  display: grid; grid-template-columns: 1fr 1fr;[m
[31m-  gap: 20px; margin: 1em 0;[m
[31m-}[m
[31m-#court-active-div, .settings-grid .form-group {[m
[31m-    display: flex; align-items: center; gap: 10px;[m
[31m-}[m
[31m-[m
[31m-/* --- Estilos para la sección de Estadísticas --- */[m
[31m-.stats-grid {[m
[31m-  display: grid;[m
[31m-  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));[m
[31m-  gap: 20px;[m
[31m-  margin-top: 20px;[m
[31m-}[m
[31m-[m
[31m-.stat-item {[m
[31m-  background-color: var(--background-color);[m
[31m-  border: 1px solid var(--border-color);[m
[31m-  border-radius: 8px;[m
[31m-  padding: 20px;[m
[31m-  text-align: center;[m
[31m-}[m
[31m-[m
[31m-.stat-item h3 {[m
[31m-  color: var(--primary-color);[m
[31m-  font-size: 1.2em;[m
[31m-  margin-bottom: 10px;[m
[31m-}[m
[31m-[m
[31m-.stat-item p {[m
[31m-  font-size: 2.5em;[m
[31m-  font-weight: bold;[m
[31m-  color: var(--accent-color);[m
[31m-  margin: 0;[m
[31m-}[m
[31m-[m
[31m-.stat-item ul {[m
[31m-  list-style: none;[m
[31m-  padding: 0;[m
[31m-  margin-top: 15px;[m
[31m-  text-align: left;[m
[31m-}[m
[31m-[m
[31m-.stat-item li {[m
[31m-  padding: 5px 0;[m
[31m-  border-bottom: 1px solid var(--border-color);[m
[31m-}[m
[31m-[m
[31m-.stat-item li:last-child {[m
[31m-  border-bottom: none;[m
[31m-}[m
[31m-[m
[31m-/* --- Estilos para Pestañas (Tabs) --- */[m
[31m-.tabs-container {[m
[31m-  margin-bottom: 20px;[m
[31m-}[m
[31m-[m
[31m-.tabs-nav {[m
[31m-  display: flex;[m
[31m-  border-bottom: 2px solid var(--border-color);[m
[31m-  margin-bottom: 20px;[m
[31m-}[m
[31m-[m
[31m-.tab-link {[m
[31m-  padding: 10px 20px;[m
[31m-  cursor: pointer;[m
[31m-  background-color: transparent;[m
[31m-  border: none;[m
[31m-  border-bottom: 2px solid transparent;[m
[31m-  margin-bottom: -2px; /* Alinea con el borde del contenedor */[m
[31m-  font-size: 1.1em;[m
[31m-  color: var(--secondary-color);[m
[31m-  transition: color 0.2s ease, border-bottom-color 0.2s ease;[m
[31m-}[m
[31m-[m
[31m-.tab-link:hover {[m
[31m-  color: var(--primary-color);[m
[31m-}[m
[31m-[m
[31m-.tab-link.active {[m
[31m-  border-bottom-color: var(--primary-color);[m
[31m-  color: var(--primary-color);[m
[31m-  font-weight: 600;[m
[31m-}[m
[31m-[m
[31m-.tab-content {[m
[31m-  display: none; /* Oculto por defecto */[m
[31m-}[m
[31m-[m
[31m-.tab-content.active {[m
[31m-  display: block; /* Muestra el contenido de la pestaña activa */[m
[31m-}[m
[31m-[m
[31m-/* --- Estilos para Acordeones (Collapsible) --- */[m
[31m-.accordion-item {[m
[31m-  border: 1px solid var(--border-color);[m
[31m-  border-radius: 8px;[m
[31m-  margin-bottom: 10px;[m
[31m-  overflow: hidden;[m
[31m-}[m
[31m-[m
[31m-.accordion-header {[m
[31m-  background-color: var(--background-color);[m
[31m-  padding: 15px 20px;[m
[31m-  cursor: pointer;[m
[31m-  display: flex;[m
[31m-  justify-content: space-between;[m
[31m-  align-items: center;[m
[31m-  font-size: 1.1em;[m
[31m-  font-weight: 500;[m
[31m-  color: var(--text-color);[m
[31m-  transition: background-color 0.2s ease;[m
[31m-}[m
[31m-[m
[31m-.accordion-header:hover {[m
[31m-  background-color: #e9ecef;[m
[31m-}[m
[31m-[m
[31m-.accordion-icon {[m
[31m-  font-size: 0.8em;[m
[31m-  transition: transform 0.2s ease;[m
[31m-}[m
[31m-[m
[31m-.accordion-header.active .accordion-icon {[m
[31m-  transform: rotate(180deg);[m
[31m-}[m
[31m-[m
[31m-.accordion-content {[m
[31m-  padding: 20px;[m
[31m-  border-top: 1px solid var(--border-color);[m
[31m-  display: none; /* Oculto por defecto */[m
[31m-}[m
[31m-[m
[31m-/* --- ESTILOS RESPONSIVOS ADICIONALES --- */[m
[31m-[m
[31m-.desktop-only { display: block; }[m
[31m-.mobile-only { display: none; }[m
[31m-[m
[31m-/* Por defecto, los contenedores de móvil están ocultos en escritorio */[m
[31m-.date-strip-container, #daily-slots-container {[m
[31m-    display: none;[m
[31m-}[m
[31m-[m
[31m-#court-select {[m
[31m-    width: 100%;[m
[31m-    max-width: 400px; /* Opcional: para que no sea excesivamente ancho en tablets */[m
[31m-    margin: 0 auto 15px auto; /* Centrado y con margen inferior */[m
[31m-    display: block;[m
[31m-}[m
[31m-[m
[31m-/* Tira de Fechas (Móvil) */[m
[31m-.date-strip-container {[m
[31m-    overflow-x: auto;[m
[31m-    white-space: nowrap;[m
[31m-    -webkit-overflow-scrolling: touch; /* Scrolling suave en iOS */[m
[31m-    scrollbar-width: none; /* Ocultar scrollbar en Firefox */[m
[31m-}[m
[31m-.date-strip-container::-webkit-scrollbar {[m
[31m-    display: none; /* Ocultar scrollbar en Chrome/Safari */[m
[31m-}[m
[31m-[m
[31m-.date-strip {[m
[31m-    display: inline-flex;[m
[31m-    gap: 10px;[m
[31m-    padding: 5px 0;[m
[31m-}[m
[31m-.date-item {[m
[31m-    cursor: pointer;[m
[31m-    padding: 8px 16px;[m
[31m-    border: 1px solid var(--border-color);[m
[31m-    border-radius: 20px;[m
[31m-    text-align: center;[m
[31m-    transition: all 0.2s ease;[m
[31m-}[m
[31m-.date-item.selected {[m
[31m-    background-color: var(--primary-color);[m
[31m-    color: white;[m
[31m-    border-color: var(--primary-color);[m
[31m-    font-weight: bold;[m
[31m-}[m
[31m-.date-item .day-name { display: block; font-size: 0.8em; }[m
[31m-.date-item .day-number { display: block; font-size: 1.1em; }[m
[31m-[m
[31m-/* Acordeón de Slots (Móvil) */[m
[31m-.daily-slot {[m
[31m-    border: 1px solid var(--border-color);[m
[31m-    border-radius: 8px;[m
[31m-    margin-bottom: 8px;[m
[31m-    background-color: var(--surface-color);[m
[31m-}[m
[31m-[m
[31m-.slot-header {[m
[31m-    padding: 15px;[m
[31m-    display: flex;[m
[31m-    justify-content: space-between;[m
[31m-    align-items: center;[m
[31m-    cursor: pointer;[m
[31m-}[m
[31m-[m
[31m-.slot-header[data-status="available"]:hover {[m
[31m-    background-color: #e9ecef;[m
[31m-}[m
[31m-[m
[31m-.slot-time { font-weight: bold; font-size: 1.1em; }[m
[31m-.slot-status {[m
[31m-    padding: 5px 10px;[m
[31m-    border-radius: 15px;[m
[31m-    font-size: 0.9em;[m
[31m-    font-weight: 500;[m
[31m-}[m
[31m-.slot-status[data-status="available"] { background-color: #d4edda; color: var(--text-color); }[m
[31m-.slot-status[data-status="open_match_available"] { background-color: #fff3cd; color: var(--text-color); } /* NUEVO */[m
[31m-.slot-status[data-status="booked"] { background-color: #f8d7da; color: #58151d; }[m
[31m-.slot-status[data-status="blocked"] { background-color: #6c757d; color: white; }[m
[31m-.slot-status[data-status="past"] { background-color: #adb5bd; color: #495057; }[m
[31m-[m
[31m-.slot-header[data-status="past"] {[m
[31m-    cursor: not-allowed;[m
[31m-    background-color: #e9ecef;[m
[31m-}[m
[31m-[m
[31m-.slot-details {[m
[31m-    display: none;[m
[31m-    padding: 0 15px 15px 15px;[m
[31m-    border-top: 1px solid var(--border-color);[m
[31m-    margin-top: -1px; /* Para que el borde se solape */[m
[31m-}[m
[31m-.slot-details.active {[m
[31m-    display: block;[m
[31m-}[m
[31m-.slot-details p { margin-top: 0; }[m
[31m-.slot-details .duration-options { display: flex; gap: 10px; margin-bottom: 15px; }[m
[31m-.slot-details .duration-options button { flex-grow: 1; }[m
[31m-[m
[31m-[m
[31m-@media (max-width: 768px) {[m
[31m-    .desktop-only, #weekly-calendar-container, .calendar-header > button, .calendar-header > h3 {[m
[31m-        display: none;[m
[31m-    }[m
[31m-[m
[31m-    .mobile-only, .date-strip-container, #daily-slots-container {[m
[31m-        display: block;[m
[31m-    }[m
[31m-[m
[31m-    .main-header {[m
[31m-        flex-direction: column;[m
[31m-        align-items: flex-start;[m
[31m-        gap: 15px;[m
[31m-    }[m
[31m-}[m
\ No newline at end of file[m
[32m+[m[32m/* --- 1. Definición de Variables (Nuestra Paleta de Colores) --- */[m
[32m+[m[32m:root {[m
[32m+[m[32m  --primary-color: #0d6efd;      /* Azul profesional */[m
[32m+[m[32m  --primary-color-rgb: 13, 110, 253; /* RGB values for --primary-color */[m
[32m+[m[32m  --secondary-color: #6c757d;   /* Gris neutro */[m
[32m+[m[32m  --accent-color: #527853;       /* Verde salvia (sage green) */[m
[32m+[m[32m  --background-color: #f8f9fa;  /* Gris muy claro de fondo */[m
[32m+[m[32m  --surface-color: #ffffff;     /* Blanco para "tarjetas" */[m
[32m+[m[32m  --text-color: #212529;        /* Negro/gris oscuro de texto */[m
[32m+[m[32m  --border-color: #dee2e6;      /* Gris claro de bordes */[m
[32m+[m[32m  --success-color: #198754;     /* Verde de éxito */[m
[32m+[m[32m  --danger-color: #dc3545;       /* Rojo de error/peligro */[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* --- 2. Estilos Globales y Reset Básico --- */[m
[32m+[m[32mbody {[m
[32m+[m[32m  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;[m
[32m+[m[32m  margin: 0;[m
[32m+[m[32m  background-color: var(--background-color);[m
[32m+[m[32m  color: var(--text-color);[m
[32m+[m[32m  line-height: 1.5;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32mh1, h2, h3 {[m
[32m+[m[32m  color: var(--primary-color);[m
[32m+[m[32m  font-weight: 500;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* --- 3. Clases de Utilidad --- */[m
[32m+[m[32m.container {[m
[32m+[m[32m  max-width: 960px;[m
[32m+[m[32m  margin: 20px auto;[m
[32m+[m[32m  padding: 0 15px;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.card {[m
[32m+[m[32m  background-color: var(--surface-color);[m
[32m+[m[32m  border: 1px solid var(--border-color);[m
[32m+[m[32m  border-radius: 8px;[m
[32m+[m[32m  padding: 24px;[m
[32m+[m[32m  margin-bottom: 20px;[m
[32m+[m[32m  box-shadow: 0 2px 4px rgba(0,0,0,0.05);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.hidden {[m
[32m+[m[32m  display: none !important;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* --- Estilos para Botones --- */[m
[32m+[m[32mbutton {[m
[32m+[m[32m  background-color: var(--primary-color);[m
[32m+[m[32m  color: white;[m
[32m+[m[32m  border: none;[m
[32m+[m[32m  padding: 12px 20px; /* Slightly more padding */[m
[32m+[m[32m  border-radius: 8px; /* Softer corners */[m
[32m+[m[32m  cursor: pointer;[m
[32m+[m[32m  font-size: 1em;[m
[32m+[m[32m  transition: background-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;[m
[32m+[m[32m  box-shadow: 0 2px 4px rgba(0,0,0,0.1); /* Subtle shadow */[m
[32m+[m[32m}[m
[32m+[m[32mbutton:hover {[m
[32m+[m[32m  background-color: #0b5ed7;[m
[32m+[m[32m  transform: translateY(-1px); /* Slight lift effect */[m
[32m+[m[32m  box-shadow: 0 4px 8px rgba(0,0,0,0.15);[m
[32m+[m[32m}[m
[32m+[m[32mbutton:active {[m
[32m+[m[32m  transform: translateY(0);[m
[32m+[m[32m  box-shadow: 0 2px 4px rgba(0,0,0,0.1);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* --- Estilos para Formularios --- */[m
[32m+[m[32m.form-group {[m
[32m+[m[32m  margin-bottom: 1.5em;[m
[32m+[m[32m}[m
[32m+[m[32m.form-group label {[m
[32m+[m[32m  display: block;[m
[32m+[m[32m  margin-bottom: 0.5em;[m
[32m+[m[32m  font-weight: 500;[m
[32m+[m[32m}[m
[32m+[m[32minput[type="text"], input[type="email"], input[type="password"],[m
[32m+[m[32minput[type="tel"], input[type="date"], input[type="time"],[m
[32m+[m[32minput[type="number"], input[type="datetime-local"],[m
[32m+[m[32mtextarea, select {[m
[32m+[m[32m  width: 100%;[m
[32m+[m[32m  padding: 12px; /* Slightly more padding */[m
[32m+[m[32m  border: 1px solid var(--border-color); /* Keep border, but enhance focus */[m
[32m+[m[32m  border-radius: 8px; /* Softer corners */[m
[32m+[m[32m  box-sizing: border-box;[m
[32m+[m[32m  font-size: 1em;[m
[32m+[m[32m  transition: border-color 0.2s ease, box-shadow 0.2s ease; /* Smooth transitions */[m
[32m+[m[32m}[m
[32m+[m[32minput[type="text"]:focus, input[type="email"]:focus, input[type="password"]:focus,[m
[32m+[m[32minput[type="tel"]:focus, input[type="date"]:focus, input[type="time"]:focus,[m
[32m+[m[32minput[type="number"]:focus, input[type="datetime-local"]:focus,[m
[32m+[m[32mtextarea:focus, select:focus {[m
[32m+[m[32m  border-color: var(--primary-color); /* Highlight border on focus */[m
[32m+[m[32m  outline: none; /* Remove default outline */[m
[32m+[m[32m  box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.25); /* Subtle glow */[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* --- Estilos para Páginas de Login/Registro --- */[m
[32m+[m[32m.auth-container {[m
[32m+[m[32m  display: flex;[m
[32m+[m[32m  justify-content: center;[m
[32m+[m[32m  align-items: center;[m
[32m+[m[32m  min-height: 100vh;[m
[32m+[m[32m  padding: 20px;[m
[32m+[m[32m  box-sizing: border-box;[m
[32m+[m[32m}[m
[32m+[m[32m.auth-card {[m
[32m+[m[32m  width: 100%;[m
[32m+[m[32m  max-width: 400px;[m
[32m+[m[32m}[m
[32m+[m[32m.auth-card h1 { text-align: center; margin-bottom: 0.5em; }[m
[32m+[m[32m.auth-card p { text-align: center; color: var(--secondary-color); margin-top: 0; margin-bottom: 2em; }[m
[32m+[m[32mbutton.full-width { width: 100%; padding: 12px; font-size: 1.1em; margin-top: 1em; }[m
[32m+[m[32m.switch-form-text { text-align: center; margin-top: 1.5em; }[m
[32m+[m[32ma { color: var(--primary-color); text-decoration: none; }[m
[32m+[m[32ma:hover { text-decoration: underline; }[m
[32m+[m[32m.error-text { color: var(--danger-color); text-align: center; font-weight: bold; }[m
[32m+[m[32m.success-text { color: var(--success-color); text-align: center; font-weight: bold; }[m
[32m+[m
[32m+[m[32m/* --- Estilos para el Dashboard --- */[m
[32m+[m[32m.main-header {[m
[32m+[m[32m  display: flex;[m
[32m+[m[32m  justify-content: space-between;[m
[32m+[m[32m  align-items: center;[m
[32m+[m[32m  margin-bottom: 20px;[m
[32m+[m[32m}[m
[32m+[m[32m.header-buttons { display: flex; gap: 10px; }[m
[32m+[m[32m#logout-button { background-color: var(--secondary-color); }[m
[32m+[m[32m#logout-button:hover { background-color: #5c636a; }[m
[32m+[m[32mbutton#cancel-booking-btn { background-color: var(--danger-color); }[m
[32m+[m[32mbutton#cancel-booking-btn:hover { background-color: #bb2d3b; }[m
[32m+[m[32mbutton#leave-match-btn { background-color: var(--secondary-color); }[m
[32m+[m
[32m+[m[32m/* --- Estilos para el Calendario Semanal --- */[m
[32m+[m[32m.calendar-header {[m
[32m+[m[32m  display: flex;[m
[32m+[m[32m  justify-content: space-between;[m
[32m+[m[32m  align-items: center;[m
[32m+[m[32m  margin-bottom: 1em;[m
[32m+[m[32m}[m
[32m+[m[32m#weekly-calendar-container { overflow-x: auto; }[m
[32m+[m[32m.calendar-grid {[m
[32m+[m[32m  display: grid;[m
[32m+[m[32m  grid-template-columns: 60px repeat(7, 1fr);[m[41m [m
[32m+[m[32m  gap: 2px;[m
[32m+[m[32m  background-color: var(--border-color);[m
[32m+[m[32m  border: 1px solid var(--border-color);[m
[32m+[m[32m}[m
[32m+[m[32m.grid-cell {[m
[32m+[m[32m  background-color: var(--surface-color);[m
[32m+[m[32m  padding: 8px;[m
[32m+[m[32m  min-height: 40px;[m
[32m+[m[32m  font-size: 0.85em;[m
[32m+[m[32m  display: flex;[m
[32m+[m[32m  align-items: center;[m
[32m+[m[32m  justify-content: center;[m
[32m+[m[32m  flex-direction: column;[m
[32m+[m[32m  text-align: center;[m
[32m+[m[32m}[m
[32m+[m[32m.day-header, .time-header, .header {[m
[32m+[m[32m  background-color: #e9ecef;[m
[32m+[m[32m  font-weight: bold;[m
[32m+[m[32m  position: sticky; top: 0; z-index: 10;[m
[32m+[m[32m}[m
[32m+[m[32m.time-header { left: 0; z-index: 20; }[m
[32m+[m[32m.slot { cursor: pointer; transition: transform 0.1s ease; }[m
[32m+[m[32m.slot:hover { transform: scale(1.05); z-index: 30; }[m
[32m+[m
[32m+[m[32m/* Colores de estado del slot */[m
[32m+[m[32m.slot.available { background-color: #d4edda; }[m
[32m+[m[32m.slot.open-match-available { background-color: #fff3cd; }[m
[32m+[m[32m.slot.booked { background-color: #f8d7da; color: #58151d; }[m
[32m+[m[32m.slot.blocked { background-color: #6c757d; color: white; }[m
[32m+[m[32m.slot.past { background-color: #adb5bd; color: #495057; cursor: not-allowed; }[m
[32m+[m[32m.slot.my_private_booking, .slot.my_joined_match { background-color: #f8d7da; }[m
[32m+[m
[32m+[m[32m.slot button.join-waitlist-btn {[m
[32m+[m[32m  background-color: var(--primary-color);[m
[32m+[m[32m  color: white;[m
[32m+[m[32m  font-size: 0.9em;[m
[32m+[m[32m  padding: 3px 6px;[m
[32m+[m[32m  margin-top: 5px;[m
[32m+[m[32m  border: none;[m
[32m+[m[32m  border-radius: 3px;[m
[32m+[m[32m}[m
[32m+[m[32m.legend { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 15px; font-size: 0.9em; }[m
[32m+[m[32m.color-box { display: inline-block; width: 15px; height: 15px; border: 1px solid #ccc; vertical-align: middle; margin-right: 5px;}[m
[32m+[m[32m.color-box.available { background-color: #d4edda; }[m
[32m+[m[32m.color-box.open-match { background-color: #fff3cd; }[m
[32m+[m[32m.color-box.booked { background-color: #f8d7da; }[m
[32m+[m
[32m+[m[32m/* --- Estilos para los Modales --- */[m
[32m+[m[32m#modal-overlay, #waitlist-modal-overlay, #join-match-modal-overlay, #my-booking-modal-overlay, #my-match-modal-overlay {[m
[32m+[m[32m  position: fixed; top: 0; left: 0; width: 100%; height: 100%;[m
[32m+[m[32m  background-color: rgba(0, 0, 0, 0.6);[m
[32m+[m[32m  display: flex; justify-content: center; align-items: center;[m
[32m+[m[32m  z-index: 1000;[m
[32m+[m[32m}[m
[32m+[m[32m#booking-modal, #waitlist-modal, #join-match-modal, #my-booking-modal, #my-match-modal {[m
[32m+[m[32m  width: 100%; max-width: 450px; text-align: center;[m
[32m+[m[32m}[m
[32m+[m[32m.open-match-toggle {[m
[32m+[m[32m  display: flex; align-items: center; justify-content: center;[m
[32m+[m[32m  gap: 10px; background-color: #f8f9fa; padding: 10px;[m
[32m+[m[32m  border-radius: 5px; margin-bottom: 1em;[m
[32m+[m[32m}[m
[32m+[m[32m#modal-options-container, #waitlist-modal-options, #join-match-modal-options, #my-booking-modal-options, #my-match-modal-options {[m
[32m+[m[32m  display: flex; justify-content: center; gap: 15px; margin: 20px 0;[m
[32m+[m[32m}[m
[32m+[m[32m#modal-options-container button, #waitlist-join-btn, #join-match-confirm-btn {[m
[32m+[m[32m  background-color: var(--success-color);[m
[32m+[m[32m}[m
[32m+[m[32m#modal-cancel-btn, #waitlist-cancel-btn, #join-match-cancel-btn, #my-booking-close-btn, #my-match-close-btn {[m
[32m+[m[32m  background-color: var(--secondary-color);[m
[32m+[m[32m}[m
[32m+[m[32m#my-booking-cancel-btn, #my-match-leave-btn {[m
[32m+[m[32m  background-color: var(--danger-color);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m#my-match-participants-list, #join-match-participants-list {[m
[32m+[m[32m  list-style: none;[m
[32m+[m[32m  padding: 0;[m
[32m+[m[32m  margin: 10px 0;[m
[32m+[m[32m  max-height: 150px;[m
[32m+[m[32m  overflow-y: auto;[m
[32m+[m[32m  border: 1px solid var(--border-color);[m
[32m+[m[32m  border-radius: 5px;[m
[32m+[m[32m  background-color: var(--background-color);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m#my-match-participants-list li, #join-match-participants-list li {[m
[32m+[m[32m  padding: 8px 15px;[m
[32m+[m[32m  border-bottom: 1px solid var(--border-color);[m
[32m+[m[32m  text-align: left;[m
[32m+[m[32m  color: var(--text-color);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m#my-match-participants-list li:last-child, #join-match-participants-list li:last-child {[m
[32m+[m[32m  border-bottom: none;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* --- Estilos para el Panel de Administración --- */[m
[32m+[m[32m.admin-grid {[m
[32m+[m[32m  display: grid;[m
[32m+[m[32m  grid-template-columns: 1fr 1fr;[m
[32m+[m[32m  gap: 20px;[m
[32m+[m[32m}[m
[32m+[m[32m.admin-card { display: flex; flex-direction: column; }[m
[32m+[m[32m.full-width-card { grid-column: 1 / -1; }[m
[32m+[m[32mtable { width: 100%; border-collapse: collapse; margin-top: 1em; }[m
[32m+[m[32mth, td { border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; vertical-align: middle; }[m
[32m+[m[32mth { background-color: #f8f9fa; font-weight: 600; }[m
[32m+[m[32mtr:nth-child(even) { background-color: #f8f9fa; }[m
[32m+[m[32mtd button { padding: 5px 10px; margin-right: 5px; font-size: 0.9em; }[m
[32m+[m[32m#courts-list-container ul, #blocks-list-container ul, #buildings-list-container ul {[m
[32m+[m[32m  list-style-type: none; padding: 0;[m
[32m+[m[32m}[m
[32m+[m[32m#courts-list-container li, #blocks-list-container li, #buildings-list-container li {[m
[32m+[m[32m  padding: 10px; border-bottom: 1px solid var(--border-color);[m
[32m+[m[32m}[m
[32m+[m[32m#courts-list-container li:last-child, #blocks-list-container li:last-child, #buildings-list-container li:last-child {[m
[32m+[m[32m  border-bottom: none;[m
[32m+[m[32m}[m
[32m+[m[32m.form-buttons { margin-top: 1em; }[m
[32m+[m[32m.settings-grid {[m
[32m+[m[32m  display: grid; grid-template-columns: 1fr 1fr;[m
[32m+[m[32m  gap: 20px; margin: 1em 0;[m
[32m+[m[32m}[m
[32m+[m[32m#court-active-div, .settings-grid .form-group {[m
[32m+[m[32m    display: flex; align-items: center; gap: 10px;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* --- Estilos para la sección de Estadísticas --- */[m
[32m+[m[32m.stats-grid {[m
[32m+[m[32m  display: grid;[m
[32m+[m[32m  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));[m
[32m+[m[32m  gap: 20px;[m
[32m+[m[32m  margin-top: 20px;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.stat-item {[m
[32m+[m[32m  background-color: var(--background-color);[m
[32m+[m[32m  border: 1px solid var(--border-color);[m
[32m+[m[32m  border-radius: 8px;[m
[32m+[m[32m  padding: 20px;[m
[32m+[m[32m  text-align: center;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.stat-item h3 {[m
[32m+[m[32m  color: var(--primary-color);[m
[32m+[m[32m  font-size: 1.2em;[m
[32m+[m[32m  margin-bottom: 10px;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.stat-item p {[m
[32m+[m[32m  font-size: 2.5em;[m
[32m+[m[32m  font-weight: bold;[m
[32m+[m[32m  color: var(--accent-color);[m
[32m+[m[32m  margin: 0;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.stat-item ul {[m
[32m+[m[32m  list-style: none;[m
[32m+[m[32m  padding: 0;[m
[32m+[m[32m  margin-top: 15px;[m
[32m+[m[32m  text-align: left;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.stat-item li {[m
[32m+[m[32m  padding: 5px 0;[m
[32m+[m[32m  border-bottom: 1px solid var(--border-color);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.stat-item li:last-child {[m
[32m+[m[32m  border-bottom: none;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* --- Estilos para Pestañas (Tabs) --- */[m
[32m+[m[32m.tabs-container {[m
[32m+[m[32m  margin-bottom: 20px;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.tabs-nav {[m
[32m+[m[32m  display: flex;[m
[32m+[m[32m  border-bottom: 2px solid var(--border-color);[m
[32m+[m[32m  margin-bottom: 20px;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.tab-link {[m
[32m+[m[32m  padding: 10px 20px;[m
[32m+[m[32m  cursor: pointer;[m
[32m+[m[32m  background-color: transparent;[m
[32m+[m[32m  border: none;[m
[32m+[m[32m  border-bottom: 2px solid transparent;[m
[32m+[m[32m  margin-bottom: -2px; /* Alinea con el borde del contenedor */[m
[32m+[m[32m  font-size: 1.1em;[m
[32m+[m[32m  color: var(--secondary-color);[m
[32m+[m[32m  transition: color 0.2s ease, border-bottom-color 0.2s ease;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.tab-link:hover {[m
[32m+[m[32m  color: var(--primary-color);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.tab-link.active {[m
[32m+[m[32m  border-bottom-color: var(--primary-color);[m
[32m+[m[32m  color: var(--primary-color);[m
[32m+[m[32m  font-weight: 600;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.tab-content {[m
[32m+[m[32m  display: none; /* Oculto por defecto */[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.tab-content.active {[m
[32m+[m[32m  display: block; /* Muestra el contenido de la pestaña activa */[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* --- Estilos para Acordeones (Collapsible) --- */[m
[32m+[m[32m.accordion-item {[m
[32m+[m[32m  border: 1px solid var(--border-color);[m
[32m+[m[32m  border-radius: 8px;[m
[32m+[m[32m  margin-bottom: 10px;[m
[32m+[m[32m  overflow: hidden;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.accordion-header {[m
[32m+[m[32m  background-color: var(--background-color);[m
[32m+[m[32m  padding: 15px 20px;[m
[32m+[m[32m  cursor: pointer;[m
[32m+[m[32m  display: flex;[m
[32m+[m[32m  justify-content: space-between;[m
[32m+[m[32m  align-items: center;[m
[32m+[m[32m  font-size: 1.1em;[m
[32m+[m[32m  font-weight: 500;[m
[32m+[m[32m  color: var(--text-color);[m
[32m+[m[32m  transition: background-color 0.2s ease;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.accordion-header:hover {[m
[32m+[m[32m  background-color: #e9ecef;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.accordion-icon {[m
[32m+[m[32m  font-size: 0.8em;[m
[32m+[m[32m  transition: transform 0.2s ease;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.accordion-header.active .accordion-icon {[m
[32m+[m[32m  transform: rotate(180deg);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m.accordion-content {[m
[32m+[m[32m  padding: 20px;[m
[32m+[m[32m  border-top: 1px solid var(--border-color);[m
[32m+[m[32m  display: none; /* Oculto por defecto */[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m/* --- ESTILOS RESPONSIVOS ADICIONALES --- */[m
[32m+[m
[32m+[m[32m.desktop-only { display: block; }[m
[32m+[m[32m.mobile-only { display: none; }[m
[32m+[m
[32m+[m[32m/* Por defecto, los contenedores de móvil están ocultos en escritorio */[m
[32m+[m[32m.date-strip-container, #daily-slots-container {[m
[32m+[m[32m    display: none;[m
[32m+[m[32m}[m
[32m+[m
[32m+[m[32m#court-select {[m
[32m+[m[32m    width: 100%;[m
[32m+[m[32m    max-width: 400px; /* Opcional: para que no sea excesivamente ancho en tablets */[m
[32m+[m[32m    margin: 0 auto 15px auto; /* Centrado y con margen inferior */[m
[32m+[m[32m    display: block;[m
[32m+[m[32m}[m
