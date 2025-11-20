const express = require('express');
const router = express.Router();
const {
  generateGamingCodes,
  validateGamingCode,
  redeemGamingCode,
  getMerchantGamingCodes,
  getGamingCodesStatistics,
  bulkDeleteUnusedGamingCodes,getTopRecentWinners,
  getAllGamingCodes,
  setMerchantGamesCodeSellingPermission,
  getGamesCodeSellingMerchants
} = require('../controllers/gaming.controller');
const { authMiddleware, requireAdminOrMerchant, requireAdmin,  } = require('../middleware/auth.middleware');
const { body, query } = require('express-validator');
const { validateGamesMerchantPermission } = require('../utils/validators/codes');

/**
 * @route   GET /api/games/top-winners
 * @desc    Get top 5 recent winners across all games (Coinflip, Lucky Jet, Mines)
 * @access  Public (or Protected if you uncomment authMiddleware)
 * @returns {Object} Success response with top 5 winners array
 
 */
router.get('/top-winners', getTopRecentWinners);

 



/**
 * @route   POST /api/game/generate
 * @desc    Generate gaming codes for merchants (Admin only)
 * @access  Admin
 * 
 * Request Body:
 * {
 *   "merchantUsername": "merchant123",
 *   "quantity": 10,
 *   "amount": 1000
 * }
 */
router.post(
  '/codes/generate',
  authMiddleware,
  requireAdminOrMerchant,
  [
    body('merchantUsername')
      .trim()
      .notEmpty()
      .withMessage('Merchant username is required'),
    body('quantity')
      .isInt({ min: 1, max: 200 })
      .withMessage('Quantity must be between 1 and 200'),
    body('amount')
      .isFloat({ min: 100, max: 100000 })
      .withMessage('Amount must be between ₦100 and ₦100,000'),
  ],
  generateGamingCodes
);

/**
 * @route   POST /api/game/validate
 * @desc    Validate a gaming code (Public)
 * @access  Public
 * 
 * Request Body:
 * {
 *   "code": "GM-MERC-ABC123DEF456"
 * }
 */
router.post(
  '/codes/validate',
  [
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Gaming code is required')
      .matches(/^GM-[A-Z0-9]{4}-[A-Z0-9]{12}$/i)
      .withMessage('Invalid gaming code format'),
  ],
  validateGamingCode
);

/**
 * @route   POST /api/game/redeem
 * @desc    Redeem a gaming code and credit gaming wallet
 * @access  Authenticated users
 * 
  
 */
router.post(
  '/codes/redeem',
  authMiddleware,
  [
    body('code')
      .trim()
      .notEmpty()
      .withMessage('Gaming code is required')
      .matches(/^GM-[A-Z0-9]{4}-[A-Z0-9]{12}$/i)
      .withMessage('Invalid gaming code format'),
  ],
  redeemGamingCode
);

/**
 * @route   GET /api/game/merchant
 * @desc    Get merchant's gaming codes
 * @access  Merchant
 * 
 * Query Params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - status: 'used' | 'unused' (optional)
 */
router.get(
  '/codes/merchant',
  authMiddleware,
  requireAdminOrMerchant,
  [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),
    query('status')
      .optional()
      .isIn(['used', 'unused'])
      .withMessage('Status must be either "used" or "unused"'),
  ],
  getMerchantGamingCodes
);

/**
 * @route   GET /api/game/statistics
 * @desc    Get gaming codes statistics for all merchants
 * @access  Admin
 */
router.get(
  '/codes/statistics',
  authMiddleware,
  requireAdmin,
  getGamingCodesStatistics
);

router.get(
  '/codes/admin/all',
  authMiddleware,
  requireAdmin,
  getAllGamingCodes
);

/**
 * @route   DELETE /api/game/bulk-delete
 * @desc    Bulk delete unused gaming codes
 * @access  Admin
 * 
  
 */
router.delete(
  '/codes/bulk-delete',
  authMiddleware,
  requireAdmin,
  [
    body('merchantId')
      .optional()
      .isUUID()
      .withMessage('Invalid merchant ID format'),
  ],
  bulkDeleteUnusedGamingCodes
);


router.put(
  "/codes/merchant/permission", 
  authMiddleware, 
  requireAdmin, 
  validateGamesMerchantPermission, 
  setMerchantGamesCodeSellingPermission
 
);

router.get(
  "/codes/merchants/code-sellers", 
  authMiddleware,
  requireAdmin,
  getGamesCodeSellingMerchants
);


module.exports = router;