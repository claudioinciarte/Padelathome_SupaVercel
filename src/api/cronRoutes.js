const express = require('express');
const router = express.Router();
const {
  openMatchesCleanupHandler,
  waitingListHandler,
} = require('../controllers/cronController');

// POST /api/cron/open-matches-cleanup - Cancela partidas abiertas incompletas a punto de empezar
// Protegido por el header X-Cron-Secret (variable CRON_SECRET).
router.post('/open-matches-cleanup', openMatchesCleanupHandler);

// POST /api/cron/waiting-list - Procesa turnos expirados de la lista de espera
router.post('/waiting-list', waitingListHandler);

module.exports = router;
