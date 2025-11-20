const express = require('express');
const router = express.Router();
const raffleController = require('../controllers/raffle.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');
const rateLimit = require('express-rate-limit');

// ==================== RATE LIMITERS ====================

// Purchase ticket rate limiter  
const purchaseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Max 10 purchase attempts per hour
  message: {
    status: 'error',
    message: 'Too many ticket purchase attempts. Please try again later.'
  }
});

// Cron endpoint rate limiter
const cronLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 calls per 15 minutes
  message: {
    status: 'error',
    message: 'Too many cron requests'
  }
});

// ==================== USER ROUTES ====================

// Purchase raffle ticket
router.post('/purchase', authMiddleware, purchaseLimiter, raffleController.purchaseTicket);

// Get user's tickets for today
router.get('/my-tickets', authMiddleware, raffleController.getMyTickets);

// Get raffle dashboard data (top 10 entries, past winners, countdown)
router.get('/dashboard', authMiddleware, raffleController.getRaffleDashboard);

// Get today's draw results
router.get('/results', authMiddleware, raffleController.getDrawResults);

// ==================== ADMIN ROUTES ====================

// Get draw overview for today (all tickets, digit breakdown, suggested winners)
router.get('/admin/draw-overview', authMiddleware, requireAdmin, raffleController.getAdminDrawOverview);

// Manually select winning digit (Option A)
router.post('/admin/select-winners', authMiddleware, requireAdmin, raffleController.selectWinnersManually);

// Approve suggested winners (from 8 PM processing)
router.post('/admin/approve-suggested', authMiddleware, requireAdmin, raffleController.approveSuggestedWinners);

// Select no winner (generate fake winner)
router.post('/admin/no-winner', authMiddleware, requireAdmin, raffleController.selectNoWinner);

// Specify minimum winners (Option B)
router.post('/admin/minimum-winners', authMiddleware, requireAdmin, raffleController.selectMinimumWinners);

// Get raffle statistics
router.get('/admin/statistics', authMiddleware, requireAdmin, raffleController.getRaffleStatistics);

// ==================== CRON ROUTES (PROTECTED) ====================

// Process draw at 8:00 PM
router.post('/cron/process-draw', cronLimiter, raffleController.cronProcessDraw);

// Auto-finalize at 8:30 PM
router.post('/cron/auto-finalize', cronLimiter, raffleController.cronAutoFinalize);

module.exports = router;