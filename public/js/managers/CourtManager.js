import { fetchApi } from '../services/api.js';
import { showNotification } from '../utils.js';

export function init() {
    setupCourtForm();
    loadCourts();
}

function setupCourtForm() {
    const form = document.getElementById('court-form');
    if (!form) return;

    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetCourtForm);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('court-id').value;
        const name = document.getElementById('court-name').value;
        const buildingId = document.getElementById('court-building').value;
        const description = document.getElementById('court-description').value;
        const isActive = document.getElementById('court-is-active').checked;

        // Note: The original court form didn't explicitly have "isActive" in the mockup for creation,
        // but it is in the "Existing Courts" list. I added a hidden-by-default logic for it in creation if needed,
        // or just use it for edits.

        try {
            if (id) {
                // Update
                // Note: Assuming PUT /admin/courts/:id exists
                await fetchApi(`/admin/courts/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, buildingId, description, is_active: isActive })
                });
                showNotification('Pista actualizada', 'success');
            } else {
                // Create
                await fetchApi('/admin/courts', {
                    method: 'POST',
                    body: JSON.stringify({ name, buildingId, description })
                });
                showNotification('Pista creada', 'success');
            }
            resetCourtForm();
            loadCourts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
}

function resetCourtForm() {
    const form = document.getElementById('court-form');
    form.reset();
    document.getElementById('court-id').value = '';
    document.getElementById('court-form-title').innerHTML = `
        <span class="material-symbols-outlined text-primary text-base">add_circle</span>
        Crear Nueva Pista
    `;
    document.getElementById('court-active-div').style.display = 'none';
    const cancelBtn = document.getElementById('cancel-edit-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

export async function loadCourts() {
    const container = document.getElementById('courts-list-container');
    const buildingSelect = document.getElementById('court-building');
    const blockCourtSelect = document.getElementById('block-court-select');

    if (!container) return;

    try {
        // Load buildings first to populate select
        const buildings = await fetchApi('/admin/buildings');
        const buildingMap = {};

        if (buildingSelect) {
            buildingSelect.innerHTML = '<option value="">Seleccionar edificio...</option>';
            buildings.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b.id;
                opt.textContent = b.name || b.address;
                buildingSelect.appendChild(opt);
                buildingMap[b.id] = b.name || b.address;
            });
        }

        const courts = await fetchApi('/admin/courts');

        // Populate block court select
        if (blockCourtSelect) {
            blockCourtSelect.innerHTML = '';
            courts.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name;
                blockCourtSelect.appendChild(opt);
            });
            // Option for all courts? Mockup says "Todas las Pistas"
            // If backend supports blocking all courts with a special ID or logic
            // For now let's just list individual courts.
        }

        container.innerHTML = '';

        if (courts.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">No hay pistas registradas.</p>';
            return;
        }

        courts.forEach(c => {
            const div = document.createElement('div');
            div.className = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition-shadow';

            const activeBadge = c.is_active
                ? '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800">Activa</span>'
                : '<span class="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border border-red-200 dark:border-red-800">Inactiva</span>';

            const buildingName = buildingMap[c.building_id] ? `(${buildingMap[c.building_id]})` : '';

            div.innerHTML = `
                <div>
                    <div class="flex items-center gap-2">
                        <h5 class="text-base font-semibold text-gray-900 dark:text-white">${c.name} ${buildingName}</h5>
                        <span class="px-2 py-0.5 rounded text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">ID: ${c.id}</span>
                        ${activeBadge}
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${c.description || 'Sin descripción'}</p>
                </div>
                <div class="flex items-center gap-2 w-full sm:w-auto">
                    <button data-id="${c.id}" class="edit-court-btn flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                        <span class="material-symbols-outlined text-base">edit</span>
                        Editar
                    </button>
                    <button data-id="${c.id}" class="delete-court-btn flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                        <span class="material-symbols-outlined text-base">delete</span>
                        Eliminar
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

        document.querySelectorAll('.edit-court-btn').forEach(btn => {
            btn.addEventListener('click', () => editCourt(btn.dataset.id, courts));
        });
        document.querySelectorAll('.delete-court-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteCourt(btn.dataset.id));
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="text-sm text-red-500">Error al cargar pistas.</p>';
    }
}

function editCourt(id, courts) {
    const court = courts.find(c => c.id == id);
    if (!court) return;

    document.getElementById('court-id').value = court.id;
    document.getElementById('court-name').value = court.name;
    document.getElementById('court-building').value = court.building_id || '';
    document.getElementById('court-description').value = court.description || '';

    // Show active checkbox for editing
    const activeDiv = document.getElementById('court-active-div');
    activeDiv.style.display = 'flex';
    document.getElementById('court-is-active').checked = court.is_active;

    document.getElementById('court-form-title').innerHTML = `
        <span class="material-symbols-outlined text-primary text-base">edit</span>
        Editar Pista #${court.id}
    `;
    document.getElementById('cancel-edit-btn').style.display = 'flex';
    document.getElementById('court-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteCourt(id) {
    if (!confirm('¿Seguro que deseas eliminar esta pista?')) return;
    try {
        await fetchApi(`/admin/courts/${id}`, { method: 'DELETE' });
        showNotification('Pista eliminada', 'success');
        loadCourts();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}
