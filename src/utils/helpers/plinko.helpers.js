const crypto = require('crypto');

const DEFAULT_MULTIPLIERS = {
  low: {
    8:  [5.6,2.1,1.1,1.0,0.5,1.0,1.1,2.1,5.6],
    12: [10,3,1.6,1.4,1.1,1.0,0.5,1.0,1.1,1.4,1.6,3,10],
    16: [16,9,2,1.4,1.4,1.2,1.1,1.0,0.5,1.0,1.1,1.2,1.4,1.4,2,9,16]
  },
  med: {
    8:  [13,3,1.3,0.7,0.4,0.7,1.3,3,13],
    12: [33,11,4,2,1.1,0.6,0.3,0.6,1.1,2,4,11,33],
    16: [110,41,10,5,3,1.5,1.0,0.5,0.3,0.5,1.0,1.5,3,5,10,41,110]
  },
  high: {
    8:  [29,4,1.5,0.3,0.2,0.3,1.5,4,29],
    12: [141,26,5.5,2,0.7,0.2,0.1,0.2,0.7,2,5.5,26,141],
    16: [999,130,26,9,4,2,0.7,0.2,0.1,0.2,0.7,2,4,9,26,130,999]
  }
};

const VALID_RISKS = ['low', 'med', 'high'];
const VALID_ROWS  = [8, 12, 16];

const parsePlatformSetting = (value, fallback) => {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    if (typeof value === 'object' && value !== null) return value;
    return fallback;
  } catch { return fallback; }
};

const generatePlinkoResult = (rows, riskLevel, winRate = 47, multiplierConfig = DEFAULT_MULTIPLIERS) => {
  const playerWins = crypto.randomInt(0, 100) < winRate;
  const mults = multiplierConfig[riskLevel][rows];
  const bucketCount = rows + 1;

  let finalSlot;

  if (playerWins) {
    const winBuckets = mults.reduce((acc, m, i) => { if (m >= 1) acc.push(i); return acc; }, []);
    finalSlot = winBuckets.length
      ? winBuckets[crypto.randomInt(0, winBuckets.length)]
      : Math.floor(bucketCount / 2);
  } else {
    const lossBuckets = mults.reduce((acc, m, i) => { if (m < 1) acc.push(i); return acc; }, []);
    finalSlot = lossBuckets.length
      ? lossBuckets[crypto.randomInt(0, lossBuckets.length)]
      : 0;
  }

  // Build realistic ball path that arrives at finalSlot
  const path = [];
  let pos = 0;
  for (let r = 0; r < rows; r++) {
    const remaining = rows - r;
    const needed    = finalSlot - pos;
    const goRight   = needed / remaining > Math.random();
    pos += goRight ? 1 : 0;
    path.push({ row: r, col: pos, direction: goRight ? 'right' : 'left' });
  }

  // Correct any drift in final position
  if (pos !== finalSlot) {
    path[path.length - 1].col = finalSlot;
  }

  const multiplier = mults[finalSlot];
  return { finalSlot, path, multiplier, isWin: playerWins };
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
  const rand = Array.from({ length: 4 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  return `PLINKO-${type.toUpperCase()}-${Date.now()}-${rand}`;
};

module.exports = {
  DEFAULT_MULTIPLIERS, VALID_RISKS, VALID_ROWS,
  parsePlatformSetting, generatePlinkoResult,
  validateStakeAmount, generateTransactionReference,
};
