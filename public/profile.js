import { fetchApi, authToken } from './js/services/api.js';
import { showNotification } from './js/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    if (!authToken) {
        window.location.href = '/login.html';
        return;
    }

    // --- DOM Element References ---
    const profileForm = document.getElementById('profile-form');
    const passwordForm = document.getElementById('password-form');

    // Profile fields
    const emailInput = document.getElementById('email');
    const fullNameInput = document.getElementById('full-name');
    const addressInput = document.getElementById('address');
    const floorInput = document.getElementById('floor');
    const doorInput = document.getElementById('door');
    const phoneInput = document.getElementById('phone');

    // Password fields
    const currentPasswordInput = document.getElementById('current-password');
    const newPasswordInput = document.getElementById('new-password');
    const confirmPasswordInput = document.getElementById('confirm-password');

    // Buttons
    const updateProfileBtn = document.getElementById('update-profile-btn');
    const changePasswordBtn = document.getElementById('change-password-btn');

    // User display elements
    const userInitialsAvatar = document.getElementById('user-initials-avatar');
    const userFullNameDisplay = document.getElementById('user-full-name-display');

    const getInitials = (name) => {
        if (!name) return '';
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    };

    const loadUserProfile = async () => {
        try {
            const user = await fetchApi('/users/me');

            emailInput.value = user.email;
            fullNameInput.value = user.name;
            addressInput.value = user.building_address || 'N/A';
            floorInput.value = user.floor || '';
            doorInput.value = user.door || '';
            phoneInput.value = user.phone_number || '';

            userFullNameDisplay.textContent = user.name;
            userInitialsAvatar.textContent = getInitials(user.name);

        } catch (error) {
            showNotification(error.message, 'error');
        }
    };

    updateProfileBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            const updatedUser = await fetchApi('/users/me', {
                method: 'PUT',
                body: JSON.stringify({
                    name: fullNameInput.value,
                    building_address: addressInput.value,
                    floor: floorInput.value,
                    door: doorInput.value,
                    phone_number: phoneInput.value
                })
            });

            showNotification('Perfil actualizado con éxito.', 'success');

            userFullNameDisplay.textContent = fullNameInput.value;
            userInitialsAvatar.textContent = getInitials(fullNameInput.value);

        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    changePasswordBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        if (newPasswordInput.value !== confirmPasswordInput.value) {
            showNotification('Las contraseñas nuevas no coinciden.', 'error');
            return;
        }

        if (!newPasswordInput.value) {
            showNotification('La nueva contraseña no puede estar vacía.', 'error');
            return;
        }

        try {
            const result = await fetchApi('/users/change-password', {
                method: 'PUT',
                body: JSON.stringify({
                    oldPassword: currentPasswordInput.value,
                    newPassword: newPasswordInput.value
                })
            });

            showNotification(result.message, 'success');
            passwordForm.reset();

        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    loadUserProfile();
});
