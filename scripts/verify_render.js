// Simula un disparo real de correo (booking.confirm) sin enviarlo.
// Stub de sendEmail para capturar el HTML y comprobar que las variables
// se sustituyen correctamente en un flujo equivalente al de bookingController.
const path = require('path');
// Cargar .env.verify para que DATABASE_URL esté disponible
require('dotenv').config({ path: path.join(__dirname, '..', '.env.verify') });

const { renderTemplate } = require('../src/services/emailTemplateService');

(async () => {
  const results = [];
  const log = (name, ok, detail) => results.push({ name, ok, detail });

  // --- Simular contexto de bookingController.createBooking ---
  const bookingStartTime = new Date('2026-08-25T18:00:00+02:00');
  const context = {
    userName: 'Jose Verificando',
    date: bookingStartTime.toLocaleDateString('es-ES'),
  };

  // 1. Render del subject con {{date}} → debe contener la fecha local
  const rendered = await renderTemplate('booking.confirm', context);
  const dateStr = context.date;
  const subjOk = rendered.subject.includes(dateStr);
  log(`subject contiene "${dateStr}"`, subjOk, `subject="${rendered.subject}"`);

  // 2. Render del HTML con {{userName}} → debe contener "Jose Verificando"
  const htmlOk = rendered.html.includes('Jose Verificando');
  log('html contiene "Jose Verificando"', htmlOk, `html snippet="${rendered.html.substring(0,80)}..."`);

  // 3. El HTML no debe contener {{}} sin sustituir (todas las vars del catálogo resueltas)
  const unresolved = (rendered.html.match(/\{\{[^}]+\}\}/g) || []);
  log('html sin {{}} sin resolver', unresolved.length === 0, `unresolved=${JSON.stringify(unresolved)}`);

  // 4. El subject tampoco debe tener {{}} sin resolver
  const subjUnresolved = (rendered.subject.match(/\{\{[^}]+\}\}/g) || []);
  log('subject sin {{}} sin resolver', subjUnresolved.length === 0, `unresolved=${JSON.stringify(subjUnresolved)}`);

  // 5. Simular el adjunto .ics: verificar que el flujo de bookingController
  // pasaría attachments correctamente. Solo comprobamos que renderTemplate
  // devuelve lo que sendEmail({to, subject, html, attachments}) usaría.
  log('renderTemplate devuelve {subject, html}', typeof rendered.subject === 'string' && typeof rendered.html === 'string',
    `types=${typeof rendered.subject},${typeof rendered.html}`);

  // --- Simular disparo de waitlist.slot (3 archivos distintos, misma clave) ---
  const waitlistCtx = {
    userName: 'Ana Lista',
    slotTime: 'lunes 25 de agosto, 18:00',
    confirmationUrl: 'https://padelathome.example/confirm?token=abc123',
  };
  const wlRendered = await renderTemplate('waitlist.slot', waitlistCtx);
  const wlOk = wlRendered.html.includes('Ana Lista') &&
               wlRendered.html.includes('lunes 25 de agosto, 18:00') &&
               wlRendered.html.includes('https://padelathome.example/confirm?token=abc123');
  log('waitlist.slot sustituye userName+slotTime+confirmationUrl', wlOk,
    `name=${wlRendered.html.includes('Ana Lista')} slot=${wlRendered.html.includes('lunes 25 de agosto')} url=${wlRendered.html.includes('abc123')}`);

  // --- Simular disparo de match.cancel (unificado, 3 orígenes) ---
  const matchCtx = {
    userName: 'Carlos Partido',
    formattedDate: 'martes 26 de agosto',
    cancelReason: 'No se alcanzó el mínimo de jugadores (2/4).',
  };
  const mcRendered = await renderTemplate('match.cancel', matchCtx);
  const mcOk = mcRendered.html.includes('Carlos Partido') &&
               mcRendered.html.includes('martes 26 de agosto') &&
               mcRendered.html.includes('No se alcanzó el mínimo');
  log('match.cancel sustituye userName+formattedDate+cancelReason', mcOk,
    `name=${mcRendered.html.includes('Carlos Partido')} date=${mcRendered.html.includes('martes 26 de agosto')} reason=${mcRendered.html.includes('No se alcanzó el mínimo')}`);

  // --- Resumen ---
  console.log('\n========= DISPARO REAL SIMULADO =========');
  let pass = 0, fail = 0;
  results.forEach(r => {
    console.log(`${r.ok ? 'PASS' : 'FAIL'} — ${r.name}${r.detail ? '  [' + r.detail + ']' : ''}`);
    if (r.ok) pass++; else fail++;
  });
  console.log(`\nTotal: ${pass} PASS, ${fail} FAIL de ${results.length}`);
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('Fatal:', e); process.exit(2); });
