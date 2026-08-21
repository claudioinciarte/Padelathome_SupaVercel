// Verificación end-to-end HTTP contra el servidor local (:3978) + DB Supabase real.
// Sub-tarea 8 del plan Padel@Home.
const http = require('http');
const jwt = require('jsonwebtoken');

const PORT = 3978;
const JWT_SECRET = 'verify-test-secret-123456789012345678901234567890';

// Generar un token admin válido para las peticiones protegidas
const adminToken = jwt.sign(
  { id: 1, role: 'admin', name: 'Verify Admin', email: 'verify@test.local' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(buf); } catch { /* texto */ }
        resolve({ status: res.statusCode, body: buf, json: parsed });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const results = [];
  const log = (name, ok, detail) => results.push({ name, ok, detail });

  // --- 0. Healthcheck ---
  let r = await req('GET', '/api/health', null, null);
  log('Healthcheck 200', r.status === 200, `status=${r.status}`);

  // --- 1. GET /api/admin/email-templates SIN token → 401 ---
  r = await req('GET', '/api/admin/email-templates', null, null);
  log('GET sin token → 401', r.status === 401, `status=${r.status}`);

  // --- 2. GET /api/admin/email-templates CON token admin → 200 y 7 items ---
  r = await req('GET', '/api/admin/email-templates', null, adminToken);
  const got7 = r.status === 200 && Array.isArray(r.json) && r.json.length === 7;
  log('GET con admin → 200 y 7 plantillas', got7,
    `status=${r.status} count=${r.json ? r.json.length : 0}`);
  if (r.json && Array.isArray(r.json)) {
    r.json.forEach(t => {
      const hasVars = Array.isArray(t.available_vars);
      log(`  ${t.key} tiene available_vars`, hasVars,
        `vars=${hasVars ? t.available_vars.join(',') : 'N/A'}`);
    });
  }

  // --- 3. PUT con {{variable}} inválida → 400 ---
  r = await req('PUT', '/api/admin/email-templates/account.approved', {
    subject: 'Test {{foo}}',
    html_template: '<p>Hola {{userName}}, {{bar}}</p>',
  }, adminToken);
  const bad400 = r.status === 400 && r.json && Array.isArray(r.json.unknown_vars);
  log('PUT con {{var}} inválida → 400 + unknown_vars', bad400,
    `status=${r.status} unknown=${r.json ? JSON.stringify(r.json.unknown_vars) : ''}`);

  // --- 4. PUT con {{variable}} válida → 200 ---
  const validSubject = 'Test válido {{userName}}';
  const validHtml = '<h2>Bienvenido {{userName}}</h2><p>Edición de prueba.</p>';
  r = await req('PUT', '/api/admin/email-templates/account.approved', {
    subject: validSubject,
    html_template: validHtml,
  }, adminToken);
  const ok200 = r.status === 200 && r.json && r.json.key === 'account.approved';
  log('PUT con {{var}} válida → 200 + devuelve plantilla', ok200,
    `status=${r.status} key=${r.json ? r.json.key : ''}`);

  // --- 5. Persistencia: GET releer y comprobar que la edición quedó ---
  r = await req('GET', '/api/admin/email-templates', null, adminToken);
  let persisted = false;
  if (r.status === 200 && Array.isArray(r.json)) {
    const t = r.json.find(x => x.key === 'account.approved');
    if (t) {
      persisted = t.subject === validSubject && t.html_template === validHtml;
      log('Edición persiste al releer (GET)', persisted,
        `subject_match=${t.subject === validSubject} html_match=${t.html_template === validHtml}`);
    }
  }
  if (!persisted) log('Edición persiste al releer (GET)', false, 'no encontrado');

  // --- 6. Render real: llamar renderTemplate desde el servicio ---
  // Simulamos un disparo de correo sin enviarlo (solo comprobamos el HTML sustituido).
  const { renderTemplate } = require('../src/services/emailTemplateService');
  try {
    const rendered = await renderTemplate('account.approved', { userName: 'Jose Verificando' });
    const subjOk = rendered.subject.includes('Jose Verificando');
    const htmlOk = rendered.html.includes('Jose Verificando');
    log('renderTemplate sustituye {{userName}} en subject+html', subjOk && htmlOk,
      `subject="${rendered.subject}" html_has_name=${htmlOk}`);
  } catch (e) {
    log('renderTemplate sustituye {{userName}}', false, e.message);
  }

  // --- 7. Render de plantilla booking.confirm: subject con {{date}}, html con {{userName}} ---
  try {
    const rendered = await renderTemplate('booking.confirm', { userName: 'Ana', date: 'lunes 25' });
    // El subject usa {{date}} → debe contener "lunes 25"
    const subjOk = rendered.subject.includes('lunes 25');
    // El HTML usa {{userName}} → debe contener "Ana"
    const htmlOk = rendered.html.includes('Ana');
    log('renderTemplate booking.confirm: subject con date, html con userName', subjOk && htmlOk,
      `subject="${rendered.subject}" html_has_ana=${htmlOk} subj_has_date=${subjOk}`);
  } catch (e) {
    log('renderTemplate booking.confirm', false, e.message);
  }

  // --- 8. Restaurar la plantilla account.approved a su valor original (limpieza) ---
  const { DEFAULT_TEMPLATES } = require('../src/services/emailTemplateService');
  const def = DEFAULT_TEMPLATES['account.approved'];
  r = await req('PUT', '/api/admin/email-templates/account.approved', {
    subject: def.subject,
    html_template: def.html_template,
  }, adminToken);
  log('Restaurar account.approved al default (limpieza)', r.status === 200,
    `status=${r.status}`);

  // --- Resumen ---
  console.log('\n========= RESULTADOS VERIFICACIÓN E2E =========');
  let pass = 0, fail = 0;
  results.forEach(r => {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`);
    if (r.ok) pass++; else fail++;
  });
  console.log(`\nTotal: ${pass} PASS, ${fail} FAIL de ${results.length}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('Fatal:', e); process.exit(2); });
