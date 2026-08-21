/**
 * emailTemplateService.js
 *
 * Motor de plantillas de correo para Padel@Home.
 * - renderTemplate(key, context): lee la plantilla de la tabla email_templates
 *   (fallback al default hardcodeado si no existe en DB), sustituye {{variable}}
 *   sin evaluar JS, y valida que las variables usadas existan en CONTEXT_VARS.
 * - CONTEXT_VARS: catálogo de variables disponibles por clave de plantilla.
 * - listTemplates / getTemplate: helpers para la API admin.
 *
 * Sustitución segura: regex de {{key}} → valor del context. Nunca eval() ni new Function.
 */
const pool = require('../config/database');

// ─── Catálogo de variables por clave ───
// Deducidas de las 11 llamadas sendEmail en el código (8 archivos).
const CONTEXT_VARS = {
  'booking.confirm': ['userName', 'date'],
  'waitlist.slot': ['userName', 'slotTime', 'confirmationUrl'],
  'match.cancel': ['userName', 'formattedDate', 'cancelReason'],
  'account.approved': ['userName'],
  'account.welcome': ['userName', 'setPasswordUrl'],
  'password.reset': ['userName', 'setPasswordUrl'],
  'auth.password-reset': ['userName', 'resetUrl'],
};

// ─── Plantillas por defecto (fallback si no existen en DB) ───
// Extraídas del código fuente original (HTML literal de cada sendEmail).
const DEFAULT_TEMPLATES = {
  'booking.confirm': {
    name: 'Confirmación de Reserva',
    subject: 'Confirmación de Reserva en Padel@Home para el {{date}}',
    html_template: '<h3>¡Hola, {{userName}}!</h3><p>Tu reserva ha sido confirmada. Adjuntamos un evento de calendario.</p>',
  },
  'waitlist.slot': {
    name: 'Hueco Liberado — Lista de Espera',
    subject: '¡Un hueco se ha liberado en Padel@Home!',
    html_template: '<h3>¡Hola, {{userName}}!</h3><p>Se ha liberado el horario por el que estabas esperando ({{slotTime}}).</p><p>Tienes <strong>30 minutos</strong> para confirmar la reserva haciendo clic en el siguiente enlace. Después, tu turno expirará.</p><a href="{{confirmationUrl}}">Confirmar mi Reserva</a>',
  },
  'match.cancel': {
    name: 'Cancelación de Partida Abierta',
    subject: 'Cancelación de Partida Abierta - Padel@Home',
    html_template: '<h3>Hola {{userName}},</h3><p>Te informamos que la partida abierta programada para el <strong>{{formattedDate}}</strong> ha sido cancelada.</p><p>{{cancelReason}}</p><p>Disculpa las molestias.</p><p>Atentamente,<br>El equipo de Padel@Home</p>',
  },
  'account.approved': {
    name: 'Cuenta Aprobada',
    subject: '¡Tu cuenta en Padel@Home ha sido aprobada!',
    html_template: '<h3>¡Hola, {{userName}}!</h3><p>Tu cuenta ha sido aprobada. ¡Ya puedes iniciar sesión!</p>',
  },
  'account.welcome': {
    name: 'Bienvenida — Establecer Contraseña',
    subject: '¡Bienvenido a Padel@Home! Establece tu contraseña',
    html_template: '<h3>¡Hola, {{userName}}!</h3><p>Un administrador te ha creado una cuenta en Padel@Home.</p><p>Por favor, haz clic en el siguiente enlace para establecer tu contraseña. El enlace es válido por 24 horas.</p><a href="{{setPasswordUrl}}">Establecer mi contraseña</a>',
  },
  'password.reset': {
    name: 'Restablecimiento de Contraseña (Admin)',
    subject: 'Restablecimiento de Contraseña para Padel@Home',
    html_template: '<h3>¡Hola, {{userName}}!</h3><p>Se ha solicitado un restablecimiento de contraseña para tu cuenta de Padel@Home.</p><p>Por favor, haz clic en el siguiente enlace para establecer una nueva contraseña. El enlace es válido por 24 horas.</p><a href="{{setPasswordUrl}}">Establecer nueva contraseña</a><p>Si no solicitaste este cambio, por favor ignora este correo.</p>',
  },
  'auth.password-reset': {
    name: 'Restablecer Contraseña',
    subject: 'Restablece tu contraseña de Padel@Home',
    html_template: '<h3>Hola, {{userName}}</h3><p>Recibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace para crear una nueva:</p><a href="{{resetUrl}}">Restablecer Contraseña</a><p>Este enlace expirará en 30 minutos.</p>',
  },
};

// ─── Helpers internos ───

