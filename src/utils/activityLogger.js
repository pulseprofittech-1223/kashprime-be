const { supabaseAdmin } = require('../services/supabase.service');

/**
 * Logs a user activity to the kash_user_activities table
 * 
 * @param {string} userId - ID of the user performing the action
 * @param {string} actionType - Type of action (e.g., 'login', 'game_win')
 * @param {object} metadata - Additional context for the action
 * @param {object} req - Express request object (to extract IP and User Agent)
 */
const logActivity = async (userId, actionType, metadata = {}, req = null) => {
  try {
    if (!userId) return;

    const ipAddress = req ? (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress) : null;
    const userAgent = req ? req.headers['user-agent'] : null;

    // Map severities if needed (defaults to 'low')
    let severity = 'low';
    const highRiskActions = ['withdrawal_request', 'password_change', 'large_bet', 'suspicious_login'];
    const mediumRiskActions = ['profile_update', 'wallet_update', 'game_win'];

    if (highRiskActions.includes(actionType)) severity = 'high';
    else if (mediumRiskActions.includes(actionType)) severity = 'medium';

    const { error } = await supabaseAdmin
      .from('kash_user_activities')
      .insert({
        user_id: userId,
        action_type: actionType,
        metadata: {
          ...metadata,
          user_agent: userAgent,
          severity: severity  
        },
        ip_address: ipAddress,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error logging activity:', error);
    }
  } catch (err) {
    console.error('Activity Logger Exception:', err);
  }
};

module.exports = { logActivity };
