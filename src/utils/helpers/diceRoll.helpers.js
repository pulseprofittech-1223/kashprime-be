const crypto = require('crypto');

const DEFAULT_MULTIPLIERS = {
  high:  1.9,
  low:   1.9,
  odd:   1.9,
  even:  1.9,
  exact: 5.5,
  sum: { 2:35, 3:17, 4:11, 5:8, 6:6, 7:5, 8:6, 9:8, 10:11, 11:17, 12:35 }
};

const parsePlatformSetting = (value, fallback) => {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    if (typeof value === 'object' && value !== null) return value;
    return fallback;
  } catch { return fallback; }
};

// Server-side roll: win rate decides outcome, then we pick a matching die value
const generateDiceResult = (betType, betValue, winRate = 48) => {
  const playerWins = crypto.randomInt(0, 100) < winRate;

  let die1 = null, die2 = null;

  switch (betType) {
    case 'high':
      die1 = playerWins
        ? [4, 5, 6][crypto.randomInt(0, 3)]
        : [1, 2, 3][crypto.randomInt(0, 3)];
      break;

    case 'low':
      die1 = playerWins
        ? [1, 2, 3][crypto.randomInt(0, 3)]
        : [4, 5, 6][crypto.randomInt(0, 3)];
      break;

    case 'odd':
      die1 = playerWins
        ? [1, 3, 5][crypto.randomInt(0, 3)]
        : [2, 4, 6][crypto.randomInt(0, 3)];
      break;

    case 'even':
      die1 = playerWins
        ? [2, 4, 6][crypto.randomInt(0, 3)]
        : [1, 3, 5][crypto.randomInt(0, 3)];
      break;

    case 'exact':
      if (playerWins) {
        die1 = betValue;
      } else {
        const others = [1,2,3,4,5,6].filter(x => x !== betValue);
        die1 = others[crypto.randomInt(0, others.length)];
      }
      break;

    case 'sum':
      die1 = crypto.randomInt(1, 7);
      if (playerWins) {
        const need = betValue - die1;
        die2 = (need >= 1 && need <= 6) ? need : crypto.randomInt(1, 7);
        // Correcting sum logic if need is physically impossible for die2 (e.g. bet 12 but die1=1. need=11, which die2 can't answer!)
        // So we need to guarantee die1 and die2 can add up to betValue!
        if (need < 1 || need > 6) {
           // We chose a bad die1 for a guaranteed win. Pick pairs correctly.
           const validPairs = [];
           for (let i=1; i<=6; i++) {
             let j = betValue - i;
             if (j >= 1 && j <= 6) validPairs.push([i,j]);
           }
           const chosen = validPairs[crypto.randomInt(0, validPairs.length)];
           die1 = chosen[0];
           die2 = chosen[1];
        }
      } else {
        const badOptions = [];
        for (let i=1; i<=6; i++) {
          if (i + die1 !== betValue) badOptions.push(i);
        }
        die2 = badOptions.length
          ? badOptions[crypto.randomInt(0, badOptions.length)]
          : crypto.randomInt(1, 7);
      }
      break;

    default:
      throw new Error('Invalid bet type');
  }

  return { die1, die2, isWin: playerWins };
};

const getMultiplier = (betType, betValue, multiplierConfig = DEFAULT_MULTIPLIERS) => {
  if (betType === 'sum') return multiplierConfig.sum?.[betValue] ?? 5;
  return multiplierConfig[betType] ?? 1.9;
};

const validateStakeAmount = (amount, minStake, userBalance) => {
  if (!amount || isNaN(amount) || amount <= 0)
    return { valid: false, error: 'Stake amount must be a positive number' };
  if (amount < minStake)
    return { valid: false, error: `Minimum stake is ₦${minStake}` };
  if (amount > userBalance)
    return { valid: false, error: `Insufficient balance. You have ₦${parseFloat(userBalance).toLocaleString()}` };
  return { valid: true, error: null };
};

const generateTransactionReference = (type) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const random = Array.from({ length: 4 }, () =>
    chars[crypto.randomInt(0, chars.length)]
  ).join('');
  return `DICE-${type.toUpperCase()}-${Date.now()}-${random}`;
};

const VALID_BET_TYPES = ['high', 'low', 'odd', 'even', 'exact', 'sum'];

module.exports = {
  DEFAULT_MULTIPLIERS,
  parsePlatformSetting,
  generateDiceResult,
  getMultiplier,
  validateStakeAmount,
  generateTransactionReference,
  VALID_BET_TYPES,
};
