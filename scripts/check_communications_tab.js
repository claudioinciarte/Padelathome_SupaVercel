// Test de integración del DOM: parsea admin.html y verifica que la estructura
// de la pestaña Comunicaciones y el contenedor del editor existen correctamente.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');

// Verificaciones estructurales
const checks = [
  ['Pestaña Comunicaciones en nav', html.includes('data-tab="communications"')],
  ['Div #communications tab-content', html.includes('id="communications" class="tab-content')],
  ['Contenedor #email-templates-list', html.includes('id="email-templates-list"')],
  ['Estilos .tpl-toolbar', html.includes('.tpl-toolbar')],
  ['Estilos .tpl-editor', html.includes('.tpl-editor')],
  ['Estilos .tpl-preview', html.includes('.tpl-preview')],
  ['Estilos .tpl-var-chip', html.includes('.tpl-var-chip')],
];

let ok = true;
checks.forEach(([name, passed]) => {
  console.log((passed ? 'PASS' : 'FAIL') + ' — ' + name);
  if (!passed) ok = false;
});

// Verificar admin.js cablea el manager
const adminJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.js'), 'utf8');
const jsChecks = [
  ['Import EmailTemplateManager', adminJs.includes("import * as EmailTemplateManager from './js/managers/EmailTemplateManager.js'")],
  ['EmailTemplateManager.init() called', adminJs.includes('EmailTemplateManager.init()')],
];
jsChecks.forEach(([name, passed]) => {
  console.log((passed ? 'PASS' : 'FAIL') + ' — ' + name);
  if (!passed) ok = false;
});

// Verificar EmailTemplateManager.js estructura
const mgrJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'managers', 'EmailTemplateManager.js'), 'utf8');
const mgrChecks = [
  ['Has fetchAndRenderTemplates', mgrJs.includes('async function fetchAndRenderTemplates')],
  ['Has renderAccordion', mgrJs.includes('function renderAccordion(')],
  ['Has buildEditorHtml', mgrJs.includes('function buildEditorHtml(')],
  ['Has setupEditor', mgrJs.includes('function setupEditor(')],
  ['Uses execCommand', mgrJs.includes('document.execCommand')],
  ['Bold button', mgrJs.includes("data-cmd=\"bold\"")],
  ['Italic button', mgrJs.includes("data-cmd=\"italic\"")],
  ['Underline button', mgrJs.includes("data-cmd=\"underline\"")],
  ['H2 formatBlock', mgrJs.includes("data-cmd=\"formatBlock\" data-val=\"h2\"")],
  ['H3 formatBlock', mgrJs.includes("data-cmd=\"formatBlock\" data-val=\"h3\"")],
  ['P formatBlock', mgrJs.includes("data-cmd=\"formatBlock\" data-val=\"p\"")],
  ['insertUnorderedList', mgrJs.includes("data-cmd=\"insertUnorderedList\"")],
  ['createLink', mgrJs.includes("data-cmd=\"createLink\"")],
  ['removeFormat', mgrJs.includes("data-cmd=\"removeFormat\"")],
  ['Variable chips insert', mgrJs.includes("tpl-var-chip")],
  ['insertAtCursor function', mgrJs.includes("function insertAtCursor(")],
  ['Live preview updatePreview', mgrJs.includes("function updatePreview(")],
  ['Save button PUT', mgrJs.includes("/admin/email-templates/${key}")],
  ['Restore button', mgrJs.includes("tpl-restore-btn")],
  ['SAMPLE_CONTEXT', mgrJs.includes("SAMPLE_CONTEXT")],
];
mgrChecks.forEach(([name, passed]) => {
  console.log((passed ? 'PASS' : 'FAIL') + ' — ' + name);
  if (!passed) ok = false;
});

console.log(ok ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(ok ? 0 : 1);
