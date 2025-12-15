import { fetchApi, authToken } from './js/services/api.js';
import { showNotification } from './js/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Redirigir si no está logueado
    if (!authToken) {
        window.location.href = '/login.html';
        return;
    }

    // --- Referencias a elementos del DOM ---
    const dashboardBtn = document.getElementById('dashboard-btn');
    // Formulario de perfil
    const profileForm = document.getElementById('profile-form');
    const emailInput = document.getElementById('profile-email');
    const buildingInput = document.getElementById('profile-building');
    const nameInput = document.getElementById('profile-name');
    const floorInput = document.getElementById('profile-floor');
    const doorInput = document.getElementById('profile-door');
    const phoneInput = document.getElementById('profile-phone');
    const profileMessage = document.getElementById('profile-message');
    // Formulario de contraseña
    const passwordForm = document.getElementById('password-form');
    const oldPasswordInput = document.getElementById('old-password');
    const newPasswordInput = document.getElementById('new-password');
    const passwordMessage = document.getElementById('password-message');

    // --- Función para cargar los datos del usuario ---
    const loadUserProfile = async () => {
        try {
            const user = await fetchApi('/users/me');
            // Rellenamos el formulario
            emailInput.value = user.email;
            buildingInput.value = user.building_address || 'N/A';
            nameInput.value = user.name;
            floorInput.value = user.floor || '';
            doorInput.value = user.door || '';
            phoneInput.value = user.phone_number || '';
        } catch (error) {
            profileMessage.textContent = error.message;
            profileMessage.className = 'error-text';
        }
    };

    // --- Listeners de los formularios ---

    // 1. Actualizar Información Personal
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        profileMessage.textContent = '';
        try {
            const data = await fetchApi('/users/me', {
                method: 'PUT',
                body: JSON.stringify({
                    name: nameInput.value,
                    floor: floorInput.value,
                    door: doorInput.value,
                    phone_number: phoneInput.value
                })
            });

            showNotification(data.message, 'success');
            profileMessage.textContent = data.message;
            profileMessage.className = 'success-text';
        } catch (error) {
            profileMessage.textContent = error.message;
            profileMessage.className = 'error-text';
        }
    });

    // 2. Cambiar Contraseña
    passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        passwordMessage.textContent = '';
        try {
            const data = await fetchApi('/users/change-password', {
                method: 'PUT',
                body: JSON.stringify({
                    oldPassword: oldPasswordInput.value,
                    newPassword: newPasswordInput.value
                })
            });

            showNotification(data.message, 'success');
            passwordMessage.textContent = data.message;
            passwordMessage.className = 'success-text';
            passwordForm.reset();
        } catch (error) {
            passwordMessage.textContent = error.message;
            passwordMessage.className = 'error-text';
        }
    });

    // Listener del botón de "Volver"
    dashboardBtn.addEventListener('click', () => {
        window.location.href = '/dashboard.html';
    });

    // --- Carga inicial de datos ---
    loadUserProfile();
});
