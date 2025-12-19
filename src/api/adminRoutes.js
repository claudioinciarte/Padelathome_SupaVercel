const express = require('express');
const router = express.Router();
const {
  getAllUsers,
  approveUser,
  updateUserStatus,
  inviteUser,
  createBuilding,
  getAllBuildings,
  updateBuilding,
  deleteBuilding,
  createCourt,
  getAllCourts,
  updateCourt,
  deleteCourt,
  createBlockedPeriod,
  deleteBlockedPeriod,
  getBlockedPeriods,
  getSettings,
  updateSettings,
  getDashboardStats,
  resetUserPassword,
  updateUserRole,
} = require('../controllers/adminController');
const { protect, isAdmin } = require('../middleware/authMiddleware');

// Rutas de Gestión de Usuarios
router.get('/users', protect, isAdmin, getAllUsers);
router.post('/users/invite', protect, isAdmin, inviteUser);
router.put('/users/:userId/approve', protect, isAdmin, approveUser);
router.put('/users/:userId/status', protect, isAdmin, updateUserStatus);
router.post('/users/:userId/reset-password', protect, isAdmin, resetUserPassword);
router.put('/users/:userId/role', protect, isAdmin, updateUserRole);

// Rutas de Gestión de Edificios (CRUD)
router.post('/buildings', protect, isAdmin, createBuilding);
router.get('/buildings', protect, isAdmin, getAllBuildings);
router.put('/buildings/:buildingId', protect, isAdmin, updateBuilding);
router.delete('/buildings/:buildingId', protect, isAdmin, deleteBuilding);

// Rutas de Gestión de Pistas (CRUD)
router.post('/courts', protect, isAdmin, createCourt);
router.get('/courts', protect, isAdmin, getAllCourts);
router.put('/courts/:courtId', protect, isAdmin, updateCourt);
router.delete('/courts/:courtId', protect, isAdmin, deleteCourt);

// Rutas de Gestión de Bloqueos
router.get('/blocked-periods', protect, isAdmin, getBlockedPeriods);
router.post('/blocked-periods', protect, isAdmin, createBlockedPeriod);
router.delete('/blocked-periods/:blockedPeriodId', protect, isAdmin, deleteBlockedPeriod);

// Rutas de Gestión de Ajustes
router.get('/settings', protect, isAdmin, getSettings);
router.put('/settings', protect, isAdmin, updateSettings);

// Rutas de Estadísticas
router.get('/stats', protect, isAdmin, getDashboardStats);

module.exports = router;