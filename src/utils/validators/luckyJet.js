
const { body, param } = require('express-validator');

const luckyJetValidators = {
  startGame: [
    body('stake_amount')
      .notEmpty()
      .withMessage('Stake amount is required')
      .isFloat({ min: 0.01 })
      .withMessage('Stake amount must be a positive number')
      .toFloat()
  ],

  processResult: [
    param('roundId')
      .notEmpty()
      .withMessage('Round ID is required')
      .isUUID()
      .withMessage('Invalid round ID format'),
    
    body('current_multiplier')
      .notEmpty()
      .withMessage('Current multiplier is required')
      .isFloat({ min: 1.0 })
      .withMessage('Current multiplier must be at least 1.0x')
      .toFloat()
  ]
};

module.exports = luckyJetValidators;