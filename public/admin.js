import { fetchApi, authToken } from './js/services/api.js';
import { showNotification } from './js/utils.js';
import * as UserManager from './js/managers/UserManager.js';
import * as BuildingManager from './js/managers/BuildingManager.js';
import * as CourtManager from './js/managers/CourtManager.js';

document.addEventListener('DOMContentLoaded', async () => {
    // --- 1. VERIFICACIÓN DE AUTENTICACIÓN Y ROL ---
    if (!authToken) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const user = await fetchApi('/users/me');
        if (user.role !== 'admin') {
            showNotification('Acceso denegado. No eres administrador.', 'error');
            window.location.href = '/dashboard.html';
            return;
        }
        
        // --- 2. INICIALIZACIÓN DE MÓDULOS ---
        
        document.getElementById('admin-name').textContent = user.name;

        // Inicializar todos los managers
        UserManager.init();
        BuildingManager.init();
        CourtManager.init();

        // Cargar datos y configurar eventos globales
        initializeAdminPanel();

    } catch (error) {
        console.error('Error al inicializar el panel de administración:', error);
        localStorage.removeItem('authToken');
        showNotification('Sesión inválida o error de conexión. Por favor, inicia sesión de nuevo.', 'error');
        window.location.href = '/login.html';
    }
});

function initializeAdminPanel() {
    // Llama a las funciones que cargan datos que no están en los managers
    fetchAndDisplayStats();
    fetchAndDisplaySettings();
    fetchAndDisplayBlockedPeriods();

    // Configura los event listeners globales
    setupGlobalEventListeners();
}

async function fetchAndDisplayStats() {
    try {
        const stats = await fetchApi('/admin/stats');

        document.getElementById('total-bookings').textContent = stats.totalBookings;

        const mostActiveUsersList = document.getElementById('most-active-users');
        mostActiveUsersList.innerHTML = '';
        if (stats.topUsers && stats.topUsers.length > 0) {
            stats.topUsers.forEach(user => {
                const li = document.createElement('li');
                li.textContent = `${user.name} (${user.booking_count} reservas)`;
                mostActiveUsersList.appendChild(li);
            });
        } else {
            mostActiveUsersList.innerHTML = '<li>No hay datos de usuarios activos.</li>';
        }

        const peakHoursList = document.getElementById('peak-hours');
        peakHoursList.innerHTML = '';
        if (stats.peakHours && stats.peakHours.length > 0) {
            stats.peakHours.forEach(hourStat => {
                const li = document.createElement('li');
                li.textContent = `Hora ${hourStat.hour}:00 (${hourStat.count} reservas)`;
                peakHoursList.appendChild(li);
            });
        } else {
            peakHoursList.innerHTML = '<li>No hay datos de horas pico.</li>';
        }
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        document.getElementById('total-bookings').textContent = 'Error';
        document.getElementById('most-active-users').innerHTML = '<li>Error al cargar.</li>';
        document.getElementById('peak-hours').innerHTML = '<li>Error al cargar.</li>';
    }
}

async function fetchAndDisplaySettings() {
    try {
        const settings = await fetchApi('/admin/settings');
        document.getElementById('setting-open-time').value = settings.operating_open_time || '08:00';
        document.getElementById('setting-close-time').value = settings.operating_close_time || '22:00';
        document.getElementById('setting-advance-days').value = settings.booking_advance_days || '7';
        document.getElementById('setting-gap-optimization').checked = settings.enable_booking_gap_optimization === 'true';
    } catch (error) {
        console.error('Error al obtener los ajustes:', error);
        showNotification('No se pudieron cargar los ajustes.', 'error');
    }
}

