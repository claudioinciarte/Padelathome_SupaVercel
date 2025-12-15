import { fetchApi } from '../services/api.js';
import { showNotification } from '../utils.js';

const courtForm = document.getElementById('court-form');
const courtFormTitle = document.getElementById('court-form-title');
const courtIdInput = document.getElementById('court-id');
const courtNameInput = document.getElementById('court-name');
const courtDescriptionInput = document.getElementById('court-description');
const courtIsActiveDiv = document.getElementById('court-active-div');
const courtIsActiveCheckbox = document.getElementById('court-is-active');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const courtsListContainer = document.getElementById('courts-list-container');
const blockCourtSelect = document.getElementById('block-court-select');

let allCourtsData = [];

function resetCourtForm() {
    courtFormTitle.textContent = 'Crear Nueva Pista';
    courtForm.reset();
    courtIdInput.value = '';
    courtIsActiveDiv.style.display = 'none';
    cancelEditBtn.style.display = 'none';
}

async function fetchAndRenderCourts() {
    try {
        const courts = await fetchApi('/courts');
        allCourtsData = courts;

        if (blockCourtSelect) {
            blockCourtSelect.innerHTML = '';
            courts.forEach(court => {
                if (court.is_active) {
                    const option = document.createElement('option');
                    option.value = court.id;
                    option.textContent = court.name;
                    blockCourtSelect.appendChild(option);
                }
            });
        }

        courtsListContainer.innerHTML = '';
        const courtList = document.createElement('ul');
        if (courts.length === 0) {
            courtList.innerHTML = '<li>No hay pistas creadas en el sistema.</li>';
        } else {
            courts.forEach(court => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `<strong>${court.name}</strong> (ID: ${court.id}) - Estado: ${court.is_active ? '<strong class="success-text">Activa</strong>' : '<span class="error-text">Inactiva</span>'}<br><em>${court.description || 'Sin descripción.'}</em><br><button class="edit-court-btn" data-courtid="${court.id}">Editar</button><button class="delete-court-btn" data-courtid="${court.id}">Eliminar</button>`;
                courtList.appendChild(listItem);
            });
        }
        courtsListContainer.appendChild(courtList);
    } catch (error) {
        console.error('Error al obtener pistas:', error);
        courtsListContainer.innerHTML = '<p class="error-text">Error al cargar la información de las pistas.</p>';
    }
}

async function handleCourtFormSubmit(event) {
    event.preventDefault();
    const courtId = courtIdInput.value;
    const isEditing = !!courtId;
    const endpoint = isEditing ? `/courts/${courtId}` : `/courts`;
    const method = isEditing ? 'PUT' : 'POST';
    const body = {
        name: courtNameInput.value,
        description: courtDescriptionInput.value,
    };
    if (isEditing) {
        body.is_active = courtIsActiveCheckbox.checked;
    }
    try {
        await fetchApi(endpoint, { method, body: JSON.stringify(body) });
        showNotification(`Pista ${isEditing ? 'actualizada' : 'creada'}.`, 'success');
        resetCourtForm();
        fetchAndRenderCourts();
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function handleCourtAction(event) {
    const target = event.target;
    if (target.classList.contains('edit-court-btn')) {
        const courtId = target.dataset.courtid;
        const courtToEdit = allCourtsData.find(c => c.id == courtId);
        if (courtToEdit) {
            courtFormTitle.textContent = 'Editar Pista';
            courtIdInput.value = courtToEdit.id;
            courtNameInput.value = courtToEdit.name;
            courtDescriptionInput.value = courtToEdit.description;
            courtIsActiveDiv.style.display = 'block';
            courtIsActiveCheckbox.checked = courtToEdit.is_active;
            cancelEditBtn.style.display = 'inline-block';
            const accordionContent = document.getElementById('court-management').parentElement;
            accordionContent.style.display = 'block';
            accordionContent.previousElementSibling.classList.add('active');
            courtForm.scrollIntoView({ behavior: 'smooth' });
        }
    } else if (target.classList.contains('delete-court-btn')) {
        const courtId = target.dataset.courtid;
        if (!confirm(`¿Eliminar pista ID ${courtId}?`)) return;
        try {
            await fetchApi(`/courts/${courtId}`, { method: 'DELETE' });
            showNotification('Pista eliminada.', 'success');
            fetchAndRenderCourts();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    }
}

export function init() {
    if (!courtForm || !courtsListContainer) {
        console.warn('Elementos del DOM para CourtManager no encontrados.');
        return;
    }

    fetchAndRenderCourts();
    
    courtForm.addEventListener('submit', handleCourtFormSubmit);
    courtsListContainer.addEventListener('click', handleCourtAction);
    cancelEditBtn.addEventListener('click', resetCourtForm);
}
