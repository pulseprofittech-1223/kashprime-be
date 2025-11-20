const express = require("express");
const socialRouter = express.Router();
const {
  requireAdmin,
  authMiddleware,
} = require("../middleware/auth.middleware");

// Controllers
const {
  submitBoostApplication,
  getUserBoostApplications,
  getBoostApplicationDetails,
  getAllBoostApplications,
  reviewBoostApplication,
  getBoostStatistics,
  deleteBoostApplication,
  bulkDeleteApplications,
} = require("../controllers/social.controller");

// Validators
const {
  validateBoostApplication,
  validateBoostReview,
  validateApplicationFilters,
  validateApplicationId,
} = require("../utils/validators/social");

// Rate limiting middleware
const rateLimit = require("express-rate-limit");

 

// =================================
// PUBLIC ROUTES (with authentication)
// =================================

/**
 * Submit a new social media boost application
 * POST /api/social/apply
 * Body: { platform, username, phoneNumber, currentFollowers, desiredFollowers }
 */
socialRouter.post(
  "/apply",
  authMiddleware,
  validateBoostApplication,
  submitBoostApplication
);

/**
 * Get current user's boost applications
 * GET /api/social/my-applications
 * Query: ?page=1&limit=10&platform=tiktok&status=pending
 */
socialRouter.get(
  "/my-applications",
  authMiddleware,
  validateApplicationFilters,
  getUserBoostApplications
);

/**
 * Get specific application details
 * GET /api/social/application/:id
 */
socialRouter.get(
  "/application/:id",
  authMiddleware,
  // validateApplicationId,
  getBoostApplicationDetails
);

/**
 * Delete a pending application
 * DELETE /api/social/application/:id
 */
socialRouter.delete(
  "/application/:id",
  authMiddleware,
  validateApplicationId,
  deleteBoostApplication
);

// =================================
// ADMIN ROUTES
// =================================

/**
 * Get all boost applications (Admin only)
 * GET /api/social/admin/applications
 * Query: ?page=1&limit=20&platform=tiktok&status=pending&search=username
 */
socialRouter.get(
  "/admin/applications",
  authMiddleware,
  requireAdmin,
  validateApplicationFilters,
  getAllBoostApplications
);

/**
 * Review a boost application (Admin only)
 * PUT /api/social/admin/review/:id
 * Body: { status: 'approved'|'declined'|'completed', adminNotes?: string }
 */
socialRouter.put(
  "/admin/review/:id",
  authMiddleware,
  requireAdmin,
  validateBoostReview,
  reviewBoostApplication
);

/**
 * Get boost statistics (Admin only)
 * GET /api/social/admin/statistics
 */
socialRouter.get(
  "/admin/statistics",
  authMiddleware,
  requireAdmin,
  getBoostStatistics
);

/**
 * Bulk delete applications (Admin only)
 * DELETE /api/social/admin/bulk-delete
 * Body: { applicationIds: ['uuid1', 'uuid2'], action: 'delete' }
 */
socialRouter.delete(
  "/admin/bulk-delete",
  authMiddleware,
  requireAdmin,
  bulkDeleteApplications
);

module.exports = socialRouter;
