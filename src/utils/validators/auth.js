const { body } = require('express-validator');
const MESSAGES = require('../constants/messages');

// Registration validation
const validateRegistration = [
  body('email')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),

  body('username')
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3-20 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),

  body('fullName')
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2-100 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Full name can only contain letters and spaces')
    .trim(),
  
  body('phoneNumber')
    .isMobilePhone()
    .withMessage('Please enter a valid phone number'),

  body('referral')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Referral code is too long')
    // .matches(/^[A-Z0-9]*$/)
    // .withMessage('Referral code must contain only uppercase letters and numbers')
    .trim()
];

// Login validation
const validateLogin = [
  body('credential')
    .notEmpty()
    .withMessage('Email or username is required')
    .trim(),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Forgot password validation
const validateForgotPassword = [
  body('email')
    .isEmail()
    .withMessage(MESSAGES.ERROR.INVALID_EMAIL)
    .normalizeEmail()
];

// Reset password validation
const validateResetPassword = [
  body('email')
    .isEmail()
    .withMessage(MESSAGES.ERROR.INVALID_EMAIL)
    .normalizeEmail(),

  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),

  body('password')
    .isLength({ min: 8 })
    .withMessage(MESSAGES.ERROR.WEAK_PASSWORD)
];

// Update password validation
const validateUpdatePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8 })
    .withMessage(MESSAGES.ERROR.WEAK_PASSWORD)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

// Helper functions
const getFirstValidationError = (errors) => {
  if (!errors || errors.length === 0) return null;
  return errors[0].msg;
};

const formatValidationErrors = (errors) => {
  const errorMap = {};
  errors.forEach(error => {
    if (!errorMap[error.path]) {
      errorMap[error.path] = error.msg;
    }
  });
  return errorMap;
};

module.exports = {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateUpdatePassword,
  getFirstValidationError,
  formatValidationErrors
};