async function fetchAndDisplayBlockedPeriods() {
    try {
        const blockedPeriods = await fetchApi('/admin/blocked-periods');
        const blocksListContainer = document.getElementById('blocks-list-container');
        blocksListContainer.innerHTML = '';
        const list = document.createElement('ul');
        if (blockedPeriods.length === 0) {
            list.innerHTML = '<li>No hay bloqueos futuros programados.</li>';
        } else {
            blockedPeriods.forEach(block => {
                const item = document.createElement('li');
                item.innerHTML = `<strong>Pista:</strong> ${block.court_name} <br><strong>Desde:</strong> ${new Date(block.start_time).toLocaleString('es-ES')} <br><strong>Hasta:</strong> ${new Date(block.end_time).toLocaleString('es-ES')} <br><strong>Motivo:</strong> ${block.reason || 'N/A'} <button class="delete-block-btn" data-blockid="${block.id}">Eliminar</button>`;
                list.appendChild(item);
            });
        }
        blocksListContainer.appendChild(list);
    } catch (error) {
        console.error('Error al obtener bloqueos:', error);
        document.getElementById('blocks-list-container').innerHTML = '<p class="error-text">Error al cargar los bloqueos.</p>';
    }
}


function setupGlobalEventListeners() {
    const logoutButton = document.getElementById('logout-button');
    const dashboardButton = document.getElementById('dashboard-link');
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    const settingsForm = document.getElementById('settings-form');
    const createBlockForm = document.getElementById('create-block-form');
    const blocksListContainer = document.getElementById('blocks-list-container');

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            window.location.href = '/login.html';
        });
    }

    if (dashboardButton) {
        dashboardButton.addEventListener('click', () => {
            window.location.href = '/dashboard.html';
        });
    }

    tabLinks.forEach(link => {
        link.addEventListener('click', () => {
            const tab = link.dataset.tab;
            tabLinks.forEach(item => item.classList.remove('active'));
            link.classList.add('active');
            tabContents.forEach(content => {
                content.classList.toggle('active', content.id === tab);
            });
        });
    });

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const accordionContent = header.nextElementSibling;
            if (accordionContent) {
                header.classList.toggle('active');
                accordionContent.style.display = accordionContent.style.display === 'block' ? 'none' : 'block';
            }
        });
    });
    
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const settingsToUpdate = {
                operating_open_time: document.getElementById('setting-open-time').value,
                operating_close_time: document.getElementById('setting-close-time').value,
                booking_advance_days: document.getElementById('setting-advance-days').value,
                enable_booking_gap_optimization: document.getElementById('setting-gap-optimization').checked.toString()
            };
            if (!confirm('¿Guardar nuevos ajustes?')) return;
            try {
                await fetchApi('/admin/settings', { method: 'PUT', body: JSON.stringify(settingsToUpdate) });
                showNotification('Ajustes guardados.', 'success');
            } catch (error) {
                showNotification(error.message, 'error');
            }
        });
    }

    if (createBlockForm) {
        createBlockForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            try {
                await fetchApi('/admin/blocked-periods', {
                    method: 'POST',
                    body: JSON.stringify({
                        courtId: document.getElementById('block-court-select').value,
                        startTime: document.getElementById('block-start-time').value,
                        endTime: document.getElementById('block-end-time').value,
                        reason: document.getElementById('block-reason').value
                    })
                });
                showNotification('Bloqueo creado.', 'success');
                createBlockForm.reset();
                fetchAndDisplayBlockedPeriods();
            } catch(error) {
                showNotification(error.message, 'error');
            }
        });
    }
    
    if (blocksListContainer) {
        blocksListContainer.addEventListener('click', async (event) => {
            if (event.target.classList.contains('delete-block-btn')) {
                const blockId = event.target.dataset.blockid;
                if (!confirm(`¿Eliminar bloqueo ID ${blockId}?`)) return;
                try {
                    await fetchApi(`/admin/blocked-periods/${blockId}`, { method: 'DELETE' });
                    showNotification('Bloqueo eliminado.', 'success');
                    fetchAndDisplayBlockedPeriods();
                } catch(error) {
                    showNotification(error.message, 'error');
                }
            }
        });
    }
}