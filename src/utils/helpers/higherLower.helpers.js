const crypto = require('crypto');

const parsePlatformSetting = (value, fallback) => {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    if (typeof value === 'object' && value !== null) return value;
    return fallback;
  } catch { return fallback; }
};

const calculateMultiplier = (shownNumber, direction, houseEdge = 0.05) => {
  const probability = direction === 'higher'
    ? (100 - shownNumber) / 100
    : shownNumber / 100;
  if (probability <= 0) return 99;
  const fairMulti   = 1 / probability;
  const actualMulti = parseFloat((fairMulti * (1 - houseEdge)).toFixed(2));
  return Math.max(1.01, actualMulti);
};

const getBothMultipliers = (shownNumber, houseEdge = 0.05) => ({
  higher: calculateMultiplier(shownNumber, 'higher', houseEdge),
  lower:  calculateMultiplier(shownNumber, 'lower',  houseEdge),
});

// Avoid extremes — prevent impossible bets (shown=1 bet lower, shown=100 bet higher)
const generateShownNumber = (min = 1, max = 100) => crypto.randomInt(min + 2, max - 2);

const generateResultNumber = (shownNumber, direction, playerWins, min = 1, max = 100) => {
  if (playerWins) {
    const lo = direction === 'higher' ? shownNumber + 1 : min;
    const hi = direction === 'higher' ? max            : shownNumber - 1;
    if (lo > hi) return direction === 'higher' ? max : min;
    return crypto.randomInt(lo, hi + 1);
  } else {
    const lo = direction === 'higher' ? min         : shownNumber + 1;
    const hi = direction === 'higher' ? shownNumber : max;
    if (lo > hi) return shownNumber;
    return crypto.randomInt(lo, hi + 1);
  }
};

const generateTransactionReference = (type) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = Array.from({ length: 4 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  return `HL-${type.toUpperCase()}-${Date.now()}-${rand}`;
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
  parsePlatformSetting, calculateMultiplier, getBothMultipliers,
  generateShownNumber, generateResultNumber, generateTransactionReference, validateStake
};
