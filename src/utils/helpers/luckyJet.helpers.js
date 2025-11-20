const { supabaseAdmin } = require("../../services/supabase.service");

 

 
/**
 * Generate crash point with fair distribution
 * @param {number} winRate - Win rate percentage (0-100)
 * @param {number} maxMultiplier - Maximum multiplier (e.g., 8.0)
 * @returns {number} - Crash point multiplier (minimum 1.0x)
 */
const generateCrashPoint = (winRate = 45, maxMultiplier = 8.0) => {
  const minMultiplier = 1.0;
  
  // Distribution ranges
  const lowRange = [1.0, 2.0];    // Quick crashes (40% of games)
  const midRange = [2.0, 4.0];    // Medium crashes (35% of games)
  const highRange = [4.0, maxMultiplier]; // High crashes (25% of games)
  
  const random = Math.random() * 100;
  
  let crashPoint;
  
  // Adjust distribution based on win rate
  // Lower win rate = more crashes in low range
  const lowThreshold = 60 - (winRate * 0.3);  // If winRate=45, lowThreshold=46.5
  const midThreshold = lowThreshold + 30;      // midThreshold=76.5
  
  if (random < lowThreshold) {
    // Low multiplier crash (1.0x - 2.0x)
    crashPoint = lowRange[0] + (Math.random() * (lowRange[1] - lowRange[0]));
  } else if (random < midThreshold) {
    // Medium multiplier crash (2.0x - 4.0x)
    crashPoint = midRange[0] + (Math.random() * (midRange[1] - midRange[0]));
  } else {
    // High multiplier crash (4.0x - 8.0x)
    crashPoint = highRange[0] + (Math.random() * (highRange[1] - highRange[0]));
  }
  
  return parseFloat(crashPoint.toFixed(2));
};


/**
 * Get Lucky Jet settings from platform_settings
 * @returns {Promise<Object>} - Lucky Jet configuration
 */
const getLuckyJetSettings = async () => {
  const { data: settings } = await supabaseAdmin
    .from('platform_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'lucky_jet_enabled',
      'lucky_jet_min_stake',
      'lucky_jet_max_multiplier',
      'lucky_jet_win_rate'
    ]);

  const config = {
    enabled: true,
    minStake: 50,
    maxMultiplier: 8.0,
    winRate: 45,
    secondsPerMultiplier: 7  
  };

  settings?.forEach(setting => {
    const value = setting.setting_value;
    switch (setting.setting_key) {
      case 'lucky_jet_enabled':
        config.enabled = value === 'true' || value === true;
        break;
      case 'lucky_jet_min_stake':
        config.minStake = parseFloat(value) || 50;
        break;
      case 'lucky_jet_max_multiplier':
        config.maxMultiplier = parseFloat(value) || 8.0;
        break;
      case 'lucky_jet_win_rate':
        config.winRate = parseFloat(value) || 45;
        break;
    }
  });

  return config;
};

 
/**
 * Calculate payout and profit/loss
 * @param {number} stakeAmount - User's stake
 * @param {number} multiplier - Cashout multiplier
 * @returns {Object} - Payout and profit/loss
 */
const calculatePayout = (stakeAmount, multiplier) => {
  const payout = stakeAmount * multiplier;
  const profitLoss = payout - stakeAmount;
  
  return {
    payout: parseFloat(payout.toFixed(2)),
    profitLoss: parseFloat(profitLoss.toFixed(2))
  };
};

module.exports = {
  generateCrashPoint,
  getLuckyJetSettings,
  calculatePayout
};