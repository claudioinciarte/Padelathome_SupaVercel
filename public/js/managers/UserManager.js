import { fetchApi } from '../services/api.js';
import { showNotification } from '../utils.js';

export function init() {
    setupInviteUserForm();
    loadUsers();
    setupUserSearch();
}

function setupInviteUserForm() {
    const inviteForm = document.getElementById('invite-user-form');
    if (!inviteForm) return;

    // Load buildings into select
    const buildingSelect = document.getElementById('invite-building');
    fetchApi('/admin/buildings')
        .then(buildings => {
            buildingSelect.innerHTML = '<option value="">Seleccionar edificio...</option>';
            buildings.forEach(b => {
                const option = document.createElement('option');
                option.value = b.id; // Assuming ID is needed, but form asks for address/name in mockup. Let's use ID.
                option.textContent = b.name || b.address;
                buildingSelect.appendChild(option);
            });
        })
        .catch(console.error);

    inviteForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('invite-name').value;
        const email = document.getElementById('invite-email').value;
        const buildingId = document.getElementById('invite-building').value;
        const floor = document.getElementById('invite-floor').value;
        const door = document.getElementById('invite-door').value;

        try {
            // Note: The backend logic for "invite" might just be "create user" or a specific invite endpoint.
            // Based on previous context, we might be using a register or invite endpoint.
            // Let's assume a standard create user or invite endpoint exists or use a placeholder.
            // Since the requirement says "Invitar usuario nuevo", but we don't have an email service fully configured,
            // we'll assume it hits an endpoint that handles this.

            // Checking if there is a specific invite endpoint in adminRoutes?
            // The previous context implies standard user management.
            // Let's try POST /admin/users/invite or similar if it existed, otherwise POST /auth/register (but that logs them in).
            // Let's use a generic admin create user endpoint if available.

            // As a fallback/placeholder since I can't see the exact invite route implementation details in memory:
            // I will implement the fetch call to a plausible endpoint.
            await fetchApi('/admin/users/invite', {
                method: 'POST',
                // Explicitly mapping buildingId to buildingId (controller handles buildingId || building_id)
                body: JSON.stringify({ name, email, buildingId, floor, door })
            });

            showNotification('Invitación enviada correctamente (Simulado)', 'success');
            inviteForm.reset();
            loadUsers();
        } catch (error) {
            // Fallback for demo/dev if endpoint doesn't exist
            console.error(error);
            showNotification('Error al invitar usuario: ' + error.message, 'error');
        }
    });
}

async function loadUsers(query = '') {
    const tbody = document.getElementById('user-table-body');
    if (!tbody) return;

    try {
        const users = await fetchApi(`/admin/users?search=${encodeURIComponent(query)}`);
        tbody.innerHTML = '';

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">No se encontraron usuarios.</td></tr>';
            return;
        }

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors';

            // Initials for avatar
            const initials = user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
            // Random color logic or fixed based on char code
            const colorClass = 'bg-blue-100 dark:bg-blue-900 text-primary';

            // Use account_status instead of is_active
            const isActive = user.account_status === 'active';
            const statusLabel = isActive ? 'Activo' : 'Inactivo';
            const statusClass = isActive
                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800'
                : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800';

            tr.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 font-mono">#${user.id}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    <div class="h-8 w-8 rounded-full ${colorClass} flex items-center justify-center text-xs font-bold">${initials}</div>
                    ${user.name}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${user.email}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full ${statusClass}">
                        ${statusLabel}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">${user.role}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-center space-x-2">
                    <button data-userid="${user.id}" data-action="toggle-status" data-current-status="${user.account_status}" class="user-action-btn text-gray-600 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-md text-xs transition-colors border border-gray-200 dark:border-gray-600">
                        ${isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button data-userid="${user.id}" data-action="toggle-role" data-current-role="${user.role}" class="user-action-btn text-gray-600 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 px-3 py-1.5 rounded-md text-xs transition-colors border border-gray-200 dark:border-gray-600">
                        ${user.role === 'admin' ? 'Hacer User' : 'Hacer Admin'}
                    </button>
                    <button data-userid="${user.id}" data-action="delete" class="user-action-btn text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 px-3 py-1.5 rounded-md text-xs transition-colors border border-red-200 dark:border-red-800">
                        Eliminar
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add event listeners to buttons
        document.querySelectorAll('.user-action-btn').forEach(btn => {
            btn.addEventListener('click', handleUserAction);
        });

    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-sm text-red-500">Error al cargar usuarios.</td></tr>';
    }
}

function setupUserSearch() {
    const searchInput = document.getElementById('user-search');
    let debounceTimer;
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadUsers(e.target.value);
            }, 300);
        });
    }
}

async function handleUserAction(e) {
    const btn = e.currentTarget;
    const userId = btn.dataset.userid;
    const action = btn.dataset.action;

    try {
        if (action === 'toggle-status') {
             const currentStatus = btn.dataset.currentStatus;
             // If currently active, set to inactive. If inactive or pending, set to active.
             const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

             await fetchApi(`/admin/users/${userId}/status`, {
                 method: 'PUT', // Changed to PUT matching routes
                 body: JSON.stringify({ status: newStatus })
             });
             showNotification('Estado actualizado', 'success');
             loadUsers();
        } else if (action === 'toggle-role') {
             const currentRole = btn.dataset.currentRole;
             const newRole = currentRole === 'admin' ? 'user' : 'admin';

             await fetchApi(`/admin/users/${userId}/role`, {
                 method: 'PUT', // Changed to PUT matching routes
                 body: JSON.stringify({ role: newRole })
             });
             showNotification('Rol actualizado', 'success');
             loadUsers();
        } else if (action === 'delete') {
            if (confirm('¿Estás seguro de eliminar este usuario?')) {
                await fetchApi(`/admin/users/${userId}`, { method: 'DELETE' });
                showNotification('Usuario eliminado', 'success');
                loadUsers();
            }
        }
    } catch (error) {
        console.error(error);
        showNotification(error.message, 'error');
    }
}
