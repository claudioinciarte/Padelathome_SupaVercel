const express = require('express');
const router = express.Router();
const { getOpenMatches, joinOpenMatch, leaveOpenMatch, getMatchParticipants, getMatchDetails, sendMatchMessage } = require('../controllers/matchController');
const { protect } = require('../middleware/authMiddleware');

// GET /api/matches/open - Obtener todas las partidas abiertas disponibles
router.get('/open', protect, getOpenMatches);

// POST /api/matches/:bookingId/join - Unirse a una partida abierta
router.post('/:bookingId/join', protect, joinOpenMatch);

// DELETE /api/matches/:bookingId/leave - Abandonar una partida abierta
router.delete('/:bookingId/leave', protect, leaveOpenMatch);

// GET /api/matches/:bookingId/participants - Ver los participantes de una partida
router.get('/:bookingId/participants', protect, getMatchParticipants);

// GET /api/matches/:bookingId/details - Obtener detalles e historial de chat de una partida
router.get("/:bookingId/details", protect, getMatchDetails);

// POST /api/matches/:bookingId/messages - Enviar un mensaje al chat de la partida (REST, para serverless)
router.post("/:bookingId/messages", protect, sendMatchMessage);

module.exports = router;