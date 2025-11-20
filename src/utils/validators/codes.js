const { body, query } = require("express-validator");

const generateCodesValidation = [
  body('merchantUsername')
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage('Merchant username must be between 3 and 50 characters'),
  body('packageType')
    .isIn(['Amateur', 'Pro'])
    .withMessage('Package type must be either Amateur or Pro'),
  body('quantity')
    .isInt({ min: 1, max: 50 })
    .withMessage('Quantity must be between 1 and 50')
];

const validateCodeValidation = [
  body('code')
    .trim()
    .isLength({ min: 8, max: 20 })
    .withMessage('Package code must be between 8 and 20 characters')
    .matches(/^[A-Z0-9]+$/i)
    .withMessage('Package code must contain only letters and numbers')
];

const merchantCodesValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['used', 'unused']).withMessage('Status must be either used or unused'),
  query('packageType').optional().isIn(['Amateur', 'Pro']).withMessage('Package type must be either Amateur or Pro')
];

const bulkDeleteValidation = [
  body('merchantId').optional().isUUID().withMessage('Merchant ID must be a valid UUID'),
  body('packageType').optional().isIn(['Amateur', 'Pro']).withMessage('Package type must be either Amateur or Pro')
];


// Validation for delete codes endpoint
const validateDeleteCodes = [
  body("merchantUsername")
    .trim()
    .notEmpty()
    .withMessage("Merchant username is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Merchant username must be 3-50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Merchant username can only contain letters, numbers, and underscores"),
  
  body("packageType")
    .optional()
    .isIn(["Amateur", "Pro"])
    .withMessage("Package type must be either 'Amateur' or 'Pro'"),
  
  body("quantity")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Quantity must be between 1 and 100"),
];

// Validation for setting merchant permission
const validateGamesMerchantPermission = [
  body("merchantUsername")
    .trim()
    .notEmpty()
    .withMessage("Merchant username is required")
    .isLength({ min: 3, max: 50 })
    .withMessage("Merchant username must be 3-50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Merchant username can only contain letters, numbers, and underscores"),
  
  body("canSellCodes")
    .isBoolean()
    .withMessage("canSellCodes must be a boolean value (true or false)"),
];

module.exports = {
    bulkDeleteValidation,merchantCodesValidation, validateCodeValidation, generateCodesValidation, validateDeleteCodes, validateGamesMerchantPermission
}