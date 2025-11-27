const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query } = require('express-validator');
const router = express.Router();

const withdrawalController = require('../controllers/withdrawal.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

 

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/withdrawal/request
 * Create withdrawal request
 */
router.post('/request',   [
  body('amount')
    .isFloat({ min: 1000, max: 1000000 })
    .withMessage('Amount must be between ₦1,000 and ₦1,000,000'),
  body('transaction_pin')
    .isLength({ min: 4, max: 6 })
    .matches(/^\d+$/)
    .withMessage('Transaction PIN must be 4-6 digits'),
 
  body('balance_type')
    .isIn(['coins_balance', 'games_balance', 'referral_balance', 'investment_balance'])
    .withMessage('Invalid balance type'),
], withdrawalController.createWithdrawalRequest);

 

/**
 * GET /api/withdrawal/history
 * Get user's withdrawal history
 */
router.get('/history', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn(['pending', 'completed', 'cancelled'])
], withdrawalController.getUserWithdrawals);

 

module.exports = router;