 

const { body, param,   } = require('express-validator');

const kashfeedValidators = {
  createPost: [
    body('title')
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage('Title must be between 5 and 255 characters'),
    
    body('content')
      .trim()
      .isLength({ min: 50 })
      .withMessage('Content must be at least 50 characters'),
    
    body('category')
      .optional()
      .trim()
      .isIn(['general', 'technology', 'business', 'lifestyle', 'health', 'finance', 'education', 'entertainment', 'sports', 'travel', 'food'])
      .withMessage('Invalid category selected'),
    
    body('excerpt')
      .optional()
      .trim()
      .isLength({ max: 300 })
      .withMessage('Excerpt must not exceed 300 characters'),
    
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    
    body('tags.*')
      .optional()
      .trim()
      .isLength({ min: 2, max: 30 })
      .withMessage('Each tag must be between 2 and 30 characters'),
    
    body('meta_title')
      .optional()
      .trim()
      .isLength({ max: 60 })
      .withMessage('Meta title must not exceed 60 characters'),
    
    body('meta_description')
      .optional()
      .trim()
      .isLength({ max: 160 })
      .withMessage('Meta description must not exceed 160 characters')
  ],

  updatePost: [
    param('id')
      .isUUID()
      .withMessage('Invalid post ID'),
    
    body('title')
      .optional()
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage('Title must be between 5 and 255 characters'),
    
    body('content')
      .optional()
      .trim()
      .isLength({ min: 50 })
      .withMessage('Content must be at least 50 characters'),
    
    body('category')
      .optional()
      .trim()
      .isIn(['general', 'technology', 'business', 'lifestyle', 'health', 'finance', 'education', 'entertainment', 'sports', 'travel', 'food'])
      .withMessage('Invalid category selected'),
    
    body('excerpt')
      .optional()
      .trim()
      .isLength({ max: 300 })
      .withMessage('Excerpt must not exceed 300 characters'),
    
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    
    body('meta_title')
      .optional()
      .trim()
      .isLength({ max: 60 })
      .withMessage('Meta title must not exceed 60 characters'),
    
    body('meta_description')
      .optional()
      .trim()
      .isLength({ max: 160 })
      .withMessage('Meta description must not exceed 160 characters')
  ],

  addComment: [
    param('postId')
      .isUUID()
      .withMessage('Invalid post ID'),
    
    body('content')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Comment must be between 1 and 1000 characters'),
    
    body('parentId')
      .optional()
      .isUUID()
      .withMessage('Invalid parent comment ID')
  ],

  reviewPost: [
    param('postId')
      .isUUID()
      .withMessage('Invalid post ID'),
    
    body('status')
      .isIn(['approved', 'rejected'])
      .withMessage('Status must be either approved or rejected'),
    
    
  ],

  bulkDeletePosts: [
    body('postIds')
      .isArray({ min: 1, max: 50 })
      .withMessage('Must provide 1-50 post IDs'),
    
    body('postIds.*')
      .isUUID()
      .withMessage('Each post ID must be a valid UUID')
  ]
};

module.exports = kashfeedValidators;