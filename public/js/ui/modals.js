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
const waitlistCloseIconBtn = document.getElementById('waitlist-close-icon-btn');
const waitlistCountText = document.getElementById('waitlist-count-text');

// Already on Waitlist Modal Elements
const alreadyOnWaitlistModalOverlay = document.getElementById('already-on-waitlist-modal-overlay');
const withdrawWaitlistBtn = document.getElementById('withdraw-waitlist-btn');
const stayOnWaitlistBtn = document.getElementById('stay-on-waitlist-btn');
const alreadyListedCloseIconBtn = document.getElementById('already-listed-close-icon-btn');

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
const myBookingCloseIconBtn = document.getElementById('my-booking-close-icon-btn');

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
    alreadyOnWaitlistModalOverlay.classList.add('hidden');
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
    [bookingModalOverlay, waitlistModalOverlay, alreadyOnWaitlistModalOverlay, joinMatchModalOverlay, myBookingModalOverlay, myMatchModalOverlay].forEach(overlay => {
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) {
                hideAllModals();
            }
        });
    });

    [bookingModalCancelBtn, waitlistCancelBtn, waitlistCloseIconBtn, stayOnWaitlistBtn, alreadyListedCloseIconBtn, joinMatchCancelBtn, joinMatchCloseBtnTop, myBookingCloseBtn, myBookingCloseIconBtn, myMatchCloseBtn, myMatchCloseBtnTop].forEach(btn => {
        if (btn) btn.addEventListener('click', hideAllModals);
    });

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
             const { courtid, starttime, duration } = waitlistJoinBtn.dataset;
             // Pass all required data to the handler
             handlers.onJoinWaitlist({ courtId: courtid, startTime: starttime, duration: duration });
        });
    }

    if (handlers.onWithdrawWaitlist) {
        withdrawWaitlistBtn.addEventListener('click', () => {
            const { courtid, starttime } = withdrawWaitlistBtn.dataset;
            handlers.onWithdrawWaitlist({ courtId: courtid, startTime: starttime });
        });
    }
    
    if (handlers.onJoinMatch) {
        joinMatchConfirmBtn.addEventListener('click', () => {
            const { bookingId } = joinMatchConfirmBtn.dataset;
            handlers.onJoinMatch({ bookingId });
        });
    }
    
    if (handlers.onCancelBooking) {
        myBookingCancelBtn.addEventListener('click', () => {
            const { bookingId } = myBookingCancelBtn.dataset;
            handlers.onCancelBooking(bookingId);
        });
        myMatchCancelMatchBtn.addEventListener('click', () => {
            const { bookingId } = myMatchCancelMatchBtn.dataset;
            handlers.onCancelBooking(bookingId);
        });
    }
    
    if (handlers.onLeaveMatch) {
        myMatchLeaveBtn.addEventListener('click', () => {
            const { bookingId } = myMatchLeaveBtn.dataset;
            handlers.onLeaveMatch(bookingId);
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
 * @param {object} data - Data for the waitlist slot.
 * @param {string} data.startTime - The start time of the slot (ISO format).
 * @param {string} data.courtId - The ID of the court.
 * @param {number} data.duration - The duration of the slot in minutes.
 */
export function showWaitlistModal(data) {
    const { startTime, courtId, duration, waitlistCount } = data;
    waitlistJoinBtn.dataset.courtid = courtId;
    waitlistJoinBtn.dataset.starttime = startTime;
    // Store duration so the handler can retrieve it
    if (duration) {
        waitlistJoinBtn.dataset.duration = duration;
    } else {
        // Clear it if not provided to avoid using stale data
        delete waitlistJoinBtn.dataset.duration;
    }

    // Update dynamic count
    if (waitlistCountText) {
        const count = waitlistCount || 0;
        const peopleText = count === 1 ? 'persona' : 'personas';
        waitlistCountText.textContent = `Hay ${count} ${peopleText} en lista de espera`;
    }

    waitlistModalOverlay.classList.remove('hidden');
}

/**
 * Shows the modal indicating the user is already on a waitlist.
 * @param {object} data - Data for the waitlist slot.
 * @param {string} data.startTime - The start time of the slot (ISO format).
 * @param {string} data.courtId - The ID of the court.
 */
export function showAlreadyOnWaitlistModal(data) {
    const { startTime, courtId } = data;
    withdrawWaitlistBtn.dataset.courtid = courtId;
    withdrawWaitlistBtn.dataset.starttime = startTime;
    alreadyOnWaitlistModalOverlay.classList.remove('hidden');
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
 * Shows the modal for managing a match the user is part of, using the new design.
 * @param {object} matchData - Data about the match.
 * @param {boolean} matchData.isOwner - Whether the current user is the owner of the match.
 * @param {string} matchData.bookingId - The ID of the booking.
 * @param {string} matchData.startTime - The start time of the match.
 * @param {Array<object>} participantsList - Array of participant objects.
 * @param {string} participantsList[].name - The name of the participant.
 * @param {boolean} participantsList[].is_owner - Whether the participant is the owner.
 */
export function showMyMatchModal(matchData, participantsList) {
    const { bookingId, startTime, isOwner } = matchData;

    // --- 1. Update Time Display ---
    const date = new Date(startTime);
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long' };
    let formattedDate = new Intl.DateTimeFormat('es-ES', dateOptions).format(date);
    // Capitalize the first letter for consistency
    formattedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
    const formattedTime = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });

    // Using a separator as it's more robust against different text lengths than a <br>
    myMatchModalTime.innerHTML = `${formattedDate} <span class="date-separator" style="color: #9ca3af; margin: 0 0.25rem;">•</span> ${formattedTime}`;

    // --- 2. Update Buttons based on ownership ---
    myMatchCancelMatchBtn.classList.toggle('hidden', !isOwner);
    myMatchLeaveBtn.classList.toggle('hidden', isOwner);

    // Assign bookingId to buttons for the handlers
    myMatchCancelMatchBtn.dataset.bookingId = bookingId;
    myMatchLeaveBtn.dataset.bookingId = bookingId;

    // --- 3. Render Participants List ---
    myMatchParticipantsList.innerHTML = ''; // Clear previous list
    if (participantsList && participantsList.length > 0) {
        participantsList.forEach((p, index) => {
            const item = document.createElement('div');
            item.className = 'participant-item';

            // Avatar with cycling gradient
            const avatar = document.createElement('div');
            const gradientClass = `avatar-gradient-${(index % 4) + 1}`;
            avatar.className = `participant-avatar ${gradientClass}`;
            avatar.textContent = getInitials(p.name);

            // Name
            const name = document.createElement('span');
            name.className = 'participant-name';
            name.textContent = p.name;

            item.appendChild(avatar);
            item.appendChild(name);

            // Role Badge (if participant is the owner)
            if (p.is_owner) {
                const role = document.createElement('span');
                role.className = 'participant-role';
                role.textContent = 'Organizador';
                item.appendChild(role);
            }

            myMatchParticipantsList.appendChild(item);
        });
    } else {
        myMatchParticipantsList.innerHTML = '<p>No se encontraron participantes.</p>';
    }

    // --- 4. Show the modal ---
    myMatchModalOverlay.classList.remove('hidden');
}

