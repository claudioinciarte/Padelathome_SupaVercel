import { fetchApi, authToken } from './js/services/api.js';
import { showNotification } from './js/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. CONFIGURACIÓN INICIAL Y ELEMENTOS DEL DOM ---
    if (!authToken) {
        showNotification('Debes iniciar sesión para ver esta página.', 'error');
        window.location.href = '/login.html';
        return;
    }

    const adminNameSpan = document.getElementById('admin-name');
    const logoutButton = document.getElementById('logout-button');

    // Tabs
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    // Acordeones
    const accordionHeaders = document.querySelectorAll('.accordion-header');
    // Usuarios
    const userTableBody = document.getElementById('user-table-body');
    const inviteUserForm = document.getElementById('invite-user-form');
    const inviteBuildingSelect = document.getElementById('invite-building');
    // Pistas
    const courtForm = document.getElementById('court-form');
    const courtFormTitle = document.getElementById('court-form-title');
    const courtIdInput = document.getElementById('court-id');
    const courtNameInput = document.getElementById('court-name');
    const courtDescriptionInput = document.getElementById('court-description');
    const courtIsActiveDiv = document.getElementById('court-active-div');
    const courtIsActiveCheckbox = document.getElementById('court-is-active');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const courtsListContainer = document.getElementById('courts-list-container');
    // Bloqueos
    const createBlockForm = document.getElementById('create-block-form');
    const blockCourtSelect = document.getElementById('block-court-select');
    const blockStartTimeInput = document.getElementById('block-start-time');
    const blockEndTimeInput = document.getElementById('block-end-time');
    const blockReasonInput = document.getElementById('block-reason');
    const blocksListContainer = document.getElementById('blocks-list-container');
    // Edificios
    const buildingForm = document.getElementById('building-form');
    const buildingFormTitle = document.getElementById('building-form-title');
    const buildingIdInput = document.getElementById('building-id');
    const buildingAddressInput = document.getElementById('building-address');
    const buildingDescriptionInput = document.getElementById('building-description');
    const cancelBuildingEditBtn = document.getElementById('cancel-building-edit-btn');
    const buildingsListContainer = document.getElementById('buildings-list-container');
    // Ajustes
    const settingsForm = document.getElementById('settings-form');
    const openTimeInput = document.getElementById('setting-open-time');
    const closeTimeInput = document.getElementById('setting-close-time');
    const advanceDaysInput = document.getElementById('setting-advance-days');
    const gapOptimizationCheckbox = document.getElementById('setting-gap-optimization');

    // --- 2. DATOS GLOBALES ---
    let allCourtsData = [];
    let allBuildings = [];

    // --- 3. FUNCIONES PRINCIPALES ---

    const initializeAdminPanel = async () => {
        try {
            const user = await fetchApi('/users/me');
            if (user.role !== 'admin') {
                showNotification('Acceso denegado. No eres administrador.', 'error');
                window.location.href = '/dashboard.html';
                return;
            }
            adminNameSpan.textContent = user.name;
            // Cargar todos los datos del panel
            await Promise.all([
                fetchAndDisplayUsers(),
                fetchAndDisplayCourts(),
                fetchAndDisplayBuildings(),
                fetchAndDisplayBlockedPeriods(),
                fetchAndDisplaySettings(),
                fetchAndDisplayStats()
            ]);
        } catch (error) {
            console.error(error);
            localStorage.removeItem('authToken');
            showNotification('Sesión inválida. Por favor, inicia sesión de nuevo.', 'error');
            window.location.href = '/login.html';
        }
    };

    const fetchAndDisplayStats = async () => {
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
        }
    };

    const fetchAndDisplayUsers = async () => {
        try {
            const users = await fetchApi('/admin/users');
            userTableBody.innerHTML = '';
            users.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.id}</td>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.account_status}</td>
                    <td>${user.role}</td>
                    <td>
                        ${user.account_status === 'pending_approval' ? `<button class="approve-btn" data-userid="${user.id}">Aprobar</button>` : ''}
                        ${user.account_status === 'active' ? `<button class="deactivate-btn" data-userid="${user.id}">Desactivar</button>` : ''}
                        ${user.account_status === 'inactive' ? `<button class="activate-btn" data-userid="${user.id}">Activar</button>` : ''}
                    </td>
                    <td>
                        <button class="reset-password-btn" data-userid="${user.id}">Restablecer Pass</button>
                        <button class="toggle-role-btn" data-userid="${user.id}" data-currentrole="${user.role}">
                            ${user.role === 'admin' ? 'Hacer User' : 'Hacer Admin'}
                        </button>
                    </td>`;
                userTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Error al obtener usuarios:', error);
            userTableBody.innerHTML = '<tr><td colspan="7" style="color:red;">Error al cargar los usuarios.</td></tr>';
        }
    };

    const fetchAndDisplayCourts = async () => {
        try {
            const courts = await fetchApi('/courts');
            allCourtsData = courts;

            blockCourtSelect.innerHTML = '';
            courts.forEach(court => {
                if (court.is_active) {
                    const option = document.createElement('option');
                    option.value = court.id;
                    option.textContent = court.name;
                    blockCourtSelect.appendChild(option);
                }
            });

            courtsListContainer.innerHTML = '';
            const courtList = document.createElement('ul');
            if (courts.length === 0) {
                courtList.innerHTML = '<li>No hay pistas creadas en el sistema.</li>';
            } else {
                courts.forEach(court => {
                    const listItem = document.createElement('li');
                    listItem.innerHTML = `<strong>${court.name}</strong> (ID: ${court.id}) - Estado: ${court.is_active ? '<strong class="success-text">Activa</strong>' : '<span class="error-text">Inactiva</span>'}<br><em>${court.description || 'Sin descripción.'}</em><br><button class="edit-court-btn" data-courtid="${court.id}">Editar</button>`;
                    courtList.appendChild(listItem);
                });
            }
            courtsListContainer.appendChild(courtList);
        } catch (error) {
            console.error('Error al obtener pistas:', error);
            courtsListContainer.innerHTML = '<p class="error-text">Error al cargar la información de las pistas.</p>';
        }
    };

    const fetchAndDisplayBuildings = async () => {
        try {
            const buildings = await fetchApi('/admin/buildings');
            allBuildings = buildings;

            inviteBuildingSelect.innerHTML = '';
            if (buildings.length > 0) {
                buildings.forEach(building => {
                    const option = document.createElement('option');
                    option.value = building.id;
                    option.textContent = building.address;
                    inviteBuildingSelect.appendChild(option);
                });
            }

            buildingsListContainer.innerHTML = '';
            const list = document.createElement('ul');
            if (buildings.length === 0) {
                list.innerHTML = '<li>No hay edificios creados.</li>';
            } else {
                buildings.forEach(building => {
                    const item = document.createElement('li');
                    item.innerHTML = `<strong>${building.address}</strong> (ID: ${building.id})<br><em>${building.description || 'Sin descripción'}</em><br><button class="edit-building-btn" data-buildingid="${building.id}">Editar</button><button class="delete-building-btn" data-buildingid="${building.id}">Eliminar</button>`;
                    list.appendChild(item);
                });
            }
            buildingsListContainer.appendChild(list);
        } catch (error) {
            console.error('Error al obtener edificios:', error);
            buildingsListContainer.innerHTML = '<p class="error-text">Error al cargar los edificios.</p>';
        }
    };

    const fetchAndDisplayBlockedPeriods = async () => {
        try {
            const blockedPeriods = await fetchApi('/admin/blocked-periods');
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
            blocksListContainer.innerHTML = '<p class="error-text">Error al cargar los bloqueos.</p>';
        }
    };

    const fetchAndDisplaySettings = async () => {
        try {
            const settings = await fetchApi('/admin/settings');
            openTimeInput.value = settings.operating_open_time || '08:00';
            closeTimeInput.value = settings.operating_close_time || '22:00';
            advanceDaysInput.value = settings.booking_advance_days || '7';
            gapOptimizationCheckbox.checked = settings.enable_booking_gap_optimization === 'true';
        } catch (error) {
            console.error('Error al obtener los ajustes:', error);
            showNotification('No se pudieron cargar los ajustes.', 'error');
        }
    };

    const resetCourtForm = () => {
        courtFormTitle.textContent = 'Crear Nueva Pista';
        courtForm.reset();
        courtIdInput.value = '';
        courtIsActiveDiv.style.display = 'none';
        cancelEditBtn.style.display = 'none';
    };

    const resetBuildingForm = () => {
        buildingFormTitle.textContent = 'Añadir Nuevo Edificio';
        buildingForm.reset();
        buildingIdInput.value = '';
        cancelBuildingEditBtn.style.display = 'none';
    };

    const handleUserAction = async (event) => {
        const target = event.target;
        const userId = target.dataset.userid;
        if (!userId) return;
        let actionUrl = '';
        let actionMethod = 'PUT';
        let actionPayload = {};
        let successMsg = 'Acción completada.';

        if (target.classList.contains('approve-btn')) {
            actionUrl = `/admin/users/${userId}/approve`;
            successMsg = 'Usuario aprobado.';
        } else if (target.classList.contains('deactivate-btn')) {
            actionUrl = `/admin/users/${userId}/status`;
            actionPayload = { status: 'inactive' };
            successMsg = 'Usuario desactivado.';
        } else if (target.classList.contains('activate-btn')) {
            actionUrl = `/admin/users/${userId}/status`;
            actionPayload = { status: 'active' };
            successMsg = 'Usuario activado.';
        } else if (target.classList.contains('reset-password-btn')) {
            actionUrl = `/admin/users/${userId}/reset-password`;
            actionMethod = 'POST'; // Nota: En la API original era PUT para reset-password de usuario, pero POST para trigger desde admin? Reviso routes... adminRoutes dice: PUT /users/:userId/reset-password
            // Re-checking adminRoutes.js: router.put('/users/:userId/reset-password', protect, isAdmin, resetUserPassword);
            actionMethod = 'PUT';
            if (!confirm('¿Enviar correo de restablecimiento de contraseña?')) return;
             successMsg = 'Correo de restablecimiento enviado.';
        } else if (target.classList.contains('toggle-role-btn')) {
            const currentRole = target.dataset.currentrole;
            const newRole = currentRole === 'admin' ? 'user' : 'admin';
            actionUrl = `/admin/users/${userId}/role`;
            actionPayload = { role: newRole };
            if (!confirm(`¿Cambiar rol a ${newRole}?`)) return;
            successMsg = `Rol cambiado a ${newRole}.`;
        } else {
            return;
        }
        try {
            const options = { method: actionMethod };
            if (Object.keys(actionPayload).length > 0) {
                options.body = JSON.stringify(actionPayload);
            }
            await fetchApi(actionUrl, options);
            showNotification(successMsg, 'success');
            fetchAndDisplayUsers();
        } catch(error) {
            showNotification(error.message, 'error');
        }
    };

    // --- 5. LÓGICA DE INICIO Y ASIGNACIÓN DE EVENTOS ---

    initializeAdminPanel();

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
    });

    // Lógica para el cambio de pestañas
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

    // Lógica para los acordeones
    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const accordionContent = header.nextElementSibling;
            header.classList.toggle('active');
            accordionContent.style.display = accordionContent.style.display === 'block' ? 'none' : 'block';
        });
    });

    // Delegación de eventos
    userTableBody.addEventListener('click', handleUserAction);

    courtsListContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('edit-court-btn')) {
            const courtId = event.target.dataset.courtid;
            const courtToEdit = allCourtsData.find(c => c.id == courtId);
            if (courtToEdit) {
                courtFormTitle.textContent = 'Editar Pista';
                courtIdInput.value = courtToEdit.id;
                courtNameInput.value = courtToEdit.name;
                courtDescriptionInput.value = courtToEdit.description;
                courtIsActiveDiv.style.display = 'block';
                courtIsActiveCheckbox.checked = courtToEdit.is_active;
                cancelEditBtn.style.display = 'inline-block';
                // Abrir acordeón si está cerrado
                const accordionContent = document.getElementById('court-management').parentElement;
                accordionContent.style.display = 'block';
                accordionContent.previousElementSibling.classList.add('active');

                courtForm.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    buildingsListContainer.addEventListener('click', async (event) => {
        const target = event.target;
        const buildingId = target.dataset.buildingid;
        if (!buildingId) return;

        if (target.classList.contains('edit-building-btn')) {
            const buildingToEdit = allBuildings.find(b => b.id == buildingId);
            if (buildingToEdit) {
                buildingFormTitle.textContent = 'Editar Edificio';
                buildingIdInput.value = buildingToEdit.id;
                buildingAddressInput.value = buildingToEdit.address;
                buildingDescriptionInput.value = buildingToEdit.description;
                cancelBuildingEditBtn.style.display = 'inline-block';
                buildingForm.scrollIntoView({ behavior: 'smooth' });
            }
        } else if (target.classList.contains('delete-building-btn')) {
            if (!confirm(`¿Eliminar edificio ID ${buildingId}?`)) return;
            try {
                await fetchApi(`/admin/buildings/${buildingId}`, { method: 'DELETE' });
                showNotification('Edificio eliminado.', 'success');
                fetchAndDisplayBuildings();
            } catch (error) {
                showNotification(error.message, 'error');
            }
        }
    });

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

    // Listeners de formularios
    inviteUserForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = {
            name: document.getElementById('invite-name').value,
            email: document.getElementById('invite-email').value,
            building_id: document.getElementById('invite-building').value,
            floor: document.getElementById('invite-floor').value,
            door: document.getElementById('invite-door').value,
        };
        try {
            await fetchApi('/admin/users/invite', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            showNotification('Invitación enviada.', 'success');
            inviteUserForm.reset();
            fetchAndDisplayUsers();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    courtForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const courtId = courtIdInput.value;
        const isEditing = !!courtId;
        const endpoint = isEditing ? `/courts/${courtId}` : `/courts`; // Nota: Para crear es /courts, no /admin/courts (según courtRoutes.js) pero espera, courtRoutes.js define POST / (admin only).
        // Revisando courtRoutes.js:
        // router.post('/', protect, isAdmin, createCourt);
        // router.put('/:courtId', protect, isAdmin, updateCourt);
        // Correcto, es /api/courts.

        const method = isEditing ? 'PUT' : 'POST';
        const body = {
            name: courtNameInput.value,
            description: courtDescriptionInput.value,
        };
        if (isEditing) { body.is_active = courtIsActiveCheckbox.checked; }
        try {
            await fetchApi(endpoint, { method, body: JSON.stringify(body) });
            showNotification(`Pista ${isEditing ? 'actualizada' : 'creada'}.`, 'success');
            resetCourtForm();
            fetchAndDisplayCourts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    createBlockForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await fetchApi('/admin/blocked-periods', {
                method: 'POST',
                body: JSON.stringify({
                    courtId: blockCourtSelect.value,
                    startTime: blockStartTimeInput.value,
                    endTime: blockEndTimeInput.value,
                    reason: blockReasonInput.value
                })
            });
            showNotification('Bloqueo creado.', 'success');
            createBlockForm.reset();
            fetchAndDisplayBlockedPeriods();
        } catch(error) {
            showNotification(error.message, 'error');
        }
    });

    buildingForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const buildingId = buildingIdInput.value;
        const isEditing = !!buildingId;
        const endpoint = isEditing ? `/admin/buildings/${buildingId}` : `/admin/buildings`;
        const method = isEditing ? 'PUT' : 'POST';
        try {
            await fetchApi(endpoint, {
                method,
                body: JSON.stringify({
                    address: buildingAddressInput.value,
                    description: buildingDescriptionInput.value
                })
            });
            showNotification(`Edificio ${isEditing ? 'actualizado' : 'creado'}.`, 'success');
            resetBuildingForm();
            fetchAndDisplayBuildings();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    settingsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const settingsToUpdate = {
            operating_open_time: openTimeInput.value,
            operating_close_time: closeTimeInput.value,
            booking_advance_days: advanceDaysInput.value,
            enable_booking_gap_optimization: gapOptimizationCheckbox.checked.toString()
        };
        if (!confirm('¿Guardar nuevos ajustes?')) return;
        try {
            await fetchApi('/admin/settings', { method: 'PUT', body: JSON.stringify(settingsToUpdate) });
            showNotification('Ajustes guardados.', 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });

    // Listeners para botones de cancelar edición
    cancelEditBtn.addEventListener('click', resetCourtForm);
    cancelBuildingEditBtn.addEventListener('click', resetBuildingForm);
});
