const { body, query } = require('express-validator');

const playGame = [
  body('stake_amount')
    .notEmpty().withMessage('Stake amount is required')
    .isFloat({ min: 0.01 }).withMessage('Stake amount must be a positive number'),
];

const getHistory = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('status').optional().isIn(['won', 'lost']).withMessage('Status must be won or lost'),
];

module.exports = { playGame, getHistory };
