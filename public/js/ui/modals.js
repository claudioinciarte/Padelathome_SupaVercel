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

// Join Match Modal Elements
const joinMatchModalOverlay = document.getElementById('join-match-modal-overlay');
const joinMatchDateEl = document.getElementById('join-match-date');
const joinMatchTimeEl = document.getElementById('join-match-time');
const joinMatchParticipantsCountEl = document.getElementById('join-match-participants-count');
const joinMatchParticipantsListEl = document.getElementById('join-match-participants-list');
const joinMatchConfirmBtn = document.getElementById('join-match-confirm-btn');
const joinMatchCancelBtn = document.getElementById('join-match-cancel-btn');
const joinMatchCloseBtnTop = document.getElementById('join-match-close-btn-top');


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
const myMatchCloseBtnTop = document.getElementById('my-match-close-btn-top');

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

    [bookingModalCancelBtn, waitlistCancelBtn, joinMatchCancelBtn, joinMatchCloseBtnTop, myBookingCloseBtn, myMatchCloseBtn, myMatchCloseBtnTop].forEach(btn => btn.addEventListener('click', hideAllModals));

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
 * @param {Array<object>} participantsList - Array of participant objects.
 */
export function showOpenMatchModal(matchData, participantsList) {
    const { bookingId, participants, maxParticipants, starttime } = matchData;

    const date = new Date(starttime);
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

    joinMatchDateEl.textContent = formattedDate;
    joinMatchTimeEl.textContent = formattedTime;
    joinMatchConfirmBtn.dataset.bookingId = bookingId;

    joinMatchParticipantsCountEl.innerHTML = `
        <span class="material-icons-round" style="font-size: 1rem;">groups</span>
        ${participants}/${maxParticipants}
    `;

    joinMatchParticipantsListEl.innerHTML = ''; // Clear previous list

    // Render existing participants
    participantsList.forEach((p, index) => {
        const item = document.createElement('li');
        item.className = 'participant-item';

        const avatar = document.createElement('div');
        const gradientClass = `avatar-gradient-${(index % 4) + 1}`;
        avatar.className = `participant-avatar ${gradientClass}`;
        avatar.textContent = getInitials(p.name);

        const name = document.createElement('span');
        name.className = 'participant-name';
        name.textContent = p.name;

        const role = document.createElement('span');
        role.className = 'participant-role';
        if (p.is_owner) { // Assuming an is_owner flag
            role.textContent = 'Organizador';
        }

        item.appendChild(avatar);
        item.appendChild(name);
        if (p.is_owner) {
            item.appendChild(role);
        }
        joinMatchParticipantsListEl.appendChild(item);
    });

    // Render placeholder for available slots
    const availableSlots = maxParticipants - participants;
    for (let i = 0; i < availableSlots; i++) {
        const placeholder = document.createElement('li');
        placeholder.className = 'participant-placeholder';

        const avatar = document.createElement('div');
        avatar.className = 'participant-avatar';
        avatar.innerHTML = `<span class="material-icons-round" style="font-size: 1rem;">add</span>`;

        const name = document.createElement('span');
        name.className = 'participant-name';
        name.textContent = 'Disponible';

        placeholder.appendChild(avatar);
        placeholder.appendChild(name);
        joinMatchParticipantsListEl.appendChild(placeholder);
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
 * Generates initials from a user's name.
 * @param {string} name - The full name.
 * @returns {string} - The initials (e.g., "JL").
 */
function getInitials(name) {
    if (!name) return '';
    const nameParts = name.trim().split(' ');
    if (nameParts.length > 1) {
        return nameParts[0].charAt(0).toUpperCase() + nameParts[nameParts.length - 1].charAt(0).toUpperCase();
    } else if (nameParts.length === 1 && nameParts[0].length > 1) {
        return nameParts[0].substring(0, 2).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
}

/**
 * Shows the modal for managing a match the user is part of.
 * @param {object} matchData - Data about the match.
 * @param {Array<object>} participantsList - Array of participant objects.
 */
export function showMyMatchModal(matchData, participantsList) {
    const { bookingId, startTime, isOwner } = matchData;
    
    const date = new Date(startTime);
    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear()}`;
    const formattedTime = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    myMatchModalTime.innerHTML = `${formattedDate} <span class="date-separator">|</span> ${formattedTime}`;

    myMatchCancelMatchBtn.classList.toggle('hidden', !isOwner);
    myMatchLeaveBtn.classList.toggle('hidden', isOwner);
    myMatchCancelMatchBtn.dataset.bookingId = bookingId;
    myMatchLeaveBtn.dataset.bookingId = bookingId;

    myMatchParticipantsList.innerHTML = '';
    if (participantsList && participantsList.length > 0) {
        participantsList.forEach((p, index) => {
            const item = document.createElement('div');
            item.className = 'participant-item';

            const avatar = document.createElement('div');
            const gradientClass = `avatar-gradient-${(index % 4) + 1}`;
            avatar.className = `participant-avatar ${gradientClass}`;
            avatar.textContent = getInitials(p.name);

            const name = document.createElement('span');
            name.className = 'participant-name';
            name.textContent = p.name;

            item.appendChild(avatar);
            item.appendChild(name);
            myMatchParticipantsList.appendChild(item);
        });
    } else {
        myMatchParticipantsList.innerHTML = '<p>No se pudieron cargar los participantes.</p>';
    }

    myMatchModalOverlay.classList.remove('hidden');
}

