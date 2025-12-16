import { formatTime } from '../utils.js';

// --- DOM Element References ---
const bookingModalOverlay = document.getElementById('modal-overlay');
const bookingModalTitle = document.getElementById('modal-title');
const bookingModalTime = document.getElementById('modal-time');
const bookingModalOptions = document.getElementById('modal-options-container');
const openMatchCheckbox = document.getElementById('open-match-checkbox');
const bookingModalCancelBtn = document.getElementById('modal-cancel-btn');
const bookingModalConfirmBtn = document.getElementById('modal-confirm-btn');

const waitlistModalOverlay = document.getElementById('waitlist-modal-overlay');
const waitlistJoinBtn = document.getElementById('waitlist-join-btn');
const waitlistCancelBtn = document.getElementById('waitlist-cancel-btn');

const joinMatchModalOverlay = document.getElementById('join-match-modal-overlay');
const joinMatchTime = document.getElementById('join-match-time');
const joinMatchParticipants = document.getElementById('join-match-participants');
const joinMatchParticipantsList = document.getElementById('join-match-participants-list');
const joinMatchConfirmBtn = document.getElementById('join-match-confirm-btn');
const joinMatchCancelBtn = document.getElementById('join-match-cancel-btn');

const myBookingModalOverlay = document.getElementById('my-booking-modal-overlay');
const myBookingModalTime = document.getElementById('my-booking-modal-time');
const myBookingCancelBtn = document.getElementById('my-booking-cancel-btn');
const myBookingCloseBtn = document.getElementById('my-booking-close-btn');

const myMatchModalOverlay = document.getElementById('my-match-modal-overlay');
const myMatchModalTime = document.getElementById('my-match-modal-time');
const myMatchParticipantsList = document.getElementById('my-match-participants-list');
const myMatchCancelMatchBtn = document.getElementById('my-match-cancel-match-btn');
const myMatchLeaveBtn = document.getElementById('my-match-leave-btn');
const myMatchCloseBtn = document.getElementById('my-match-close-btn');

/**
 * Hides all modals.
 */
export function hideAllModals() {
    bookingModalOverlay.classList.add('hidden');
    waitlistModalOverlay.classList.add('hidden');
    joinMatchModalOverlay.classList.add('hidden');
    myBookingModalOverlay.classList.add('hidden');
    myMatchModalOverlay.classList.add('hidden');
}

/**
 * Initializes all modal event listeners for closing and confirmation actions.
 * @param {object} handlers - An object containing the callback functions for modal actions.
 * @param {Function} handlers.onConfirmBooking - (data) => {}
 * @param {Function} handlers.onJoinWaitlist - (data) => {}
 * @param {Function} handlers.onJoinMatch - (data) => {}
 * @param {Function} handlers.onCancelBooking - (data) => {}
 * @param {Function} handlers.onLeaveMatch - (data) => {}
 */
export function initModals(handlers) {
    // General close listeners
    [bookingModalOverlay, waitlistModalOverlay, joinMatchModalOverlay, myBookingModalOverlay, myMatchModalOverlay].forEach(overlay => {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                hideAllModals();
            }
        });
    });

    [bookingModalCancelBtn, waitlistCancelBtn, joinMatchCancelBtn, myBookingCloseBtn, myMatchCloseBtn].forEach(btn => btn.addEventListener('click', hideAllModals));

    // Action listeners
    if (handlers.onConfirmBooking) {
        bookingModalConfirmBtn.addEventListener('click', () => {
            const selectedDurationButton = bookingModalOptions.querySelector('.selected');
            if (!selectedDurationButton) {
                console.error("No duration selected");
                // Optionally, show a message to the user
                return;
            }
            const { starttime, duration } = selectedDurationButton.dataset;
            handlers.onConfirmBooking({
                startTime: starttime,
                durationMinutes: parseInt(duration, 10),
                isOpenMatch: openMatchCheckbox.checked
            });
        });
    }

    if (handlers.onJoinWaitlist) {
        waitlistJoinBtn.addEventListener('click', () => {
             const { courtid, starttime } = waitlistJoinBtn.dataset;
             handlers.onJoinWaitlist({ courtId: courtid, startTime: starttime });
        });
    }
    
    if (handlers.onJoinMatch) {
        joinMatchConfirmBtn.addEventListener('click', (event) => {
            const { bookingId } = event.target.dataset;
            handlers.onJoinMatch({ bookingId });
        });
    }
    
    if (handlers.onCancelBooking) {
        myBookingCancelBtn.addEventListener('click', (event) => {
            const { bookingId } = event.target.dataset;
            handlers.onCancelBooking(bookingId); // Corrected here
        });
        myMatchCancelMatchBtn.addEventListener('click', (event) => {
            const { bookingId } = event.target.dataset;
            handlers.onCancelBooking(bookingId); // Corrected here
        });
    }
    
    if (handlers.onLeaveMatch) {
        myMatchLeaveBtn.addEventListener('click', (event) => {
            const { bookingId } = event.target.dataset;
            handlers.onLeaveMatch(bookingId); // Corrected here
        });
    }
}

