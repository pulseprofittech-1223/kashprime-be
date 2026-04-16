// KASHFeed Constants and Messages
// File: src/utils/constants/kashfeed.js

const messages = {
  SUCCESS: {
    POST_CREATED: 'Blog post created successfully and submitted for review',
    POST_UPDATED: 'Blog post updated successfully',
    POST_DELETED: 'Blog post deleted successfully',
    POST_RETRIEVED: 'Blog post retrieved successfully',
    POSTS_RETRIEVED: 'Blog posts retrieved successfully',
    POST_REVIEWED: 'Blog post reviewed successfully',
    COMMENT_ADDED: 'Comment added successfully',
    COMMENT_DELETED: 'Comment deleted successfully',
    COMMENTS_RETRIEVED: 'Comments retrieved successfully',
    CATEGORIES_RETRIEVED: 'Categories retrieved successfully',
    STATISTICS_RETRIEVED: 'Statistics retrieved successfully',
    BULK_DELETE_COMPLETED: 'Bulk delete operation completed'
  },

  ERROR: {
    SERVER_ERROR: 'Internal server error. Please try again later.',
    VALIDATION_ERROR: 'Validation error. Please check your input.',
    POST_NOT_FOUND: 'Blog post not found or access denied',
    COMMENT_NOT_FOUND: 'Comment not found or access denied',
    UNAUTHORIZED: 'Unauthorized access',
    FORBIDDEN: 'Access forbidden',
    INVALID_POST_IDS: 'Invalid post IDs provided',
    UPLOAD_ERROR: 'Failed to upload image. Please try again.',
    INVALID_FILE_TYPE: 'Invalid file type. Only images are allowed.',
    FILE_TOO_LARGE: 'File too large. Maximum size is 5MB.',
    INVALID_CATEGORY: 'Invalid category selected'
  },

  STATUS_DESCRIPTIONS: {
    pending: 'Awaiting admin review',
    approved: 'Approved and published',
    rejected: 'Rejected by admin',
    draft: 'Saved as draft'
  },

  CATEGORIES: {
    GENERAL: 'general',
    TECHNOLOGY: 'technology',
    BUSINESS: 'business',
    LIFESTYLE: 'lifestyle',
    HEALTH: 'health',
    FINANCE: 'finance',
    EDUCATION: 'education',
    ENTERTAINMENT: 'entertainment',
    SPORTS: 'sports',
    TRAVEL: 'travel',
    FOOD: 'food'
  },

  SORT_OPTIONS: {
    LATEST: 'latest',
    POPULAR: 'popular',
    COMMENTED: 'commented'
  },

  POST_STATUS: {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    DRAFT: 'draft'
  },

  COMMENT_STATUS: {
    APPROVED: 'approved',
    PENDING: 'pending',
    REJECTED: 'rejected'
  }
};

module.exports = messages;