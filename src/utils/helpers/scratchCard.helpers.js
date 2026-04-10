const crypto = require('crypto');

const ALL_SYMBOLS = ['cherry','lemon','orange','watermelon','diamond','seven'];
const DEFAULT_WEIGHTS = { cherry:40, lemon:25, orange:20, watermelon:10, diamond:4, seven:1 };
const DEFAULT_MULTIPLIERS = {
  cherry:     { 3:1.5,  4:2.25, 5:3.0  },
  lemon:      { 3:2.0,  4:3.0,  5:4.0  },
  orange:     { 3:3.0,  4:4.5,  5:6.0  },
  watermelon: { 3:5.0,  4:7.5,  5:10.0 },
  diamond:    { 3:10.0, 4:15.0, 5:20.0 },
  seven:      { 3:20.0, 4:30.0, 5:40.0 },
};

const parsePlatformSetting = (value, fallback) => {
  try {
    if (typeof value === 'string') return JSON.parse(value);
    if (typeof value === 'object' && value !== null) return value;
    return fallback;
  } catch { return fallback; }
};

const weightedPick = (weights) => {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let rand = crypto.randomInt(0, total);
  for (const [sym, w] of Object.entries(weights)) {
    rand -= w;
    if (rand <= 0) return sym;
  }
  return Object.keys(weights)[0];
};

const generateWinningGrid = (symbolWeights) => {
  const winSymbol  = weightedPick(symbolWeights);
  const matchCount = 3 + crypto.randomInt(0, 3); // 3, 4, or 5

  const grid      = Array(9).fill(null);
  const allPos    = Array.from({ length: 9 }, (_, i) => i);
  const winPos    = [];

  while (winPos.length < matchCount) {
    const idx = crypto.randomInt(0, allPos.length);
    winPos.push(allPos.splice(idx, 1)[0]);
  }
  winPos.forEach(p => { grid[p] = winSymbol; });

  const otherSymbols = ALL_SYMBOLS.filter(s => s !== winSymbol);
  allPos.forEach(p => { grid[p] = otherSymbols[crypto.randomInt(0, otherSymbols.length)]; });

  // Break any accidental extra 3-match from fill
  const counts = {};
  grid.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
  for (const [sym, count] of Object.entries(counts)) {
    if (sym !== winSymbol && count >= 3) {
      let replaced = 0;
      for (let i = 0; i < 9 && replaced < count - 2; i++) {
        if (grid[i] === sym && !winPos.includes(i)) {
          grid[i] = 'cherry';
          replaced++;
        }
      }
    }
  }
  return { grid, winSymbol, matchCount };
};

const generateLosingGrid = () => {
  const grid = Array.from({ length: 9 }, () => ALL_SYMBOLS[crypto.randomInt(0, ALL_SYMBOLS.length)]);
  const counts = {};
  grid.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
  for (const [sym, count] of Object.entries(counts)) {
    if (count >= 3) {
      let broken = 0;
      for (let i = 0; i < 9 && broken < count - 2; i++) {
        if (grid[i] === sym) {
          const others = ALL_SYMBOLS.filter(s => s !== sym);
          grid[i] = others[crypto.randomInt(0, others.length)];
          broken++;
        }
      }
    }
  }
  return grid;
};

const generateScratchCard = (winRate, symbolWeights, multiplierConfig) => {
  const playerWins = crypto.randomInt(0, 100) < winRate;
  if (playerWins) {
    const { grid, winSymbol, matchCount } = generateWinningGrid(symbolWeights);
    const clampedCount = Math.min(matchCount, 5);
    const multiplier   = multiplierConfig[winSymbol]?.[clampedCount] || 1.5;
    return { grid, isWin: true, matchedSymbol: winSymbol, matchCount, multiplier };
  } else {
    const grid = generateLosingGrid();
    return { grid, isWin: false, matchedSymbol: null, matchCount: 0, multiplier: 0 };
  }
};

const generateTransactionReference = (type) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const rand  = Array.from({ length: 4 }, () => chars[crypto.randomInt(0, chars.length)]).join('');
  return `SCRATCH-${type.toUpperCase()}-${Date.now()}-${rand}`;
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
  DEFAULT_WEIGHTS, DEFAULT_MULTIPLIERS, ALL_SYMBOLS,
  parsePlatformSetting, generateScratchCard, generateTransactionReference, validateStake
};
