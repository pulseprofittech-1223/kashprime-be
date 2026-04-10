const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');
const ctrl = require('../controllers/plinko.controller');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const limiter = rateLimit({ windowMs: 60000, max: 30, message: { status: 'error', message: 'Too many requests' } });

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({
    status: 'error', message: 'Validation error',
    data: { errors: errors.array().map(e => ({ field: e.path, message: e.msg })) }
  });
  next();
};

router.get('/settings',         authMiddleware, ctrl.getSettings);
router.post('/play',            authMiddleware, limiter, [
  body('stake_amount').isFloat({ min: 0.01 }).withMessage('Stake must be positive'),
  body('risk_level').isIn(['low','med','high']).withMessage('Invalid risk level'),
  body('rows').isIn([8, 12, 16]).withMessage('Rows must be 8, 12, or 16'),
], validate, ctrl.playGame);
router.get('/history',          authMiddleware, ctrl.getHistory);
router.get('/statistics',       authMiddleware, ctrl.getStatistics);
router.get('/admin/statistics', authMiddleware, requireAdmin, ctrl.getAdminStatistics);

module.exports = router;
