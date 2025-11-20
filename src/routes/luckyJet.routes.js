// src/routes/luckyJet.routes.js

const express = require('express');
const router = express.Router();
const luckyJetController = require('../controllers/luckyJet.controller');
const luckyJetValidators = require('../utils/validators/luckyJet');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');

 

// ==================== USER ENDPOINTS ====================

// Get game settings
router.get('/settings', authMiddleware, luckyJetController.getGameSettings);

// Start new game round
router.post(
  '/start',
  authMiddleware,
   
  luckyJetValidators.startGame,
  luckyJetController.startGame
);

// Process game result (win or loss)
router.post(
  '/:roundId/result',
  authMiddleware,
   
  luckyJetValidators.processResult,
  luckyJetController.processGameResult
);

// Get game history
router.get('/history', authMiddleware, luckyJetController.getGameHistory);

// Get user statistics
router.get('/statistics', authMiddleware, luckyJetController.getUserStatistics);

// Get admin statistics
router.get(
  '/admin/statistics',
  authMiddleware,
  requireAdmin,
  luckyJetController.getAdminStatistics
);


module.exports = router;