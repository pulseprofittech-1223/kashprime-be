const crypto = require('crypto');

const parsePlatformSetting = (value, fallback) => {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    if (typeof value === 'object' && value !== null) return value;
    return fallback;
  } catch { return fallback; }
};

// Build the entire tower at game start using win_rate per floor
const buildTowerData = (floors, tilesPerFloor, winRate) => {
  return Array.from({ length: floors }, (_, floorIndex) => {
    const isSafe   = crypto.randomInt(0, 100) < winRate;
    const trapIndex = crypto.randomInt(0, tilesPerFloor);
    const tiles    = Array.from({ length: tilesPerFloor }, (_, i) =>
      i === trapIndex ? 'trap' : 'safe'
    );
    return {
      floor:          floorIndex + 1,
      tiles,
      trap_index:     trapIndex,
      is_safe:        isSafe,   // server's decision for this floor
      revealed_index: null
    };
  });
};

const calculateMultiplier = (floor, step = 1.4, base = 1.0) =>
  parseFloat((base * Math.pow(step, floor)).toFixed(2));

const generateTransactionReference = (type) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand  = Array.from({ length: 4 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  return `TOWER-${type.toUpperCase()}-${Date.now()}-${rand}`;
};

const validateStake = (amount, min, balance) => {
  if (!amount || isNaN(amount) || amount <= 0)
    return { valid: false, error: 'Stake must be a positive number' };
  if (amount < min)
    return { valid: false, error: `Minimum stake is ₦${min}` };
  if (amount > balance)
    return { valid: false, error: `Insufficient balance. You have ₦${balance.toLocaleString()}` };
  return { valid: true, error: null };
};

module.exports = {
  parsePlatformSetting, buildTowerData,
  calculateMultiplier, generateTransactionReference, validateStake
};
