const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');
const ctrl       = require('../controllers/higherLower.controller');
const { body, validationResult } = require('express-validator');

const router  = express.Router();
const limiter = rateLimit({ windowMs: 60000, max: 30, message: { status: 'error', message: 'Too many requests. Please slow down.' } });

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ status: 'error', message: 'Validation error', data: { errors: errors.array().map(e => ({ field: e.path, message: e.msg })) } });
  next();
};

router.post('/start',           authMiddleware, limiter, ctrl.startRound);
router.post('/bet',             authMiddleware, limiter,
  [body('round_id').isUUID().withMessage('Valid round_id required'), body('stake_amount').isFloat({ min: 0.01 }).withMessage('Stake must be positive'), body('direction').isIn(['higher','lower']).withMessage('Direction must be higher or lower')],
  validate, ctrl.placeBet);
router.get('/history',          authMiddleware, ctrl.getHistory);
router.get('/statistics',       authMiddleware, ctrl.getStatistics);
router.get('/admin/statistics', authMiddleware, requireAdmin, ctrl.getAdminStatistics);

module.exports = router;