// Sustituye {{variable}} por su valor en el context.
// No evalúa JS, no interpreta HTML — solo reemplazo de texto.
function substituteVars(text, context) {
  if (typeof text !== 'string') return text;
  // Coincide {{key}} donde key es alfanumérico + guion bajo
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, varName) => {
    if (Object.prototype.hasOwnProperty.call(context, varName)) {
      return String(context[varName] ?? '');
    }
    // Variable no resuelta: se deja tal cual para que sea visible en la vista previa
    return match;
  });
}

// Extrae los nombres de variables {{...}} usados en un texto.
function extractVars(text) {
  if (typeof text !== 'string') return [];
  const matches = text.match(/\{\{\s*(\w+)\s*\}\}/g) || [];
  return matches.map(m => m.replace(/\{\{\s*|\s*\}\}/g, ''));
}

// Valida que las variables usadas en subject+html existan en CONTEXT_VARS[key].
// Devuelve { ok: true } o { ok: false, unknown: [...] }.
function validateTemplateVars(key, subject, htmlTemplate) {
  const allowed = CONTEXT_VARS[key] || [];
  const used = new Set([...extractVars(subject), ...extractVars(htmlTemplate)]);
  const unknown = [...used].filter(v => !allowed.includes(v));
  return { ok: unknown.length === 0, unknown };
}

// ─── API pública ───

/**
 * Lee una plantilla de la tabla email_templates. Si no existe (o la DB falla),
 * cae al DEFAULT_TEMPLATES hardcodeado. Devuelve { name, subject, html_template }
 * o null si la clave no existe en el catálogo.
 */
async function getTemplate(key) {
  const def = DEFAULT_TEMPLATES[key];
  if (!def) return null;
  try {
    const res = await pool.query(
      'SELECT name, subject, html_template FROM email_templates WHERE key = $1',
      [key]
    );
    if (res.rows.length > 0) {
      return {
        name: res.rows[0].name || def.name,
        subject: res.rows[0].subject || def.subject,
        html_template: res.rows[0].html_template || def.html_template,
      };
    }
  } catch (err) {
    // Si la DB no está disponible (ej. test sin DB), usamos el default
    console.warn(`[emailTemplateService] Fallback al default para "${key}": ${err.message}`);
  }
  return { ...def };
}

/**
 * Renderiza una plantilla: la lee (DB o default), sustituye {{variable}} con
 * el contexto, valida que las variables usadas existan en CONTEXT_VARS.
 * Devuelve { subject, html, name } o lanza error si la clave no existe.
 */
async function renderTemplate(key, context = {}) {
  const tpl = await getTemplate(key);
  if (!tpl) {
    const err = new Error(`Plantilla desconocida: ${key}`);
    err.code = 'UNKNOWN_TEMPLATE';
    throw err;
  }
  // Validación: las variables del contexto no necesitan estar todas presentes
  // (algunas pueden ser opcionales), pero las {{}} usadas en la plantilla deben
  // estar declaradas en CONTEXT_VARS para esa clave.
  const allowed = CONTEXT_VARS[key] || [];
  const usedInSubject = extractVars(tpl.subject);
  const usedInHtml = extractVars(tpl.html_template);
  const allUsed = new Set([...usedInSubject, ...usedInHtml]);
  const unknown = [...allUsed].filter(v => !allowed.includes(v));
  if (unknown.length > 0) {
    const err = new Error(`Variables no válidas en plantilla "${key}": ${unknown.join(', ')}`);
    err.code = 'INVALID_VARS';
    err.unknown = unknown;
    throw err;
  }
  const subject = substituteVars(tpl.subject, context);
  const html = substituteVars(tpl.html_template, context);
  return { subject, html, name: tpl.name };
}

/**
 * Lista todas las plantillas con su clave y nombre (para el acordeón del admin).
 */
async function listTemplates() {
  try {
    const res = await pool.query('SELECT key, name, subject, html_template, updated_at FROM email_templates ORDER BY key');
    if (res.rows.length > 0) {
      return res.rows.map(r => ({
        key: r.key,
        name: r.name,
        subject: r.subject,
        html_template: r.html_template,
        updated_at: r.updated_at,
      }));
    }
  } catch (err) {
    console.warn(`[emailTemplateService] listTemplates fallback: ${err.message}`);
  }
  // Fallback: devolver los defaults
  return Object.keys(DEFAULT_TEMPLATES).map(key => ({
    key,
    name: DEFAULT_TEMPLATES[key].name,
    subject: DEFAULT_TEMPLATES[key].subject,
    html_template: DEFAULT_TEMPLATES[key].html_template,
    updated_at: null,
  }));
}

module.exports = {
  CONTEXT_VARS,
  DEFAULT_TEMPLATES,
  renderTemplate,
  getTemplate,
  listTemplates,
  validateTemplateVars,
  substituteVars,
  extractVars,
};
