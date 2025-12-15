import { fetchApi } from '../services/api.js';
import { showNotification } from '../utils.js';

const userTableBody = document.getElementById('user-table-body');
const inviteUserForm = document.getElementById('invite-user-form');

async function fetchAndRenderUsers() {
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
                    <button class="delete-user-btn" data-userid="${user.id}">Eliminar</button>
                </td>`;
            userTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        userTableBody.innerHTML = '<tr><td colspan="7" style="color:red;">Error al cargar los usuarios.</td></tr>';
    }
}

async function handleUserAction(event) {
    const target = event.target;
    const userId = target.dataset.userid;
    if (!userId) return;

    let actionUrl = '';
    let actionMethod = 'PUT';
    let body = null;
    let successMsg = 'Acción completada.';
    let needsConfirmation = false;
    let confirmationMessage = '¿Estás seguro?';

    if (target.classList.contains('approve-btn')) {
        actionUrl = `/admin/users/${userId}/approve`;
        successMsg = 'Usuario aprobado.';
    } else if (target.classList.contains('deactivate-btn')) {
        actionUrl = `/admin/users/${userId}/status`;
        body = { status: 'inactive' };
        successMsg = 'Usuario desactivado.';
    } else if (target.classList.contains('activate-btn')) {
        actionUrl = `/admin/users/${userId}/status`;
        body = { status: 'active' };
        successMsg = 'Usuario activado.';
    } else if (target.classList.contains('reset-password-btn')) {
        actionUrl = `/admin/users/${userId}/reset-password`;
        actionMethod = 'PUT';
        needsConfirmation = true;
        confirmationMessage = '¿Enviar correo de restablecimiento de contraseña?';
        successMsg = 'Correo de restablecimiento enviado.';
    } else if (target.classList.contains('toggle-role-btn')) {
        const currentRole = target.dataset.currentrole;
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        actionUrl = `/admin/users/${userId}/role`;
        body = { role: newRole };
        needsConfirmation = true;
        confirmationMessage = `¿Cambiar rol a ${newRole}?`;
        successMsg = `Rol cambiado a ${newRole}.`;
    } else if (target.classList.contains('delete-user-btn')) {
        actionUrl = `/admin/users/${userId}`;
        actionMethod = 'DELETE';
        needsConfirmation = true;
        confirmationMessage = `¿Eliminar usuario ID ${userId}? Esta acción es permanente.`;
        successMsg = 'Usuario eliminado.';
    } else {
        return;
    }

    if (needsConfirmation && !confirm(confirmationMessage)) {
        return;
    }

    try {
        const options = { method: actionMethod };
        if (body) {
            options.body = JSON.stringify(body);
        }
        await fetchApi(actionUrl, options);
        showNotification(successMsg, 'success');
        fetchAndRenderUsers();
    } catch(error) {
        showNotification(error.message, 'error');
    }
}

async function handleInviteSubmit(event) {
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
        fetchAndRenderUsers();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

export function init() {
    if (!userTableBody || !inviteUserForm) {
        console.warn('Elementos del DOM para UserManager no encontrados.');
        return;
    }
    
    fetchAndRenderUsers();
    
    inviteUserForm.addEventListener('submit', handleInviteSubmit);
    
    userTableBody.addEventListener('click', handleUserAction);
}
