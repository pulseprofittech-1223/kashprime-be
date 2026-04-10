const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');
const spinWheelController = require('../controllers/spinWheel.controller');
const spinWheelValidators = require('../utils/validators/spinWheel');
const { validationResult } = require('express-validator');

const router = express.Router();

const gameLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { status: 'error', message: 'Too many requests. Please slow down.' },
});

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation error',
      data: { errors: errors.array().map(e => ({ field: e.path, message: e.msg })) },
    });
  }
  next();
};

router.get('/settings',           authMiddleware, spinWheelController.getSettings);
router.post('/play',              authMiddleware, gameLimiter, spinWheelValidators.playGame, handleValidation, spinWheelController.playGame);
router.get('/history',            authMiddleware, spinWheelValidators.getHistory, handleValidation, spinWheelController.getHistory);
router.get('/statistics',         authMiddleware, spinWheelController.getStatistics);
router.get('/admin/statistics',   authMiddleware, requireAdmin, spinWheelController.getAdminStatistics);

module.exports = router;
