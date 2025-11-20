const MESSAGES = {
  SUCCESS: {
    REWARD_CLAIMED: 'Live button reward claimed successfully',
    STATUS_RETRIEVED: 'Live button status retrieved'
  },
  ERROR: {
    ALREADY_CLAIMED: 'You have already claimed your live button reward today',
    TIKTOK_REQUIRED: 'Please add your TikTok handle in your profile before claiming this reward',
    INVALID_TIER: 'Invalid user tier',
    DATABASE_ERROR: 'Failed to process live button click',
    USER_NOT_FOUND: 'User not found',
    FEATURE_DISABLED: 'Live button feature is currently disabled'
  }
};

module.exports = MESSAGES;
