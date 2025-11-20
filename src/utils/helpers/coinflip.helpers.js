
const crypto = require('crypto');

/**
 * Generate coin flip result using cryptographically secure randomness
 * @param {string} userChoice - User's choice ('heads' or 'tails')
 * @param {number} winRate - Player win probability (0-100)
 * @returns {object} { result: 'heads'|'tails', isWin: boolean }
 */
const generateCoinFlip = (userChoice, winRate = 48) => {
  // Generate cryptographically secure random number (0-99)
  const randomValue = crypto.randomInt(0, 100);
  
  // Determine if player wins based on win rate
  const playerWins = randomValue < winRate;
  
  // Return result that matches win/loss outcome
  const result = playerWins ? userChoice : (userChoice === 'heads' ? 'tails' : 'heads');
  
  return {
    result,
    isWin: playerWins
  };
};

/**
 * Calculate payout for winning bet
 * @param {number} stakeAmount - Amount staked
 * @param {number} multiplier - Win multiplier (default 1.98)
 * @returns {object} { payout: number, profit: number }
 */
const calculatePayout = (stakeAmount, multiplier = 1.98) => {
  const payout = parseFloat((stakeAmount * multiplier).toFixed(2));
  const profit = parseFloat((payout - stakeAmount).toFixed(2));
  
  return {
    payout,
    profit
  };
};

/**
 * Validate stake amount
 * @param {number} amount - Stake amount
 * @param {number} minStake - Minimum allowed stake
 * @param {number} userBalance - User's gaming wallet balance
 * @returns {object} { valid: boolean, error: string|null }
 */
const validateStakeAmount = (amount, minStake, userBalance) => {
  if (!amount || amount <= 0) {
    return {
      valid: false,
      error: 'Stake amount must be greater than zero'
    };
  }

  if (amount < minStake) {
    return {
      valid: false,
      error: `Minimum stake is ₦${formatCurrency(minStake)}`
    };
  }

  if (amount > userBalance) {
    return {
      valid: false,
      error: `Insufficient balance. You have ₦${formatCurrency(userBalance)}`
    };
  }

  return { valid: true, error: null };
};

/**
 * Validate user choice
 * @param {string} choice - User's choice ('heads' or 'tails')
 * @returns {boolean}
 */
const isValidChoice = (choice) => {
  return ['heads', 'tails'].includes(choice?.toLowerCase());
};

/**
 * Generate unique transaction reference
 * @param {string} type - Transaction type ('stake', 'win', 'loss')
 * @returns {string} Unique reference code
 */
const generateTransactionReference = (type = 'PLAY') => {
  const timestamp = Date.now();
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `COINFLIP-${type.toUpperCase()}-${timestamp}-${random}`;
};

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @returns {string} Formatted amount with thousand separators
 */
const formatCurrency = (amount) => {
  return parseFloat(amount).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

/**
 * Calculate win rate percentage
 * @param {number} wins - Number of wins
 * @param {number} total - Total games
 * @returns {string} Win rate percentage
 */
const calculateWinRate = (wins, total) => {
  if (total === 0) return '0.00';
  return ((wins / total) * 100).toFixed(2);
};

/**
 * Parse platform settings value
 * @param {*} settingValue - JSONB value from database
 * @returns {*} Parsed value
 */
const parsePlatformSetting = (settingValue) => {
  if (typeof settingValue === 'string') {
    try {
      return JSON.parse(settingValue);
    } catch {
      return settingValue;
    }
  }
  return settingValue;
};

module.exports = {
  generateCoinFlip,
  calculatePayout,
  validateStakeAmount,
  isValidChoice,
  generateTransactionReference,
  formatCurrency,
  calculateWinRate,
  parsePlatformSetting
};