const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, query } = require('express-validator');
const router = express.Router();

const transferController = require('../controllers/transfer.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Rate limiting
const transferLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 transfers per hour
  message: {
    status: 'error',
    message: 'Too many transfer requests, please try again later.'
  }
});

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/transfer/to-gaming
 * Transfer from withdrawable earnings to gaming wallet
 */
router.post('/to-gaming', transferLimiter, [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Amount must be greater than zero'),
  body('transaction_pin')
    .isLength({ min: 4, max: 6 })
    .matches(/^\d+$/)
    .withMessage('Transaction PIN must be 4-6 digits')
], transferController.transferToGamingWallet);

/**
 * GET /api/transfer/history
 * Get user's transfer history
 */
router.get('/history', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], transferController.getTransferHistory);

/**
 * GET /api/transfer/info
 * Get transfer eligibility and balance information
 */
router.get('/info', transferController.getTransferInfo);

module.exports = router;