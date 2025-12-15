import { fetchApi } from '../services/api.js';
import { showNotification } from '../utils.js';

const buildingsListContainer = document.getElementById('buildings-list-container');
const buildingForm = document.getElementById('building-form');
const buildingFormTitle = document.getElementById('building-form-title');
const buildingIdInput = document.getElementById('building-id');
const buildingAddressInput = document.getElementById('building-address');
const buildingDescriptionInput = document.getElementById('building-description');
const cancelBuildingEditBtn = document.getElementById('cancel-building-edit-btn');
const inviteBuildingSelect = document.getElementById('invite-building');

let allBuildings = []; // Para almacenar los edificios y facilitar la edición

function resetBuildingForm() {
    buildingFormTitle.textContent = 'Añadir Nuevo Edificio';
    buildingForm.reset();
    buildingIdInput.value = '';
    cancelBuildingEditBtn.style.display = 'none';
}

async function fetchAndRenderBuildings() {
    try {
        const buildings = await fetchApi('/admin/buildings');
        allBuildings = buildings;

        if (inviteBuildingSelect) {
            inviteBuildingSelect.innerHTML = '';
            if (buildings.length > 0) {
                buildings.forEach(building => {
                    const option = document.createElement('option');
                    option.value = building.id;
                    option.textContent = building.address;
                    inviteBuildingSelect.appendChild(option);
                });
            }
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
}

async function handleBuildingFormSubmit(event) {
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
        fetchAndRenderBuildings();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleBuildingAction(event) {
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
            fetchAndRenderBuildings();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

export function init() {
    if (!buildingsListContainer || !buildingForm) {
        console.warn('Elementos del DOM para BuildingManager no encontrados.');
        return;
    }
    
    fetchAndRenderBuildings();
    
    buildingForm.addEventListener('submit', handleBuildingFormSubmit);
    buildingsListContainer.addEventListener('click', handleBuildingAction);
    cancelBuildingEditBtn.addEventListener('click', resetBuildingForm);
}