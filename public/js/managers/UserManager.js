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
            row.className = "hover:bg-slate-50 transition-colors";

            // Status Badge Logic
            let statusClass = 'bg-slate-100 text-slate-800';
            let statusLabel = user.account_status;

            if (user.account_status === 'active') {
                statusClass = 'bg-green-100 text-green-800 border border-green-200';
                statusLabel = 'Activo';
            } else if (user.account_status === 'inactive') {
                statusClass = 'bg-red-100 text-red-800 border border-red-200';
                statusLabel = 'Inactivo';
            } else if (user.account_status === 'pending_approval') {
                statusClass = 'bg-amber-100 text-amber-800 border border-amber-200';
                statusLabel = 'Pendiente';
            }

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                    #${user.id}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                    <div class="flex items-center">
                        <div class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold mr-3">
                            ${user.name.charAt(0).toUpperCase()}
                        </div>
                        ${user.name}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    ${user.email}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">
                        ${statusLabel}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500 capitalize">
                    ${user.role}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex gap-2">
                        ${user.account_status === 'pending_approval' ?
                            `<button class="approve-btn inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm transition-colors" data-userid="${user.id}">
                                <span class="material-icons-round text-sm mr-1 pointer-events-none">check</span> Aprobar
                             </button>` : ''}

                        ${user.account_status === 'active' ?
                            `<button class="deactivate-btn inline-flex items-center px-2.5 py-1.5 border border-slate-300 text-xs font-medium rounded text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm transition-colors" data-userid="${user.id}">
                                <span class="material-icons-round text-sm mr-1 pointer-events-none">block</span> Desactivar
                             </button>` : ''}

                        ${user.account_status === 'inactive' ?
                            `<button class="activate-btn inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-sm transition-colors" data-userid="${user.id}">
                                <span class="material-icons-round text-sm mr-1 pointer-events-none">check_circle</span> Activar
                             </button>` : ''}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                    <div class="flex gap-2">
                        <button class="reset-password-btn text-slate-400 hover:text-primary transition-colors" title="Restablecer Contraseña" data-userid="${user.id}">
                            <span class="material-icons-round pointer-events-none">lock_reset</span>
                        </button>
                        <button class="toggle-role-btn text-slate-400 hover:text-primary transition-colors" title="${user.role === 'admin' ? 'Hacer Usuario' : 'Hacer Admin'}" data-userid="${user.id}" data-currentrole="${user.role}">
                            <span class="material-icons-round pointer-events-none">${user.role === 'admin' ? 'person_off' : 'admin_panel_settings'}</span>
                        </button>
                        <button class="delete-user-btn text-slate-400 hover:text-red-600 transition-colors" title="Eliminar Usuario" data-userid="${user.id}">
                            <span class="material-icons-round pointer-events-none">delete</span>
                        </button>
                    </div>
                </td>`;
            userTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error al obtener usuarios:', error);
        userTableBody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-sm text-red-500">Error al cargar los usuarios. Por favor, intente de nuevo.</td></tr>';
    }
}

async function handleUserAction(event) {
    // Traverse up to find the button if the click was on an icon inside the button
    const target = event.target.closest('button');
    if (!target) return;

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
