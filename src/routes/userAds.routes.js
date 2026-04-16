const express = require('express');
const router = express.Router();
const userAdsController = require('../controllers/UserAdsController');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');

// Public/General Ad Routes
router.get('/pricing', userAdsController.getPricing);
router.get('/active', userAdsController.getActiveAds);
router.post('/track', userAdsController.recordEvent);

// User Ad Submission Routes
router.post('/submit', authMiddleware, userAdsController.submitAd);
router.get('/my-ads', authMiddleware, userAdsController.getMyAds);
router.post('/my-ads/status', authMiddleware, userAdsController.updateMyAdStatus);

// Admin Ad Management Routes
router.get('/admin/all', authMiddleware, requireAdmin, userAdsController.adminGetAds);
router.post('/admin/process', authMiddleware, requireAdmin, userAdsController.adminProcessAd);
router.post('/admin/pricing', authMiddleware, requireAdmin, userAdsController.adminUpdatePricing);
router.get('/admin/analytics', authMiddleware, requireAdmin, userAdsController.adminGetAnalytics);
router.post('/admin/status', authMiddleware, requireAdmin, userAdsController.adminUpdateAdStatus);
router.post('/admin/delete', authMiddleware, requireAdmin, userAdsController.adminDeleteAd);

module.exports = router;
