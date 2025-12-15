import { fetchApi, authToken } from './js/services/api.js';
import { showNotification } from './js/utils.js';

// 1. Obtenemos referencias a los elementos del HTML
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const registerLink = document.getElementById('register-link-container');

// Comprobar si el registro público está permitido
const checkRegistrationStatus = async () => {
    try {
        // Usamos fetchApi, pero ojo, este endpoint es público, auth header es opcional/ignorada
        // fetchApi maneja authToken automáticamente si existe, no pasa nada si se envía
        const data = await fetchApi('/auth/registration-status');
        if (data && data.allowRegistration === true) {
            registerLink.style.display = 'block';
        } else {
            registerLink.style.display = 'none';
        }
    } catch (e) {
        console.error("No se pudo verificar el estado del registro.", e);
        registerLink.style.display = 'none';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    // Si ya hay token, redirigir al dashboard
    if (authToken) {
        window.location.href = '/dashboard.html';
        return;
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;

        errorMessage.textContent = '';

        try {
            const data = await fetchApi('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });

            // Guardamos el token
            localStorage.setItem('authToken', data.token);
            // Redirigimos
            window.location.href = '/dashboard.html';

        } catch (error) {
            errorMessage.textContent = error.message;
        }
    });

    checkRegistrationStatus();
});
