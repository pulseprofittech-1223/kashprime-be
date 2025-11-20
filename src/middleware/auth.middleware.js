const { verifyToken } = require('../utils/helpers');
const { formatResponse } = require('../utils/helpers');
const MESSAGES = require('../utils/constants/messages');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        formatResponse('error', MESSAGES.ERROR.UNAUTHORIZED)
      );
    }

    const token = authHeader.substring(7);

    if (!token) {
      return res.status(401).json(
        formatResponse('error', MESSAGES.ERROR.UNAUTHORIZED)
      );
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json(
      formatResponse('error', MESSAGES.ERROR.UNAUTHORIZED)
    );
  }
};

// Admin-only middleware
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json(
      formatResponse('error', MESSAGES.ERROR.UNAUTHORIZED)
    );
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json(
      formatResponse('error', 'Access denied. Admin access required.')
    );
  }

  next();
};

module.exports = {
  authMiddleware,
  requireAdmin
};