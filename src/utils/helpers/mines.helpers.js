
/**
 * Generate random bomb positions for 25-field grid
 * @param {number} bombCount - Number of bombs (4, 6, 8, or 10)
 * @returns {boolean[]} - Array of 25 booleans (false = bomb, true = safe)
 */
const generateBombPositions = (bombCount) => {
  // Initialize all fields as safe (true)
  const fields = new Array(25).fill(true);
  
  // Generate random bomb positions
  const bombIndices = new Set();
  
  while (bombIndices.size < bombCount) {
    const randomIndex = Math.floor(Math.random() * 25);
    bombIndices.add(randomIndex);
  }
  
  // Set bomb positions to false
  bombIndices.forEach(index => {
    fields[index] = false;
  });
  
  return fields;
};

/**
 * Calculate payout based on successful clicks and bomb count
 * @param {number} stakeAmount - User's stake amount
 * @param {number} successfulClicks - Number of successful safe field clicks
 * @param {number} bombCount - Number of bombs selected (4, 6, 8, or 10)
 * @param {object} multiplierConfig - Multiplier configuration from platform_settings
 * @returns {object} - { cashoutMultiplier, payout, profit }
 */
const calculatePayout = (stakeAmount, successfulClicks, bombCount, multiplierConfig) => {
  try {
    // Get multipliers for selected bomb count
    const bombConfig = multiplierConfig[bombCount.toString()];
    
    if (!bombConfig || !bombConfig.multipliers) {
      throw new Error(`Invalid bomb configuration for ${bombCount} bombs`);
    }
    
    // Validate successful clicks is within range
    if (successfulClicks < 1 || successfulClicks > bombConfig.levels) {
      throw new Error(`Invalid successful clicks: ${successfulClicks}. Must be between 1 and ${bombConfig.levels}`);
    }
    
    // Get multiplier (0-indexed array)
    const cashoutMultiplier = bombConfig.multipliers[successfulClicks - 1];
    
    // Calculate payout and profit
    const payout = parseFloat((stakeAmount * cashoutMultiplier).toFixed(2));
    const profit = parseFloat((payout - stakeAmount).toFixed(2));
    
    return {
      cashoutMultiplier,
      payout,
      profit
    };
  } catch (error) {
    throw new Error(`Payout calculation error: ${error.message}`);
  }
};

/**
 * Validate bomb count is allowed
 * @param {number} bombCount - Bomb count to validate
 * @param {array} allowedOptions - Array of allowed bomb counts from settings
 * @returns {boolean}
 */
const isValidBombCount = (bombCount, allowedOptions = [4, 6, 8, 10]) => {
  return allowedOptions.includes(bombCount);
};

/**
 * Get maximum possible wins for a bomb count
 * @param {number} bombCount - Number of bombs
 * @param {object} multiplierConfig - Multiplier configuration
 * @returns {number} - Maximum number of safe fields user can click
 */
const getMaxWinsForBombCount = (bombCount, multiplierConfig) => {
  const bombConfig = multiplierConfig[bombCount.toString()];
  return bombConfig ? bombConfig.levels : 0;
};

/**
 * Generate transaction reference for Mines game
 * @param {string} type - Transaction type ('stake', 'win', 'loss')
 * @returns {string} - Unique transaction reference
 */
const generateTransactionReference = (type) => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MINES-${type.toUpperCase()}-${timestamp}-${random}`;
};

/**
 * Format currency for display
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted currency string
 */
const formatCurrency = (amount) => {
  return `₦${parseFloat(amount).toLocaleString('en-NG', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

/**
 * Validate stake amount
 * @param {number} amount - Stake amount to validate
 * @param {number} minStake - Minimum stake from settings
 * @param {number} userBalance - User's gaming wallet balance
 * @returns {object} - { valid: boolean, error: string }
 */
const validateStakeAmount = (amount, minStake, userBalance) => {
  if (!amount || amount <= 0) {
    return { valid: false, error: 'Stake amount must be greater than 0' };
  }
  
  if (amount < minStake) {
    return { valid: false, error: `Minimum stake is ${formatCurrency(minStake)}` };
  }
  
  if (amount > userBalance) {
    return { 
      valid: false, 
      error: `Insufficient balance. You have ${formatCurrency(userBalance)}` 
    };
  }
  
  return { valid: true, error: null };
};

module.exports = {
  generateBombPositions,
  calculatePayout,
  isValidBombCount,
  getMaxWinsForBombCount,
  generateTransactionReference,
  formatCurrency,
  validateStakeAmount
};