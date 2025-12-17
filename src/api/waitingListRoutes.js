const express = require('express');
const router = express.Router();
const { joinWaitingList, confirmBookingFromWaitlist, getUserWaitingListEntries, withdrawFromWaitingList } = require('../controllers/waitingListController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/waiting-list/me - Obtener las listas de espera del usuario
router.get('/me', protect, getUserWaitingListEntries);

// POST /api/waiting-list - Apuntarse a la lista de espera
router.post('/', protect, joinWaitingList);

// DELETE /api/waiting-list - Retirarse de la lista de espera
router.delete('/', protect, withdrawFromWaitingList);

// POST /api/waiting-list/confirm - Confirmar la reserva desde el email
router.post('/confirm', confirmBookingFromWaitlist);

module.exports = router;