const crypto = require('crypto');

// Parse JSONB setting value safely
const parsePlatformSetting = (value, fallback) => {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    if (typeof value === 'object' && value !== null) return value;
    return fallback;
  } catch {
    return fallback;
  }
};

// Default segments used as fallback
const DEFAULT_SEGMENTS = [
  { index: 0,  label: '0x',   multiplier: 0,    color: '#EF4444', weight: 20 },
  { index: 1,  label: '1.5x', multiplier: 1.5,  color: '#F97316', weight: 15 },
  { index: 2,  label: '0x',   multiplier: 0,    color: '#EF4444', weight: 20 },
  { index: 3,  label: '2x',   multiplier: 2.0,  color: '#EAB308', weight: 20 },
  { index: 4,  label: '0x',   multiplier: 0,    color: '#EF4444', weight: 20 },
  { index: 5,  label: '3x',   multiplier: 3.0,  color: '#22C55E', weight: 10 },
  { index: 6,  label: '1.5x', multiplier: 1.5,  color: '#F97316', weight: 15 },
  { index: 7,  label: '5x',   multiplier: 5.0,  color: '#3B82F6', weight: 6  },
  { index: 8,  label: '2x',   multiplier: 2.0,  color: '#EAB308', weight: 20 },
  { index: 9,  label: '10x',  multiplier: 10.0, color: '#8B5CF6', weight: 3  },
  { index: 10, label: '0x',   multiplier: 0,    color: '#EF4444', weight: 20 },
  { index: 11, label: '50x',  multiplier: 50.0, color: '#F59E0B', weight: 1  },
];

// Core spin logic
const generateSpinResult = (winRate = 45, segments = DEFAULT_SEGMENTS) => {
  const randomValue = crypto.randomInt(0, 100);
  const playerWins = randomValue < winRate;

  const winSegments  = segments.filter(s => s.multiplier > 0);
  const lossSegments = segments.filter(s => s.multiplier === 0);

  const pool = playerWins ? winSegments : lossSegments;

  // Weighted random pick
  const totalWeight = pool.reduce((sum, s) => sum + s.weight, 0);
  let rand = crypto.randomInt(0, totalWeight);
  let chosen = pool[pool.length - 1];

  for (const seg of pool) {
    rand -= seg.weight;
    if (rand <= 0) { chosen = seg; break; }
  }

  return { segment: chosen, isWin: playerWins };
};

const calculatePayout = (stakeAmount, multiplier) => {
  const payout = parseFloat((stakeAmount * multiplier).toFixed(2));
  const profit = parseFloat((payout - stakeAmount).toFixed(2));
  return { payout, profit };
};

const validateStakeAmount = (amount, minStake, userBalance) => {
  if (!amount || isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Stake amount must be a positive number' };
  }
  if (amount < minStake) {
    return { valid: false, error: `Minimum stake is ₦${minStake}` };
  }
  if (amount > userBalance) {
    return { valid: false, error: `Insufficient balance. You have ₦${parseFloat(userBalance).toLocaleString()}` };
  }
  return { valid: true, error: null };
};

const generateTransactionReference = (type) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = Array.from({ length: 4 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  return `SPIN-${type.toUpperCase()}-${Date.now()}-${random}`;
};

module.exports = {
  parsePlatformSetting,
  DEFAULT_SEGMENTS,
  generateSpinResult,
  calculatePayout,
  validateStakeAmount,
  generateTransactionReference,
};
