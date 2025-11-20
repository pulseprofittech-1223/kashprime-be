 const express = require('express');
const router = express.Router();
const voxfeedController = require('../controllers/voxfeed.controller');
const voxfeedAdminController = require('../controllers/voxfeedAdmin.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');
const uploadMiddleware = require('../middleware/upload.middleware');
const {
  checkPostCreationLimits,
  checkCommentLimits,
  validatePostOwnership,
  sanitizeContent
} = require('../middleware/voxfeed.middleware');
const voxfeedValidators = require('../utils/validators/voxfeed');
const rateLimit = require('express-rate-limit');

// Rate limiting for post creation
const createPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 posts per hour
  message: {
    status: 'error',
    message: 'Too many posts created. Please try again later.'
  }
});

// Rate limiting for comments
const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 comments per 15 minutes
  message: {
    status: 'error',
    message: 'Too many comments. Please try again later.'
  }
});

// Public routes
router.get('/posts', voxfeedController.getPublishedPosts);
router.get('/posts/:postId', voxfeedController.getPostById);

router.get('/posts/:postId/comments', voxfeedController.getPostComments);
router.get('/categories', voxfeedController.getCategories);

// Protected routes (require authentication)
router.use(authMiddleware);

// Post management
router.post('/posts', 
  createPostLimiter,
  checkPostCreationLimits,
  uploadMiddleware.single('featured_image'),
  sanitizeContent,
  voxfeedValidators.createPost,
  voxfeedController.createPost
);

router.get('/my-posts', voxfeedController.getUserPosts);

router.put('/posts/:id',
  validatePostOwnership,
  uploadMiddleware.single('featured_image'),
  sanitizeContent,
  voxfeedValidators.updatePost,
  voxfeedController.updatePost
);

/**
 * @route   POST /api/voxfeed/posts/:postId/engage
 * @desc    Engage with a post and earn VOXcoin reward
 * @access  Protected (Authenticated users)
 * @returns {Object} Success response with reward amount and new balance
 *  
 */
router.post('/:postId/engage', voxfeedController.engagePost);

router.delete('/posts/:id', 
  validatePostOwnership,
  voxfeedController.deletePost
);
 
// Comments
router.post('/posts/:postId/comments',
  commentLimiter,
  checkCommentLimits,
  sanitizeContent,
  voxfeedValidators.addComment,
  voxfeedController.addComment
);

// Admin routes
router.get('/admin/posts', 
  requireAdmin, 
  voxfeedAdminController.getAllPosts
);

router.put('/admin/posts/:postId/review', 
  requireAdmin,
  voxfeedValidators.reviewPost,
  voxfeedAdminController.reviewPost
);

router.delete('/admin/posts/:postId', 
//   requireAdmin, 
  voxfeedAdminController.deletePost
);

router.delete('/admin/posts/bulk', 
  requireAdmin,
  voxfeedValidators.bulkDeletePosts,
  voxfeedAdminController.bulkDeletePosts
);

// Comment management
router.get('/admin/comments', 
  requireAdmin, 
  voxfeedAdminController.getAllComments
);

router.delete('/admin/comments/:commentId', 
  requireAdmin, 
  voxfeedAdminController.deleteComment
);

// Statistics
router.get('/admin/statistics', 
  requireAdmin, 
  voxfeedAdminController.getStatistics
);

module.exports = router;