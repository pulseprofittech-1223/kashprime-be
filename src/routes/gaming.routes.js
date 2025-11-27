
const express = require('express');
const router = express.Router();
const { 
  updateGameBalance,
  getGameHistory,
  getGamesBalance, getTopRecentWinners
} = require('../controllers/gaming.controller');
const { authMiddleware,  } = require('../middleware/auth.middleware');

router.get('/top-winners', getTopRecentWinners);


// All routes require user authentication
router.use(authMiddleware);

// Update games balance (win/loss)
router.post('/update', updateGameBalance);

// Get game transaction history
router.get('/history', getGameHistory);

// Get current games balance
router.get('/balance', getGamesBalance);

module.exports = router;