const { body, param, query } = require('express-validator');

/**
 * Validation rules for submitting boost application
 */
const validateBoostApplication = [
  body('platform')
    .notEmpty()
    .withMessage('Platform is required')
    .isIn(['tiktok', 'instagram', 'twitter', 'youtube'])
    .withMessage('Platform must be one of: tiktok, instagram, twitter, youtube')
    .toLowerCase(),

  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Username must be between 1 and 100 characters')
    .trim(),

  // body('phoneNumber')
  //   .notEmpty()
  //   .withMessage('Phone number is required')
  //   .isMobilePhone('any')
  //   .withMessage('Please provide a valid mobile phone number')
  //   .trim(),

  body('currentFollowers')
    .notEmpty()
    .withMessage('Current followers count is required')
    .isInt({ min: 0, max: 10000000 })
    .withMessage('Current followers must be a valid number between 0 and 10,000,000')
    .toInt(),

  body('desiredFollowers')
    .notEmpty()
    .withMessage('Desired followers count is required')
    .isInt({ min: 1, max: 10000000 })
    .withMessage('Desired followers must be a valid number between 1 and 10,000,000')
    .toInt()
    .custom((value, { req }) => {
      if (value <= req.body.currentFollowers) {
        throw new Error('Desired followers must be greater than current followers');
      }
      return true;
    })
];

/**
 * Validation rules for reviewing boost application (Admin)
 */
const validateBoostReview = [
  param('id')
    .isUUID()
    .withMessage('Invalid application ID format'),

  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['approved', 'declined', 'completed'])
    .withMessage('Status must be one of: approved, declined, completed'),

  body('adminNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Admin notes cannot exceed 1000 characters')
    .trim()
];

/**
 * Validation rules for getting applications with filters
 */
const validateApplicationFilters = [
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

  query('platform')
    .optional()
    .isIn(['tiktok', 'instagram', 'twitter', 'youtube'])
    .withMessage('Platform must be one of: tiktok, instagram, twitter, youtube'),

  query('status')
    .optional()
    .isIn(['pending', 'approved', 'declined', 'completed'])
    .withMessage('Status must be one of: pending, approved, declined, completed'),

  query('search')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search term must be between 1 and 100 characters')
    .trim()
];

/**
 * Validation rules for application ID parameter
 */
const validateApplicationId = [
  param('id')
    .isUUID()
    .withMessage('Invalid application ID format')
];

/**
 * Custom validation helper for social media usernames
 */
const validateSocialUsername = (platform, username) => {
  const patterns = {
    tiktok: /^@?[a-zA-Z0-9_.]{1,24}$/,
    instagram: /^@?[a-zA-Z0-9_.]{1,30}$/,
    twitter: /^@?[a-zA-Z0-9_]{1,15}$/,
    youtube: /^@?[a-zA-Z0-9_.-]{1,100}$/
  };

  const pattern = patterns[platform.toLowerCase()];
  return pattern ? pattern.test(username) : true;
};

/**
 * Enhanced username validation based on platform
 */
const validatePlatformSpecificUsername = [
  body('username')
    .notEmpty()
    .withMessage('Username is required')
    .custom((value, { req }) => {
      const platform = req.body.platform;
      if (!platform) {
        return true; // Platform validation will handle this
      }

      const isValid = validateSocialUsername(platform, value);
      if (!isValid) {
        const platformRules = {
          tiktok: 'TikTok username must be 1-24 characters (letters, numbers, dots, underscores)',
          instagram: 'Instagram username must be 1-30 characters (letters, numbers, dots, underscores)',
          twitter: 'Twitter/X username must be 1-15 characters (letters, numbers, underscores)',
          youtube: 'YouTube username must be 1-100 characters (letters, numbers, underscores, dots, hyphens)'
        };
        throw new Error(platformRules[platform] || 'Invalid username format');
      }
      return true;
    })
    .trim()
];

/**
 * Validation for bulk operations (Admin)
 */
const validateBulkOperation = [
  body('applicationIds')
    .isArray({ min: 1, max: 50 })
    .withMessage('Application IDs must be an array with 1-50 items'),
  
  body('applicationIds.*')
    .isUUID()
    .withMessage('Each application ID must be a valid UUID'),

  body('action')
    .notEmpty()
    .withMessage('Action is required')
    .isIn(['approve', 'decline', 'complete', 'delete'])
    .withMessage('Action must be one of: approve, decline, complete, delete'),

  body('adminNotes')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Admin notes cannot exceed 1000 characters')
    .trim()
];

module.exports = {
  validateBoostApplication: [
    ...validateBoostApplication,
    ...validatePlatformSpecificUsername
  ],
  validateBoostReview,
  validateApplicationFilters,
  validateApplicationId,
  validateBulkOperation,
  validateSocialUsername
};