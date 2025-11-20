
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');
const minesController = require('../controllers/mines.controller');
const minesValidators = require('../utils/validators/mines');

// ==================== RATE LIMITERS ====================

// Game action rate limiter (30 requests per minute)
const gameLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: {
    status: 'error',
    message: 'Too many game requests. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ==================== PUBLIC/USER ROUTES ====================

/**
 * Get game settings
 * GET /api/mines/settings
 * Access: Authenticated users
 */
router.get('/settings', authMiddleware, minesController.getGameSettings);

/**
 * Start new game
 * POST /api/mines/start
 * Access: Authenticated users
 * Rate Limited: 30 per minute
 */
router.post(
  '/start',
  authMiddleware,
  gameLimiter,
  minesValidators.startGameValidation,
  minesController.startGame
);

/**
 * Process game result (cashout or hit bomb)
 * POST /api/mines/:roundId/result
 * Access: Authenticated users
 * Rate Limited: 30 per minute
 */
router.post(
  '/:roundId/result',
  authMiddleware,
  gameLimiter,
  minesValidators.cashoutValidation,
  minesController.processGameResult
);

/**
 * Get user's game history
 * GET /api/mines/history
 * Query params: page, limit, status
 * Access: Authenticated users
 */
router.get('/history', authMiddleware, minesController.getGameHistory);

/**
 * Get user's game statistics
 * GET /api/mines/statistics
 * Access: Authenticated users
 */
router.get('/statistics', authMiddleware, minesController.getUserStatistics);

// ==================== ADMIN ROUTES ====================

/**
 * Get admin statistics
 * GET /api/mines/admin/statistics
 * Access: Admin only
 */
router.get(
  '/admin/statistics',
  authMiddleware,
  requireAdmin,
  minesController.getAdminStatistics
);

module.exports = router;