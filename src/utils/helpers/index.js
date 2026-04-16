const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require("dotenv").config();


// Encryption key for storing original passwords  
const ENCRYPTION_KEY = process.env.PASSWORD_ENCRYPTION_KEY  

// Encrypt original password for admin viewing
const encryptPassword = (text) => {
  if (!text) return null;
  const key_string = process.env.PASSWORD_ENCRYPTION_KEY || 'fallback-secret-key-do-not-use-in-prod';
  
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(key_string, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error.message);
    return null;
  }
};

// Modern decryption using createDecipheriv
const decryptPassword = (encryptedText) => {
  if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
    return 'Not Available';
  }

  const key_string = process.env.PASSWORD_ENCRYPTION_KEY;
  if (!key_string) {
    return 'Config Error: Key Missing';
  }
  
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(key_string, 'salt', 32);
    
    // Split IV and encrypted data
    const [ivHex, encrypted] = encryptedText.split(':');
    if (!ivHex || !encrypted) return 'Invalid Format';
    
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    // Only log if it's not a common "bad decrypt" (which happens for old/incompatible data)
    if (error.code !== 'ERR_OSSL_BAD_DECRYPT') {
      console.error('Decryption system error:', error.message);
    }
    return 'Unable to decrypt (Key Mismatch)';
  }
};

// Generate unique referral code
const generateReferralCode = async (username) => {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${username.toUpperCase().slice(0, 4)}${timestamp.slice(-4)}${random}`;
};

// Generate JWT token
const generateToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
};

// Compare password
const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

// Format response
const formatResponse = (status, message, data = null) => {
  return {
    status,
    message,
    ...(data && { data })
  };
};

// Get welcome bonus based on package
const getWelcomeBonus = (packageType) => {
  const bonuses = {
    'Amateur': 8500,
    'Pro': 13000
  };
  return bonuses[packageType] || 0;
};

// Get affiliate bonus based on package
const getAffiliateBonus = (packageType) => {
  const bonuses = {
    'Amateur': 7400,
    'Pro': 12000
  };
  return bonuses[packageType] || 0;
};

// Get daily KASHcoin gain based on package
const getDailyKASHcoinGain = (packageType) => {
  const gains = {
    'Amateur': 2000,
    'Pro': 5000
  };
  return gains[packageType] || 0;
};

// Get referral earnings based on package and level
const getReferralEarnings = (packageType, level) => {
  const earnings = {
    'Amateur': { 1: 200, 2: 100 },
    'Pro': { 1: 400, 2: 100 }
  };
  return earnings[packageType]?.[level] || 0;
};
 
 


module.exports = {
  generateReferralCode,
  generateToken,
  verifyToken,
  hashPassword,
  comparePassword,
  formatResponse,
  getWelcomeBonus,
  getAffiliateBonus,
  getDailyKASHcoinGain,
  getReferralEarnings,  encryptPassword, decryptPassword
};