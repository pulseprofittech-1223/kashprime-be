
const { body, query } = require('express-validator');

/**
 * Validation rules for playing coinflip game
 */
const playGame = [
  body('stake_amount')
    .isFloat({ min: 0.01 })
    .withMessage('Stake amount must be a positive number')
    .custom((value) => {
      if (value > 10000000) {
        throw new Error('Stake amount too large');
      }
      return true;
    }),
  
  body('user_choice')
    .trim()
    .toLowerCase()
    .isIn(['heads', 'tails'])
    .withMessage('User choice must be either "heads" or "tails"')
];

/**
 * Validation rules for getting game history
 */
const getHistory = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  query('status')
    .optional()
    .isIn(['won', 'lost'])
    .withMessage('Status must be either "won" or "lost"')
];

module.exports = {
  playGame,
  getHistory
};