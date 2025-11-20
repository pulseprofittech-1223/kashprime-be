
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const coinflipController = require('../controllers/coinflip.controller');
const coinflipValidators = require('../utils/validators/coinflip');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');

// Rate limiter for game play (30 requests per minute)
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

// ==================== PUBLIC ROUTES (Authenticated Users) ====================

/**
 * @route   GET /api/coinflip/settings
 * @desc    Get coinflip game settings
 * @access  Private (Authenticated users)
 */
router.get('/settings', authMiddleware, coinflipController.getSettings);

/**
 * @route   POST /api/coinflip/start
 * @desc    Play coinflip game (instant result)
 * @access  Private (Authenticated users)
 */
router.post(
  '/start',
  authMiddleware,
  gameLimiter,
  coinflipValidators.playGame,
  coinflipController.playGame
);

/**
 * @route   GET /api/coinflip/history
 * @desc    Get user's game history with pagination
 * @access  Private (Authenticated users)
 */
router.get(
  '/history',
  authMiddleware,
  coinflipValidators.getHistory,
  coinflipController.getHistory
);

/**
 * @route   GET /api/coinflip/statistics
 * @desc    Get user's game statistics
 * @access  Private (Authenticated users)
 */
router.get('/statistics', authMiddleware, coinflipController.getStatistics);

// ==================== ADMIN ROUTES ====================

/**
 * @route   GET /api/coinflip/admin/statistics
 * @desc    Get comprehensive admin statistics
 * @access  Private (Admin only)
 */
router.get('/admin/statistics', authMiddleware, requireAdmin, coinflipController.getAdminStatistics);

module.exports = router;