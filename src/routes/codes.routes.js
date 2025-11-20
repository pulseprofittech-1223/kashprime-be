const express = require("express");
const {
  generateCodes,
  getMerchants,
  getCodesStatistics,
  validateCode,
  getMerchantCodes,
  getPackagePrices,
  bulkDeleteUnusedCodes,
  deleteCodes,
 
} = require("../controllers/codes.controller");
const { authMiddleware, requireAdmin,  requireAdminOrMerchant } = require('../middleware/auth.middleware');

const {
  bulkDeleteValidation,
  merchantCodesValidation,
  validateCodeValidation,
  generateCodesValidation,
  validateDeleteCodes,
 
} = require("../utils/validators/codes");

const codesRouter = express.Router();

// Public routes
codesRouter.post('/validate', validateCodeValidation, validateCode);
codesRouter.get('/prices', getPackagePrices);

// Admin routes - Using the new role-based middleware
codesRouter.post('/generate', authMiddleware, requireAdmin, generateCodesValidation, generateCodes);

codesRouter.get('/merchants',  getMerchants);
codesRouter.get('/statistics', authMiddleware, requireAdmin, getCodesStatistics);
codesRouter.delete('/bulk-delete-unused', authMiddleware, requireAdmin, bulkDeleteValidation, bulkDeleteUnusedCodes);

 
// Add this to your package codes routes
codesRouter.delete(
  "/delete", 
  authMiddleware, 
  requireAdmin, 
  validateDeleteCodes, 
  deleteCodes
);

// Merchant routes
codesRouter.get('/my-codes', authMiddleware, requireAdminOrMerchant, merchantCodesValidation, getMerchantCodes);


module.exports = codesRouter;
