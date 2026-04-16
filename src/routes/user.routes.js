const express = require('express');
const userController = require('../controllers/user.controller');
// const { validateProfileUpdate } = require('../utils/validators/auth');
const { authMiddleware } = require('../middleware/auth.middleware');
const { 
  validateTransactionQuery,
  validateActivityQuery
} = require('../utils/validators/user');

const userRouter = express.Router();

// All user routes require authentication
userRouter.use(authMiddleware);

// User dashboard and profile routes
userRouter.get('/dashboard', userController.getDashboard);
userRouter.put('/profile',  userController.updateProfile);

// Transaction and wallet routes
userRouter.get('/transactions', validateTransactionQuery, userController.getTransactions);
userRouter.get('/wallet', userController.getWalletDetails);
userRouter.put('/wallet/update', userController.updateWallet);
userRouter.get('/activity', validateActivityQuery, userController.getActivitySummary);
userRouter.post('/merchant/apply', userController.applyForMerchant);
userRouter.get('/vendors', userController.getVendors);
userRouter.get('/settings', userController.getPublicSettings);

module.exports = userRouter;   