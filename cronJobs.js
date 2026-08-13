const cron = require('node-cron');
const { cleanIncompleteOpenMatches } = require('./src/controllers/cronController');

/**
 * Inicializa los cron jobs del sistema.
 * SOLO para despliegues con proceso persistente (Raspberry Pi / Docker).
 * En Vercel serverless, estas tareas se ejecutan vía HTTP:
 *   POST /api/cron/open-matches-cleanup
 *   POST /api/cron/waiting-list
 * (programadas por GitHub Actions con el header X-Cron-Secret).
 */
function initCronJobs() {
    // Programar la ejecución cada 30 minutos
    cron.schedule('*/30 * * * *', () => {
        cleanIncompleteOpenMatches();
    });
    console.log('Cron Jobs inicializados: limpiarPartidasIncompletas programado cada 30 minutos.');
}

module.exports = {
    initCronJobs
};
