/**
 * Renderiza las opciones del selector de pistas.
 * @param {HTMLSelectElement} selectElement - El elemento <select> del DOM.
 * @param {Array} courts - Array de objetos pista { id, name }.
 * @param {string|number} selectedId - El ID de la pista seleccionada actualmente.
 */
export function render(selectElement, courts, selectedId) {
    selectElement.innerHTML = courts.map(c =>
        `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${c.name}</option>`
    ).join('');
}

/**
 * Inicializa el listener para cambios en la selección.
 * @param {HTMLSelectElement} selectElement - El elemento <select> del DOM.
 * @param {Function} onChange - Callback que recibe el nuevo ID de la pista (como número).
 */
export function init(selectElement, onChange) {
    selectElement.addEventListener('change', (e) => {
        const newValue = parseInt(e.target.value, 10);
        onChange(newValue);
    });
}

/**
 * Muestra u oculta el contenedor del selector.
 * @param {HTMLElement} container - El contenedor padre del selector.
 * @param {boolean} show - True para mostrar, False para ocultar.
 */
export function toggleVisibility(container, show) {
    if (show) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}
