const express = require('express');
const router = express.Router();
const { subscribe, unsubscribe, getConfig } = require('../controllers/pushController');
const { protect } = require('../middleware/authMiddleware');

// Config pública del cliente (clave VAPID pública)
router.get('/config', getConfig);

// Suscripción del dispositivo del usuario logueado
router.post('/subscribe', protect, subscribe);
router.delete('/subscribe', protect, unsubscribe);

module.exports = router;
