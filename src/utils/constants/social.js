const SOCIAL_BOOST_MESSAGES = {
  // Success messages
  SUCCESS: {
    APPLICATION_SUBMITTED: 'Boost application submitted successfully',
    APPLICATIONS_RETRIEVED: 'Applications retrieved successfully',
    APPLICATION_DETAILS_RETRIEVED: 'Application details retrieved successfully',
    APPLICATION_REVIEWED: 'Application reviewed successfully',
    APPLICATION_APPROVED: 'Application approved successfully',
    APPLICATION_DECLINED: 'Application declined successfully',
    APPLICATION_COMPLETED: 'Application completed successfully',
    APPLICATION_DELETED: 'Application deleted successfully',
    STATISTICS_RETRIEVED: 'Boost statistics retrieved successfully',
    ANALYTICS_RETRIEVED: 'Analytics data retrieved successfully',
    PLATFORM_GUIDELINES_RETRIEVED: 'Platform guidelines retrieved successfully',
    APPLICATION_STATUS_RETRIEVED: 'Application status retrieved successfully',
    BULK_DELETE_SUCCESS: 'Applications deleted successfully'
  },

  // Error messages
  ERROR: {
    DUPLICATE_APPLICATION_PENDING: 'You already have a pending application for this platform',
    DUPLICATE_APPLICATION_APPROVED: 'You already have an approved application for this platform',
    APPLICATION_NOT_FOUND: 'Application not found',
    APPLICATION_ALREADY_REVIEWED: 'Application has already been reviewed',
    ONLY_PENDING_CAN_DELETE: 'Only pending applications can be deleted',
    CANNOT_DELETE_APPROVED_COMPLETED: 'Cannot delete applications that are approved or completed',
    SOME_APPLICATIONS_NOT_FOUND: 'Some applications were not found',
    FAILED_TO_SUBMIT: 'Failed to submit application',
    FAILED_TO_FETCH: 'Failed to fetch applications',
    FAILED_TO_FETCH_DETAILS: 'Failed to fetch application details',
    FAILED_TO_UPDATE: 'Failed to update application',
    FAILED_TO_DELETE: 'Failed to delete application',
    FAILED_TO_FETCH_STATISTICS: 'Failed to fetch statistics',
    FAILED_TO_FETCH_ANALYTICS: 'Failed to fetch analytics data',
    DATABASE_ERROR: 'Database error occurred',
    VALIDATION_ERROR: 'Validation error',
    SERVER_ERROR: 'Internal server error'
  },

  // Validation messages
  VALIDATION: {
    PLATFORM_REQUIRED: 'Platform is required',
    PLATFORM_INVALID: 'Platform must be one of: tiktok, instagram, twitter, youtube',
    USERNAME_REQUIRED: 'Username is required',
    USERNAME_LENGTH: 'Username must be between 1 and 100 characters',
    PHONE_REQUIRED: 'Phone number is required',
    PHONE_INVALID: 'Please provide a valid mobile phone number',
    CURRENT_FOLLOWERS_REQUIRED: 'Current followers count is required',
    CURRENT_FOLLOWERS_INVALID: 'Current followers must be a valid number between 0 and 10,000,000',
    DESIRED_FOLLOWERS_REQUIRED: 'Desired followers count is required',
    DESIRED_FOLLOWERS_INVALID: 'Desired followers must be a valid number between 1 and 10,000,000',
    DESIRED_MUST_BE_GREATER: 'Desired followers must be greater than current followers',
    STATUS_REQUIRED: 'Status is required',
    STATUS_INVALID: 'Status must be one of: approved, declined, completed',
    ADMIN_NOTES_TOO_LONG: 'Admin notes cannot exceed 1000 characters',
    INVALID_APPLICATION_ID: 'Invalid application ID format',
    PAGE_INVALID: 'Page must be a positive integer',
    LIMIT_INVALID: 'Limit must be between 1 and 100',
    SEARCH_LENGTH: 'Search term must be between 1 and 100 characters',
    APPLICATION_IDS_REQUIRED: 'Application IDs must be an array with 1-50 items',
    APPLICATION_ID_INVALID: 'Each application ID must be a valid UUID',
    ACTION_REQUIRED: 'Action is required',
    ACTION_INVALID: 'Action must be one of: approve, decline, complete, delete'
  },

  // Platform specific username validation
  PLATFORM_USERNAME: {
    TIKTOK: 'TikTok username must be 1-24 characters (letters, numbers, dots, underscores)',
    INSTAGRAM: 'Instagram username must be 1-30 characters (letters, numbers, dots, underscores)',
    TWITTER: 'Twitter/X username must be 1-15 characters (letters, numbers, underscores)',
    YOUTUBE: 'YouTube username must be 1-100 characters (letters, numbers, underscores, dots, hyphens)'
  },

  // Status descriptions
  STATUS_DESCRIPTIONS: {
    PENDING: 'Your application is being reviewed by our team',
    APPROVED: 'Your application has been approved and boost is in progress',
    DECLINED: 'Your application has been declined. Please check admin notes for details',
    COMPLETED: 'Your social media boost has been completed successfully'
  }
};

module.exports = SOCIAL_BOOST_MESSAGES;