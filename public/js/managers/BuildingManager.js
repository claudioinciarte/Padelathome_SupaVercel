import { fetchApi } from '../services/api.js';
import { showNotification } from '../utils.js';
import { loadCourts } from './CourtManager.js'; // Reload courts when buildings change

export function init() {
    setupBuildingForm();
    loadBuildings();
}

function setupBuildingForm() {
    const form = document.getElementById('building-form');
    if (!form) return;

    const cancelBtn = document.getElementById('cancel-building-edit-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetBuildingForm);
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('building-id').value;
        const name = document.getElementById('building-address').value; // Using this as name/address
        const description = document.getElementById('building-description').value;

        try {
            if (id) {
                // Update
                await fetchApi(`/admin/buildings/${id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ name, description })
                });
                showNotification('Edificio actualizado', 'success');
            } else {
                // Create
                await fetchApi('/admin/buildings', {
                    method: 'POST',
                    body: JSON.stringify({ name, description })
                });
                showNotification('Edificio creado', 'success');
            }
            resetBuildingForm();
            loadBuildings();

            // Reload courts in case building names changed in dropdowns
            loadCourts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
}

function resetBuildingForm() {
    const form = document.getElementById('building-form');
    form.reset();
    document.getElementById('building-id').value = '';
    document.getElementById('building-form-title').innerHTML = `
        <span class="material-symbols-outlined text-primary text-base">add_circle</span>
        Añadir Nuevo Edificio
    `;
    const cancelBtn = document.getElementById('cancel-building-edit-btn');
    if (cancelBtn) cancelBtn.style.display = 'none';
}

export async function loadBuildings() {
    const container = document.getElementById('buildings-list-container');
    if (!container) return;

    try {
        const buildings = await fetchApi('/admin/buildings');
        container.innerHTML = '';

        if (buildings.length === 0) {
            container.innerHTML = '<p class="text-sm text-gray-500">No hay edificios registrados.</p>';
            return;
        }

        buildings.forEach(b => {
            const div = document.createElement('div');
            div.className = 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-md transition-shadow';
            div.innerHTML = `
                <div>
                    <div class="flex items-center gap-2">
                        <h5 class="text-base font-semibold text-gray-900 dark:text-white">${b.name || b.address}</h5>
                        <span class="px-2 py-0.5 rounded text-xs font-mono bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">ID: ${b.id}</span>
                    </div>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${b.description || 'Sin descripción'}</p>
                </div>
                <div class="flex items-center gap-2 w-full sm:w-auto">
                    <button data-id="${b.id}" class="edit-building-btn flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                        <span class="material-symbols-outlined text-base">edit</span>
                        Editar
                    </button>
                    <button data-id="${b.id}" class="delete-building-btn flex-1 sm:flex-none flex items-center justify-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors">
                        <span class="material-symbols-outlined text-base">delete</span>
                        Eliminar
                    </button>
                </div>
            `;
            container.appendChild(div);
        });

        // Event Listeners
        document.querySelectorAll('.edit-building-btn').forEach(btn => {
            btn.addEventListener('click', () => editBuilding(btn.dataset.id, buildings));
        });
        document.querySelectorAll('.delete-building-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteBuilding(btn.dataset.id));
        });

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="text-sm text-red-500">Error al cargar edificios.</p>';
    }
}

function editBuilding(id, buildings) {
    const building = buildings.find(b => b.id == id);
    if (!building) return;

    document.getElementById('building-id').value = building.id;
    document.getElementById('building-address').value = building.name || building.address; // Adaptation
    document.getElementById('building-description').value = building.description || '';

    document.getElementById('building-form-title').innerHTML = `
        <span class="material-symbols-outlined text-primary text-base">edit</span>
        Editar Edificio #${building.id}
    `;
    document.getElementById('cancel-building-edit-btn').style.display = 'flex';

    // Scroll to form
    document.getElementById('building-form').scrollIntoView({ behavior: 'smooth' });
}

async function deleteBuilding(id) {
    if (!confirm('¿Seguro que deseas eliminar este edificio? Se eliminarán también las pistas asociadas.')) return;
    try {
        await fetchApi(`/admin/buildings/${id}`, { method: 'DELETE' });
        showNotification('Edificio eliminado', 'success');
        loadBuildings();
        loadCourts();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}
