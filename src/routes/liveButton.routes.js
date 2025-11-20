
const express = require('express');
const router = express.Router();
const liveButtonController = require('../controllers/liveButton.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');

 
 

// ============================================
// User Routes (Protected)
// ============================================

/**
 * @route   POST /api/live-button/click
 * @desc    Claim live button reward (once per day)
 * @access  Private (Authenticated users with TikTok handle)
 */
router.post('/click', authMiddleware,   liveButtonController.clickLiveButton);

/**
 * @route   GET /api/live-button/status
 * @desc    Check if user can claim live button reward today
 * @access  Private
 */
router.get('/status', authMiddleware,   liveButtonController.getLiveButtonStatus);

/**
 * @route   GET /api/live-button/history
 * @desc    Get user's live button claim history
 * @access  Private
 */
router.get('/history', authMiddleware, liveButtonController.getLiveButtonHistory);

// ============================================
// Admin Routes
// ============================================

/**
 * @route   GET /api/live-button/admin/statistics
 * @desc    Get live button feature statistics
 * @access  Private (Admin only)
 */
router.get('/admin/statistics', authMiddleware, requireAdmin, liveButtonController.getLiveButtonStatistics);

module.exports = router;