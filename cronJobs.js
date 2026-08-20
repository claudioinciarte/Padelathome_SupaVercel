const cron = require('node-cron');
const {
  cleanIncompleteOpenMatches,
  processExpiredWaitlistEntries,
} = require('./src/controllers/cronController');

/**
 * Inicializa los cron jobs del sistema.
 * SOLO para despliegues con proceso persistente (Raspberry Pi / Docker).
 * En Vercel serverless, estas tareas se ejecutan vía HTTP:
 *   POST /api/cron/open-matches-cleanup
 *   POST /api/cron/waiting-list
 * (programadas por GitHub Actions con el header X-Cron-Secret).
 *
 * Paridad: en Docker se ejecutan los mismos dos jobs cada 30 minutos
 * (mismo intervalo que el workflow .github/workflows/cron.yml de Vercel).
 */
function initCronJobs() {
    // Limpieza de partidas abiertas incompletas (cada 30 minutos)
    cron.schedule('*/30 * * * *', () => {
        cleanIncompleteOpenMatches().catch(err =>
            console.error('Error en cron open-matches-cleanup:', err)
        );
    });
    console.log('Cron Jobs inicializados: limpiarPartidasIncompletas programado cada 30 minutos.');

    // Procesamiento de lista de espera expirada (cada 30 minutos)
    cron.schedule('*/30 * * * *', () => {
        processExpiredWaitlistEntries().catch(err =>
            console.error('Error en cron waiting-list:', err)
        );
    });
    console.log('Cron Jobs inicializados: procesarListaDeEspera programado cada 30 minutos.');
}

module.exports = {
    initCronJobs
};
