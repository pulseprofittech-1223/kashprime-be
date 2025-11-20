
const { body, param } = require('express-validator');

/**
 * Validation rules for starting a Mines game
 */
const startGameValidation = [
  body('stake_amount')
    .notEmpty()
    .withMessage('Stake amount is required')
    .isFloat({ min: 0.01 })
    .withMessage('Stake amount must be a positive number')
    .toFloat(),
  
  body('bomb_count')
    .notEmpty()
    .withMessage('Bomb count is required')
    .isInt()
    .withMessage('Bomb count must be an integer')
    .isIn([4, 6, 8, 10])
    .withMessage('Bomb count must be either 4, 6, 8, or 10')
    .toInt()
];

/**
 * Validation rules for cashing out / ending game
 */
const cashoutValidation = [
  param('roundId')
    .notEmpty()
    .withMessage('Round ID is required')
    .isUUID()
    .withMessage('Invalid round ID format'),
  
  body('successful_clicks')
    .notEmpty()
    .withMessage('Successful clicks is required')
    .isInt({ min: 0 })
    .withMessage('Successful clicks must be a non-negative integer')
    .toInt(),
  
  body('hit_bomb')
    .notEmpty()
    .withMessage('Hit bomb status is required')
    .isBoolean()
    .withMessage('Hit bomb must be a boolean value')
    .toBoolean()
];

/**
 * Validation rules for getting game history
 */
const historyValidation = [
  body('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  body('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  body('status')
    .optional()
    .isIn(['active', 'cashed_out', 'hit_bomb'])
    .withMessage('Invalid status. Must be active, cashed_out, or hit_bomb')
];

/**
 * Validation rules for round ID parameter
 */
const roundIdValidation = [
  param('roundId')
    .notEmpty()
    .withMessage('Round ID is required')
    .isUUID()
    .withMessage('Invalid round ID format')
];

module.exports = {
  startGameValidation,
  cashoutValidation,
  historyValidation,
  roundIdValidation
};