export function showBookingModal(startTime, availableDurations) {
    openMatchCheckbox.checked = false;
    bookingModalTime.textContent = formatTime(new Date(startTime));
    bookingModalOptions.innerHTML = ''; // Clear previous options

    availableDurations.forEach((duration, index) => {
        const button = document.createElement('button');
        button.className = 'duration-button';
        if (index === 0) { // Select the first duration by default
            button.classList.add('selected');
        }
        button.dataset.duration = duration;
        button.dataset.starttime = startTime;

        const title = document.createElement('span');
        title.className = 'duration-button-title';
        title.textContent = `${duration} min`;

        const subtitle = document.createElement('span');
        subtitle.className = 'duration-button-subtitle';
        subtitle.textContent = duration === 60 ? 'Estándar' : 'Extendido';

        const checkIcon = document.createElement('span');
        checkIcon.className = 'material-icons-round check-icon';
        checkIcon.textContent = 'check_circle';

        button.appendChild(checkIcon);
        button.appendChild(title);
        button.appendChild(subtitle);

        button.addEventListener('click', () => {
            // Deselect any currently selected button
            const currentSelected = bookingModalOptions.querySelector('.selected');
            if (currentSelected) {
                currentSelected.classList.remove('selected');
            }
            // Select the new one
            button.classList.add('selected');
        });

        bookingModalOptions.appendChild(button);
    });

    bookingModalOverlay.classList.remove('hidden');
}


/**
 * Shows the waitlist join confirmation modal.
 * @param {string} startTime - The start time of the slot (ISO format).
 * @param {string} courtId - The ID of the court.
 */
export function showWaitlistModal(startTime, courtId) {
    waitlistJoinBtn.dataset.courtid = courtId;
    waitlistJoinBtn.dataset.starttime = startTime;
    waitlistModalOverlay.classList.remove('hidden');
}

/**
 * Shows the modal to confirm joining an open match.
 * @param {object} matchData - Data about the match.
 * @param {string} matchData.bookingId
 * @param {number} matchData.participants
 * @param {number} matchData.maxParticipants
 * @param {string} matchData.starttime
 * @param {Array<object>} participantsList - Array of participant objects with a 'name' property.
 */
export function showOpenMatchModal(matchData, participantsList) {
    const { bookingId, participants, maxParticipants, starttime } = matchData;
    joinMatchTime.textContent = new Date(starttime).toLocaleString('es-ES');
    joinMatchParticipants.textContent = `${participants}/${maxParticipants}`;
    joinMatchConfirmBtn.dataset.bookingId = bookingId;

    // 1. ARREGLADO: Lógica de renderizado de la lista de participantes
    joinMatchParticipantsList.innerHTML = ''; // Limpiar lista anterior
    if (participantsList && participantsList.length > 0) {
        participantsList.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.name;
            joinMatchParticipantsList.appendChild(li);
        });
    } else {
        // Este mensaje solo aparece si la API devuelve una lista vacía
        joinMatchParticipantsList.innerHTML = '<li>Sé el primero en unirte.</li>';
    }

    joinMatchModalOverlay.classList.remove('hidden');
}


/**
 * Muestra el modal para gestionar una reserva privada del usuario.
 * @param {string} bookingId - El ID de la reserva.
 * @param {string} startTime - La fecha/hora de inicio de la reserva.
 */
export function showMyBookingModal(bookingId, startTime) {
    myBookingModalTime.textContent = new Date(startTime).toLocaleString('es-ES');
    // 2. ARREGLADO: Asegurar que el bookingId se asigna al botón correcto
    myBookingCancelBtn.dataset.bookingId = bookingId;
    myBookingModalOverlay.classList.remove('hidden');
}


/**
 * Muestra el modal para gestionar una partida en la que el usuario participa.
 * @param {object} matchData - Datos de la partida.
 * @param {Array<object>} participantsList - Array de participantes.
 */
export function showMyMatchModal(matchData, participantsList) {
    const { bookingId, startTime, isOwner } = matchData;
    myMatchModalTime.textContent = new Date(startTime).toLocaleString('es-ES');
    
    // 2. ARREGLADO: Asignar bookingId y alternar visibilidad de botones
    myMatchCancelMatchBtn.classList.toggle('hidden', !isOwner);
    myMatchLeaveBtn.classList.toggle('hidden', isOwner);
    myMatchCancelMatchBtn.dataset.bookingId = bookingId;
    myMatchLeaveBtn.dataset.bookingId = bookingId;
    
    myMatchParticipantsList.innerHTML = ''; // Limpiar
    if (participantsList && participantsList.length > 0) {
        participantsList.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.name;
            myMatchParticipantsList.appendChild(li);
        });
    } else {
         myMatchParticipantsList.innerHTML = '<li>No se pudieron cargar los participantes.</li>';
    }
    
    myMatchModalOverlay.classList.remove('hidden');
}

/**
 * Shows the modal for a participant of an open match, allowing them to leave.
 * @param {object} matchData - Data about the match.
 * @param {Array<object>} participantsList - Array of participant objects with a 'name' property.
 */
export function showParticipantMatchModal(matchData, participantsList) {
    const { bookingId, startTime } = matchData;
    myMatchModalTime.textContent = new Date(startTime).toLocaleString('es-ES');
    
    myMatchCancelMatchBtn.classList.add('hidden');
    myMatchLeaveBtn.classList.remove('hidden');
    myMatchLeaveBtn.dataset.bookingId = bookingId;
    
    myMatchParticipantsList.innerHTML = ''; // Clear previous list
    if (participantsList && participantsList.length > 0) {
        participantsList.forEach(p => {
            const li = document.createElement('li');
            li.textContent = p.name;
            myMatchParticipantsList.appendChild(li);
        });
    } else {
        myMatchParticipantsList.innerHTML = '<li>No se pudieron cargar los participantes.</li>';
    }
    
    myMatchModalOverlay.classList.remove('hidden');
}

