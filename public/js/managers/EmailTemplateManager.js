/**
 * EmailTemplateManager.js
 *
 * Gestiona la pestaña "Comunicaciones → Plantillas de Correos" del panel admin.
 * - Carga las 7 plantillas desde GET /api/admin/email-templates.
 * - Renderiza un acordeón; al abrir cada item muestra un editor rico contenteditable
 *   con barra de formato (execCommand: bold, italic, underline, H2/H3/p, listas, enlaces),
 *   campo de asunto, panel de variables insertables en el cursor, vista previa en vivo
 *   con datos de ejemplo, y botones Guardar (PUT) + Restaurar (revertir a último guardado).
 */
import { fetchApi } from '../services/api.js';
import { showNotification } from '../utils.js';

// Datos de ejemplo para la vista previa en vivo (uno por variable conocida).
const SAMPLE_CONTEXT = {
    userName: 'María García',
    date: 'sábado, 23 de agosto de 2025',
    slotTime: 'sábado 23 de agosto, 18:00',
    confirmationUrl: 'https://padelathome.vercel.app/confirm-booking?token=abc123',
    formattedDate: 'sábado 23 de agosto a las 18:00',
    cancelReason: 'No se alcanzó el mínimo de jugadores requerido.',
    setPasswordUrl: 'https://padelathome.vercel.app/reset-password?token=xyz789',
    resetUrl: 'https://padelathome.vercel.app/reset-password?token=xyz789',
};

// Estado: plantillas cargadas + copia original (para Restaurar).
let templatesCache = [];
const originals = new Map(); // key -> { subject, html_template }

function init() {
    fetchAndRenderTemplates();
}

async function fetchAndRenderTemplates() {
    const container = document.getElementById('email-templates-list');
    if (!container) return;
    try {
        const templates = await fetchApi('/admin/email-templates');
        templatesCache = templates;
        // Guardamos una copia original de cada plantilla para el botón Restaurar
        originals.clear();
        templates.forEach(t => originals.set(t.key, { subject: t.subject, html_template: t.html_template }));
        renderAccordion(templates);
    } catch (error) {
        console.error('Error al cargar plantillas de correo:', error);
        container.innerHTML = '<p class="text-sm text-red-500">Error al cargar las plantillas.</p>';
    }
}

function renderAccordion(templates) {
    const container = document.getElementById('email-templates-list');
    if (!container) return;
    if (!templates || templates.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">No hay plantillas disponibles.</p>';
        return;
    }
    container.innerHTML = '';
    templates.forEach(tpl => {
        const details = document.createElement('details');
        details.className = 'group bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-all duration-300';
        const updated = tpl.updated_at ? new Date(tpl.updated_at).toLocaleString('es-ES') : 'default';
        details.innerHTML = `
            <summary class="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div class="flex items-center gap-3">
                    <span class="material-symbols-outlined text-gray-400 text-xl">mail</span>
                    <div>
                        <p class="text-sm font-semibold text-gray-900 dark:text-white">${tpl.name}</p>
                        <p class="text-xs text-gray-400 font-mono">${tpl.key}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="text-xs text-gray-400">Editado: ${updated}</span>
                    <span class="material-symbols-outlined text-gray-400 expand-icon transition-transform duration-300">expand_more</span>
                </div>
            </summary>
            <div class="border-t border-gray-100 dark:border-gray-700/50 p-4">
                ${buildEditorHtml(tpl)}
            </div>
        `;
        container.appendChild(details);
        // Wire events after the HTML is in the DOM
        const editorBlock = details.querySelector('[data-tpl-key]');
        setupEditor(tpl, editorBlock);
    });
}

function buildEditorHtml(tpl) {
    const vars = tpl.available_vars || [];
    const varChips = vars.map(v =>
        `<button type="button" class="tpl-var-chip" data-var="${v}" title="Insertar {{${v}}} en el cursor">{{${v}}}</button>`
    ).join('');

    return `
        <div data-tpl-key="${tpl.key}" class="space-y-4">
            <!-- Asunto -->
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asunto del correo</label>
                <input type="text" class="tpl-subject block w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-lg shadow-sm focus:ring-primary focus:border-primary sm:text-sm px-3 py-2 text-gray-900 dark:text-white" value="${escapeAttr(tpl.subject)}" placeholder="Asunto...">
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <!-- Editor -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cuerpo del correo</label>
                    <div class="tpl-toolbar flex items-center gap-1 p-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 border-b-0 rounded-t-lg flex-wrap">
                        <button type="button" data-cmd="bold" title="Negrita" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 font-bold text-sm">B</button>
                        <button type="button" data-cmd="italic" title="Cursiva" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 italic text-sm">I</button>
                        <button type="button" data-cmd="underline" title="Subrayado" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 underline text-sm">U</button>
                        <span class="tpl-divider"></span>
                        <button type="button" data-cmd="formatBlock" data-val="h2" title="Subtítulo H2" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 text-xs font-semibold">H2</button>
                        <button type="button" data-cmd="formatBlock" data-val="h3" title="Subtítulo H3" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 text-xs font-semibold">H3</button>
                        <button type="button" data-cmd="formatBlock" data-val="p" title="Párrafo" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 text-xs">P</button>
                        <span class="tpl-divider"></span>
                        <button type="button" data-cmd="insertUnorderedList" title="Lista" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 text-sm">• Lista</button>
                        <button type="button" data-cmd="createLink" title="Enlace" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 text-sm flex items-center gap-1">
                            <span class="material-symbols-outlined text-base">link</span>
                        </button>
                        <span class="tpl-divider"></span>
                        <button type="button" data-cmd="removeFormat" title="Quitar formato" class="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-200 text-sm">
                            <span class="material-symbols-outlined text-base">format_clear</span>
                        </button>
                    </div>
                    <div class="tpl-editor contenteditable border border-gray-300 dark:border-gray-600 dark:bg-gray-700 rounded-b-lg p-3 text-sm text-gray-900 dark:text-gray-100" contenteditable="true"></div>
                </div>

                <!-- Vista previa -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vista previa (con datos de ejemplo)</label>
                    <div class="tpl-preview bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-sm text-gray-800 dark:text-gray-200">
                        <p class="text-gray-400 text-xs mb-2">Asunto: <span class="tpl-preview-subject font-medium text-gray-700 dark:text-gray-300"></span></p>
                        <hr class="border-gray-200 dark:border-gray-700 my-2">
                        <div class="tpl-preview-body"></div>
                    </div>
                </div>
            </div>

            <!-- Panel de variables -->
            <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Variables disponibles (clic para insertar en el cursor)</label>
                <div class="flex flex-wrap gap-2">
                    ${varChips || '<span class="text-xs text-gray-400">Esta plantilla no tiene variables.</span>'}
                </div>
            </div>

            <!-- Botones -->
            <div class="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/50">
                <button type="button" class="tpl-restore-btn bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium py-2 px-4 rounded-lg text-sm flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">undo</span>
                    Restaurar
                </button>
                <button type="button" class="tpl-save-btn bg-primary hover:bg-primary-dark text-white font-medium py-2 px-4 rounded-lg text-sm flex items-center gap-1">
                    <span class="material-symbols-outlined text-sm">save</span>
                    Guardar
                </button>
            </div>
        </div>
    `;
}

