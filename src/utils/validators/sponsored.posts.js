const { body, param, query } = require('express-validator');

// Validation for creating sponsored post (Admin only)
const createPost = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 5, max: 255 })
    .withMessage('Title must be between 5 and 255 characters')
    .trim()
    .escape(),
  
  body('content')
    .notEmpty()
    .withMessage('Content is required')
    .isLength({ min: 10 })
    .withMessage('Content must be at least 10 characters long')
    .trim(),
  
  body('link1')
    .optional()
    .isURL()
    .withMessage('Link 1 must be a valid URL')
    .trim(),
  
  body('link2')
    .optional()
    .isURL()
    .withMessage('Link 2 must be a valid URL')
    .trim()
];

// Validation for updating sponsored post (Admin only)
const updatePost = [
  param('id')
    .isUUID()
    .withMessage('Invalid post ID format'),
  
  body('title')
    .optional()
    .isLength({ min: 5, max: 255 })
    .withMessage('Title must be between 5 and 255 characters')
    .trim()
    .escape(),
  
  body('content')
    .optional()
    .isLength({ min: 10 })
    .withMessage('Content must be at least 10 characters long')
    .trim(),
  
  body('link1')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true; // Allow empty/null
      if (typeof value === 'string' && value.match(/^https?:\/\/[^\s/$.?#].[^\s]*$/)) {
        return true;
      }
      throw new Error('Link 1 must be a valid URL');
    })
    .trim(),
  
  body('link2')
    .optional()
    .custom((value) => {
      if (value === null || value === '') return true; // Allow empty/null
      if (typeof value === 'string' && value.match(/^https?:\/\/[^\s/$.?#].[^\s]*$/)) {
        return true;
      }
      throw new Error('Link 2 must be a valid URL');
    })
    .trim(),
  
  body('status')
    .optional()
    .isIn(['published', 'draft', 'archived'])
    .withMessage('Status must be either published, draft, or archived'),
  
  body('is_published')
    .optional()
    .isBoolean()
    .withMessage('is_published must be a boolean value')
];

// Validation for getting post by ID
const getPostById = [
  param('postId')
    .isUUID()
    .withMessage('Invalid post ID format')
];

// Validation for deleting post
const deletePost = [
  param('id')
    .isUUID()
    .withMessage('Invalid post ID format')
];

// Validation for adding comment
const addComment = [
  param('postId')
    .isUUID()
    .withMessage('Invalid post ID format'),
  
  body('content')
    .notEmpty()
    .withMessage('Comment content is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Comment must be between 1 and 1000 characters')
    .trim()
];

// Validation for getting post comments
const getPostComments = [
  param('postId')
    .isUUID()
    .withMessage('Invalid post ID format'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt()
];

// Validation for getting all posts (admin)
const getAllPosts = [
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
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Search query must be between 1 and 255 characters')
    .trim()
];

// Validation for getting published posts (public)
const getPublishedPosts = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50')
    .toInt(),
  
  query('search')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Search query must be between 1 and 255 characters')
    .trim(),
  
  query('sort')
    .optional()
    .isIn(['latest', 'popular', 'engagement'])
    .withMessage('Sort must be one of: latest, popular, engagement')
];

// Validation for getting all comments (admin)
const getAllComments = [
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
    .isIn(['approved', 'pending', 'rejected'])
    .withMessage('Status must be one of: approved, pending, rejected'),
  
  query('postId')
    .optional()
    .isUUID()
    .withMessage('Invalid post ID format')
];

// Validation for deleting comment (admin)
const deleteComment = [
  param('commentId')
    .isUUID()
    .withMessage('Invalid comment ID format')
];

// Validation for engaging with post
const engagePost = [
  param('postId')
    .isUUID()
    .withMessage('Invalid post ID format')
];

module.exports = {
  createPost,
  updatePost,
  getPostById,
  deletePost,
  addComment,
  getPostComments,
  getAllPosts,
  getPublishedPosts,
  getAllComments,
  deleteComment,
  engagePost
};