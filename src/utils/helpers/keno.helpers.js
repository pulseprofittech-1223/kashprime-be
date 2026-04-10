const crypto = require('crypto');

const DEFAULT_PAYOUT_TABLES = {
  5:  { 3:1.5, 4:5,   5:25  },
  6:  { 3:1.0, 4:3,   5:10,  6:50  },
  7:  { 3:0.5, 4:2,   5:8,   6:30,  7:100  },
  8:  { 4:1.5, 5:4,   6:15,  7:60,  8:200  },
  9:  { 4:1.0, 5:3,   6:10,  7:40,  8:150,  9:500  },
  10: { 5:2,   6:6,   7:20,  8:80,  9:300, 10:1000 },
};

const parsePlatformSetting = (value, fallback) => {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    if (typeof value === 'object' && value !== null) return value;
    return fallback;
  } catch { return fallback; }
};

const generateDrawnNumbers = (playerPicks, drawCount, range, isWin, payoutTable) => {
  const pickCount        = playerPicks.length;
  const table            = payoutTable[pickCount] || {};
  const matchThresholds  = Object.keys(table).map(Number).sort((a, b) => a - b);
  const minWinMatches    = matchThresholds.length ? matchThresholds[0] : 3;

  const drawn = new Set();

  if (isWin) {
    // Force at least minWinMatches player picks into drawn
    const forcedMatches = Math.min(
      minWinMatches + crypto.randomInt(0, Math.max(1, pickCount - minWinMatches + 1)),
      pickCount
    );
    const shuffledPicks = [...playerPicks].sort(() => Math.random() - 0.5);
    for (let i = 0; i < forcedMatches; i++) drawn.add(shuffledPicks[i]);
  } else {
    // Add fewer than minWinMatches player picks so it stays a loss
    const maxAllowed = Math.max(0, minWinMatches - 1);
    const shuffledPicks = [...playerPicks].sort(() => Math.random() - 0.5);
    for (let i = 0; i < maxAllowed; i++) drawn.add(shuffledPicks[i]);
  }

  // Fill remaining draws from non-pick numbers
  const allNumbers = Array.from({ length: range }, (_, i) => i + 1);
  const nonPicks   = allNumbers.filter(n => !playerPicks.includes(n)).sort(() => Math.random() - 0.5);
  for (const n of nonPicks) {
    if (drawn.size >= drawCount) break;
    drawn.add(n);
  }

  // Edge case: still need more, pull from remaining picks
  for (const n of playerPicks) {
    if (drawn.size >= drawCount) break;
    drawn.add(n);
  }

  return Array.from(drawn).sort((a, b) => a - b);
};

const evaluateResult = (playerPicks, drawnNumbers, payoutTable) => {
  const pickCount = playerPicks.length;
  const matched   = playerPicks.filter(n => drawnNumbers.includes(n));
  const matchCount = matched.length;
  const table     = payoutTable[pickCount] || {};
  const multiplier = table[matchCount] || 0;
  return { matched, matchCount, multiplier, isWin: multiplier > 0 };
};

const generateTransactionReference = (type) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand  = Array.from({ length: 4 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  return `KENO-${type.toUpperCase()}-${Date.now()}-${rand}`;
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
  DEFAULT_PAYOUT_TABLES, parsePlatformSetting,
  generateDrawnNumbers, evaluateResult, generateTransactionReference, validateStake
};
