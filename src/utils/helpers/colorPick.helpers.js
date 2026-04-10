const crypto = require('crypto');

const DEFAULT_MULTIPLIERS = { red: 1.5, green: 2.0, blue: 3.0 };
const DEFAULT_WEIGHTS     = { red: 50, green: 35, blue: 15 };
const VALID_COLORS        = ['red', 'green', 'blue'];

const parsePlatformSetting = (value, fallback) => {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    if (typeof value === 'object' && value !== null) return value;
    return fallback;
  } catch { return fallback; }
};

const weightedPick = (pool) => {
  const total = Object.values(pool).reduce((a, b) => a + b, 0);
  let rand = crypto.randomInt(0, total);
  for (const [color, weight] of Object.entries(pool)) {
    rand -= weight;
    if (rand <= 0) return color;
  }
  return Object.keys(pool)[0];
};

const generateColorResult = (playerChoice, winRate = 45, weights = DEFAULT_WEIGHTS) => {
  const playerWins = crypto.randomInt(0, 100) < winRate;
  let drawnColor;
  if (playerWins) {
    // Force player's color on win by returning their choice
    drawnColor = playerChoice;
  } else {
    const lossPool = {};
    Object.entries(weights).forEach(([c, w]) => {
      if (c !== playerChoice) lossPool[c] = w;
    });
    drawnColor = Object.keys(lossPool).length ? weightedPick(lossPool) : VALID_COLORS.find(c => c !== playerChoice);
  }
  return { drawnColor, isWin: drawnColor === playerChoice };
};

const generateTransactionReference = (type) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand = Array.from({ length: 4 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  return `COLOR-${type.toUpperCase()}-${Date.now()}-${rand}`;
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
  DEFAULT_MULTIPLIERS, DEFAULT_WEIGHTS, VALID_COLORS,
  parsePlatformSetting, generateColorResult, generateTransactionReference, validateStake
};
