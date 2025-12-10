const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth.middleware');
const {
  getKashAdsStatus,
  recordAdClick,
  claimKashAdsReward
} = require('../controllers/KashAdsController');

// Using authMiddleware from existing system (checked sponsored posts routes)
router.use(authMiddleware);

router.get('/status', getKashAdsStatus);
router.post('/click', recordAdClick);
router.post('/claim', claimKashAdsReward);

module.exports = router;
