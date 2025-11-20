const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { body, query, param } = require('express-validator');
const router = express.Router();

const voxskitController = require('../controllers/voxskit.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');

// Configure multer for video uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video files are allowed.'));
    }
  }
});

 

// Rate limiting for video uploads
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: {
    status: 'error',
    message: 'Too many upload requests, please try again later.'
  }
});

// ==================== USER ROUTES ====================

/**
 * GET /api/voxskit/videos
 * Get available videos for user to watch
 */
router.get('/videos', authMiddleware, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], voxskitController.getAvailableVideos);

/**
 * POST /api/voxskit/claim
 * Claim reward after watching video
 */
router.post('/claim', authMiddleware,  [
  body('video_id').isUUID().withMessage('Valid video ID is required')
], voxskitController.claimVideoReward);

/**
 * GET /api/voxskit/my-claims
 * Get user's claim history
 */
router.get('/my-claims', authMiddleware, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], voxskitController.getUserClaimHistory);

// ==================== ADMIN ROUTES ====================

/**
 * POST /api/voxskit/admin/upload
 * Upload new VoxSkit video
 */
router.post('/admin/upload', 
  authMiddleware, 
  requireAdmin, 
  uploadLimiter,
  upload.single('video'), 
  [
    body('skit_title')
      .isLength({ min: 3, max: 255 })
      .withMessage('Skit title must be between 3 and 255 characters'),
    body('creator')
      .isLength({ min: 2, max: 255 })
      .withMessage('Creator name must be between 2 and 255 characters'),
    body('external_link')
      .optional()
      .isURL()
      .withMessage('External link must be a valid URL')
  ], 
  voxskitController.uploadVideo
);

/**
 * GET /api/voxskit/admin/videos
 * Get all videos for admin management
 */
router.get('/admin/videos', authMiddleware, requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isLength({ max: 100 }),
  query('is_active').optional().isIn([true, false])
], voxskitController.getAllVideos);

/**
 * GET /api/voxskit/admin/videos/:videoId
 * Get video details with claim statistics
 */
router.get('/admin/videos/:videoId', authMiddleware, requireAdmin, [
  param('videoId').isUUID()
], voxskitController.getVideoDetails);

/**
 * DELETE /api/voxskit/admin/videos/:videoId
 * Delete video
 */
router.delete('/admin/videos/:videoId', authMiddleware, requireAdmin, [
  param('videoId').isUUID()
], voxskitController.deleteVideo);

 

 

module.exports = router;