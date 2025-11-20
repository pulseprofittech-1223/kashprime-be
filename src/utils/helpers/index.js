const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require("dotenv").config();


// Encryption key for storing original passwords  
const ENCRYPTION_KEY = process.env.PASSWORD_ENCRYPTION_KEY  

// Encrypt original password for admin viewing
const encryptPassword = (text) => {
  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return null;
  }
};

// Modern decryption using createDecipheriv
const decryptPassword = (encryptedText) => {
  try {
    if (!encryptedText || !encryptedText.includes(':')) {
      return 'Invalid encrypted data';
    }
    
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    
    // Split IV and encrypted data
    const [ivHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return 'Unable to decrypt';
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

// Get daily VOXcoin gain based on package
const getDailyVOXcoinGain = (packageType) => {
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
  getDailyVOXcoinGain,
  getReferralEarnings,  encryptPassword, decryptPassword
};