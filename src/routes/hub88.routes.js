const express = require('express');
const Hub88Controller = require('../controllers/hub88.controller');
// Normally you'd have an auth middleware here to verify Hub88's HMAC RSA Signature.
// E.g., router.use(hub88AuthMiddleware);

const router = express.Router();

// Seamless Wallet Routes
router.post('/user/balance', Hub88Controller.getBalance);
router.post('/transaction/win', Hub88Controller.win);
router.post('/transaction/bet', Hub88Controller.bet);
router.post('/transaction/rollback', Hub88Controller.rollback);

module.exports = router;