function setupEditor(tpl, block) {
    const key = tpl.key;
    const editor = block.querySelector('.tpl-editor');
    const subjectInput = block.querySelector('.tpl-subject');
    const previewSubject = block.querySelector('.tpl-preview-subject');
    const previewBody = block.querySelector('.tpl-preview-body');
    const saveBtn = block.querySelector('.tpl-save-btn');
    const restoreBtn = block.querySelector('.tpl-restore-btn');
    const varChips = block.querySelectorAll('.tpl-var-chip');

    // Cargar contenido inicial
    editor.innerHTML = tpl.html_template || '';
    subjectInput.value = tpl.subject || '';

    // Vista previa inicial
    updatePreview();

    // Toolbar
    block.querySelectorAll('.tpl-toolbar button').forEach(btn => {
        btn.addEventListener('mousedown', (e) => e.preventDefault()); // no perder foco del editor
        btn.addEventListener('click', () => {
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.val;
            if (cmd === 'createLink') {
                const url = prompt('Introduce la URL del enlace:', 'https://');
                if (url) {
                    editor.focus();
                    document.execCommand('createLink', false, url);
                }
            } else if (cmd === 'formatBlock') {
                editor.focus();
                document.execCommand('formatBlock', false, val);
            } else {
                editor.focus();
                document.execCommand(cmd, false, val || null);
            }
            updatePreview();
        });
    });

    // Editor: actualizar preview al escribir
    editor.addEventListener('input', updatePreview);
    subjectInput.addEventListener('input', updatePreview);

    // Variables: insertar {{var}} en el cursor
    varChips.forEach(chip => {
        chip.addEventListener('click', () => {
            const varName = chip.dataset.var;
            insertAtCursor(editor, `{{${varName}}}`);
            updatePreview();
        });
    });

    // Guardar
    saveBtn.addEventListener('click', async () => {
        const subject = subjectInput.value.trim();
        const htmlTemplate = editor.innerHTML.trim();
        if (!subject || !htmlTemplate) {
            showNotification('El asunto y el cuerpo no pueden estar vacíos.', 'error');
            return;
        }
        saveBtn.disabled = true;
        const originalHtml = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">progress_activity</span> Guardando...';
        try {
            const updated = await fetchApi(`/admin/email-templates/${key}`, {
                method: 'PUT',
                body: JSON.stringify({ subject, html_template: htmlTemplate }),
            });
            // Actualizar caché original
            originals.set(key, { subject: updated.subject, html_template: updated.html_template });
            showNotification(`Plantilla "${tpl.name}" guardada.`, 'success');
        } catch (error) {
            showNotification(error.message, 'error');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalHtml;
        }
    });

    // Restaurar (revertir a último guardado)
    restoreBtn.addEventListener('click', () => {
        const orig = originals.get(key);
        if (!orig) return;
        editor.innerHTML = orig.html_template;
        subjectInput.value = orig.subject;
        updatePreview();
        showNotification('Cambios descartados.', 'info');
    });

    function updatePreview() {
        const subj = subjectInput.value;
        const html = editor.innerHTML;
        previewSubject.textContent = substituteVars(subj);
        previewBody.innerHTML = substituteVars(html);
    }

    function substituteVars(text) {
        if (typeof text !== 'string') return text;
        return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, varName) => {
            if (Object.prototype.hasOwnProperty.call(SAMPLE_CONTEXT, varName)) {
                return String(SAMPLE_CONTEXT[varName]);
            }
            return match; // dejar visible si no hay ejemplo
        });
    }
}

// Inserta texto en la posición del cursor dentro de un contenteditable.
function insertAtCursor(editor, text) {
    editor.focus();
    const sel = window.getSelection();
    if (!sel.rangeCount || !editor.contains(sel.anchorNode)) {
        // Si no hay selección dentro del editor, añadir al final
        editor.innerHTML += text;
        return;
    }
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    // Mover el cursor después del texto insertado
    range.setStartAfter(node);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export { init };
