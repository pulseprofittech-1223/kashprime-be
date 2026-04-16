const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const { body, query, param } = require('express-validator');
const router = express.Router();

const kashskitController = require('../controllers/kashskit.controller');
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
 * GET /api/kashskit/videos
 * Get available videos for user to watch
 */
router.get('/videos', authMiddleware, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], kashskitController.getAvailableVideos);

/**
 * POST /api/kashskit/claim
 * Claim reward after watching video
 */
router.post('/claim', authMiddleware,  [
  body('video_id').isUUID().withMessage('Valid video ID is required')
], kashskitController.claimVideoReward);

/**
 * GET /api/kashskit/my-claims
 * Get user's claim history
 */
router.get('/my-claims', authMiddleware, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 })
], kashskitController.getUserClaimHistory);

/**
 * GET /api/kashskit/daily-status
 * Get user's daily claim status and limits
 */
router.get('/daily-status', authMiddleware, kashskitController.getDailyStatus);

// ==================== ADMIN ROUTES ====================

/**
 * POST /api/kashskit/admin/upload
 * Upload new KashSkit video
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
  kashskitController.uploadVideo
);

/**
 * GET /api/kashskit/admin/videos
 * Get all videos for admin management
 */
router.get('/admin/videos', authMiddleware, requireAdmin, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('search').optional().isLength({ max: 100 }),
  query('is_active').optional().isIn([true, false])
], kashskitController.getAllVideos);

/**
 * GET /api/kashskit/admin/videos/:videoId
 * Get video details with claim statistics
 */
router.get('/admin/videos/:videoId', authMiddleware, requireAdmin, [
  param('videoId').isUUID()
], kashskitController.getVideoDetails);

/**
 * PUT /api/kashskit/admin/videos/:videoId/status
 * Toggle video active/inactive
 */
router.put('/admin/videos/:videoId/status', authMiddleware, requireAdmin, [
  param('videoId').isUUID()
], kashskitController.toggleVideoStatus);

/**
 * DELETE /api/kashskit/admin/videos/:videoId
 * Delete video
 */
router.delete('/admin/videos/:videoId', authMiddleware, requireAdmin, [
  param('videoId').isUUID()
], kashskitController.deleteVideo);

 

 

module.exports = router;