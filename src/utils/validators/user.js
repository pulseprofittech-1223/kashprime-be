const { query,body } = require("express-validator");

// Validation for transaction queries
const validateTransactionQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("type")
    .optional()
    .isIn([
      "deposit",
      "withdrawal",
      "reward",
      "referral",
      "gaming",
      "commission",
      "welcome_bonus",
    ])
    .withMessage("Invalid transaction type"),
  query("earning_type")
    .optional()
    .isIn(["growth_bonus", "tier1", "tier2", "manager", "voxcoin"])
    .withMessage("Invalid earning type"),
];

// Validation for activity summary
const validateActivityQuery = [
  query("days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Days must be between 1 and 365"),
];

const upgradeValidation = [
  body('upgradeCode')
    .trim()
    .notEmpty()
    .withMessage('Upgrade code is required')
    .isLength({ min: 8, max: 50 })
    .withMessage('Upgrade code must be between 8 and 50 characters')
    .matches(/^[A-Z0-9]+$/i)
    .withMessage('Upgrade code must contain only letters and numbers'),
];

module.exports = {
  validateTransactionQuery,
  validateActivityQuery,upgradeValidation
};
