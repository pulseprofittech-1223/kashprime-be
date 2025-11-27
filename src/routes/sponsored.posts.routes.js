const express = require('express');
const router = express.Router();
const sponsoredController = require('../controllers/sponsored.posts.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');
const uploadMiddleware = require('../middleware/upload.middleware');
const { sanitizeContent } = require('../middleware/voxfeed.middleware');
const sponsoredValidators = require('../utils/validators/sponsored.posts');
const rateLimit = require('express-rate-limit');

// Rate limiting for post creation
const createPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 sponsored posts per hour
  message: {
    status: 'error',
    message: 'Too many sponsored posts created. Please try again later.'
  }
});

// ==================== PUBLIC ROUTES ====================

/**
 * @route GET /api/sponsored-posts
 * @desc Get all published sponsored posts (public access)
 * @access Public
 */
router.get(
  '/',
  sponsoredValidators.getPublishedPosts,
  sponsoredController.getPublishedPosts
);

// ==================== ADMIN ROUTES (static paths - BEFORE dynamic) ====================

/**
 * @route POST /api/sponsored-posts/admin
 * @desc Create new sponsored post (Admin only)
 * @access Private (Admin only)
 */
router.post(
  '/admin',
  authMiddleware,
  requireAdmin,
  createPostLimiter,
  uploadMiddleware.single('featured_image'),
  sanitizeContent,
  sponsoredValidators.createPost,
  sponsoredController.createPost
);

/**
 * @route GET /api/sponsored-posts/admin/all
 * @desc Get all sponsored posts for admin management
 * @access Private (Admin only)
 */
router.get(
  '/admin/all',
  authMiddleware,
  requireAdmin,
  sponsoredValidators.getAllPosts,
  sponsoredController.getAllPosts
);

/**
 * @route PUT /api/sponsored-posts/admin/:id
 * @desc Update sponsored post (Admin only)
 * @access Private (Admin only)
 */
router.put(
  '/admin/:id',
  authMiddleware,
  requireAdmin,
  uploadMiddleware.single('featured_image'),
  sanitizeContent,
  sponsoredValidators.updatePost,
  sponsoredController.updatePost
);

/**
 * @route DELETE /api/sponsored-posts/admin/:id
 * @desc Delete sponsored post (Admin only)
 * @access Private (Admin only)
 */
router.delete(
  '/admin/:id',
  authMiddleware,
  requireAdmin,
  sponsoredValidators.deletePost,
  sponsoredController.deletePost
);

// ==================== USER STATIC ROUTES (BEFORE dynamic :postId) ====================

/**
 * @route GET /api/sponsored-posts/daily-status
 * @desc Get user's daily engagement status
 * @access Private (Authenticated users)
 */
router.get(
  '/daily-status',
  authMiddleware,
  sponsoredController.getDailyStatus
);

/**
 * @route GET /api/sponsored-posts/can-engage/:postId
 * @desc Check if user can engage with a specific post
 * @access Private (Authenticated users)
 */
router.get(
  '/can-engage/:postId',
  authMiddleware,
  sponsoredController.canEngagePost
);

// ==================== DYNAMIC ROUTES (with :postId - MUST BE LAST) ====================

/**
 * @route GET /api/sponsored-posts/:postId
 * @desc Get single sponsored post by ID (public access)
 * @access Public
 */
router.get(
  '/:postId',
  sponsoredValidators.getPostById,
  sponsoredController.getPostById
);

/**
 * @route POST /api/sponsored-posts/:postId/engage
 * @desc Engage with sponsored post to earn VOXcoin
 * @access Private (Authenticated users)
 */
router.post(
  '/:postId/engage',
  authMiddleware,
  sponsoredValidators.engagePost,
  sponsoredController.engagePost
);

module.exports = router;