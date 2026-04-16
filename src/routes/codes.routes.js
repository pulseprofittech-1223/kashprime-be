const express = require('express');
const router = express.Router();
const { getCodes, generateCodes, deleteCodes } = require('../controllers/codes.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

const authorize = (...roles) => {
  return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
          return res.status(403).json({ success: false, error: 'Access denied' });
      }
      next();
  };
};

router.use(authMiddleware);

router.get('/', authorize('admin', 'super_admin', 'merchant', 'vendor', 'super_vendor'), getCodes);
router.post('/generate', authorize('admin', 'super_admin'), generateCodes);
router.delete('/', authorize('admin', 'super_admin'), deleteCodes);

module.exports = router;
