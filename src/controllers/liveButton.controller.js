 
const { supabaseAdmin } = require('../services/supabase.service');
const MESSAGES = require('../utils/constants/livebutton');
const { formatResponse } = require('../utils/helpers');

 

// Fallback reward amounts 
const FALLBACK_REWARD_AMOUNTS = {
  Amateur: 250,
  Pro: 500
};

/**
 * Get live button reward amount from platform_settings
 */
const getLiveButtonReward = async (userTier) => {
  try {
    const settingKey = `package_rewards_${userTier.toLowerCase()}_live_button`;
    
    const { data: setting, error } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .single();

    if (error || !setting) {
      console.log(`Using fallback reward for ${userTier}: ${FALLBACK_REWARD_AMOUNTS[userTier]}`);
      return FALLBACK_REWARD_AMOUNTS[userTier];
    }

    // Parse the setting_value (it's stored as JSONB/text)
    const rewardAmount = parseFloat(setting.setting_value);
    
    if (isNaN(rewardAmount) || rewardAmount <= 0) {
      console.log(`Invalid reward amount in settings for ${userTier}, using fallback`);
      return FALLBACK_REWARD_AMOUNTS[userTier];
    }

    return rewardAmount;
  } catch (error) {
    console.error('Error fetching live button reward:', error);
    return FALLBACK_REWARD_AMOUNTS[userTier];
  }
};

/**
 * Process live button click and reward user
 */
const clickLiveButton = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Get user details including tier and TikTok handle
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, user_tier, tiktok_handle')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(
        formatResponse('error', MESSAGES.ERROR.USER_NOT_FOUND)
      );
    }

    // 2. Check if TikTok handle is set
    if (!user.tiktok_handle || user.tiktok_handle.trim() === '') {
      return res.status(422).json(
        formatResponse('error', MESSAGES.ERROR.TIKTOK_REQUIRED)
      );
    }

    // 3. Validate user tier
    if (!FALLBACK_REWARD_AMOUNTS[user.user_tier]) {
      return res.status(400).json(
        formatResponse('error', MESSAGES.ERROR.INVALID_TIER)
      );
    }

    // 4. Check if user has already claimed today
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const { data: existingClick, error: checkError } = await supabaseAdmin
      .from('user_daily_activities')
      .select('id')
      .eq('user_id', userId)
      .eq('activity_type', 'live_button')
      .eq('activity_date', today)
      .single();

    if (existingClick) {
      return res.status(409).json(
        formatResponse('error', MESSAGES.ERROR.ALREADY_CLAIMED)
      );
    }

    // 5. Get reward amount from platform_settings
    const rewardAmount = await getLiveButtonReward(user.user_tier);

    // 6. Start transaction - Update wallet and record activity
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('voxcoin_balance')
      .eq('user_id', userId)
      .single();

    if (walletError) {
      throw new Error('Failed to fetch wallet');
    }

    // Update VOXcoin balance
    const newBalance = parseFloat(wallet.voxcoin_balance) + rewardAmount;
    
    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({
        voxcoin_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error('Failed to update wallet');
    }

    // 7. Record the activity
    const { error: activityError } = await supabaseAdmin
      .from('user_daily_activities')
      .insert({
        user_id: userId,
        activity_type: 'live_button',
        activity_date: today,
        reward_amount: rewardAmount,
        metadata: {
          user_tier: user.user_tier,
          clicked_at: new Date().toISOString(),
          tiktok_handle: user.tiktok_handle
        }
      });

    if (activityError) {
      // Try to rollback wallet update if activity recording fails
      await supabaseAdmin
        .from('wallets')
        .update({
          voxcoin_balance: wallet.voxcoin_balance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);
      
      throw new Error('Failed to record activity');
    }

    // 8. Log transaction for audit trail
    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'reward',
        earning_type: 'live_button',
        amount: rewardAmount,
        currency: 'NGN',
        status: 'completed',
        description: `Live Button reward - ${user.user_tier} tier`,
        metadata: {
          activity_date: today,
          user_tier: user.user_tier
        }
      });

    // 9. Return success response
    res.status(200).json(
      formatResponse('success', MESSAGES.SUCCESS.REWARD_CLAIMED, {
        reward: {
          amount: rewardAmount,
          currency: 'VOXcoin',
          user_tier: user.user_tier,
          new_balance: newBalance,
          next_claim_available: getNextClaimTime()
        }
      })
    );

  } catch (error) {
    console.error('Live button click error:', error);
    res.status(500).json(
      formatResponse('error', MESSAGES.ERROR.DATABASE_ERROR)
    );
  }
};

/**
 * Check if user can claim live button reward today
 */
const getLiveButtonStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user details
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, user_tier, tiktok_handle')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json(
        formatResponse('error', MESSAGES.ERROR.USER_NOT_FOUND)
      );
    }

    // Check if TikTok handle is set
    const hasTikTokHandle = user.tiktok_handle && user.tiktok_handle.trim() !== '';

    // Check if already claimed today
    const today = new Date().toISOString().split('T')[0];
    
    const { data: existingClick } = await supabaseAdmin
      .from('user_daily_activities')
      .select('id, created_at, reward_amount')
      .eq('user_id', userId)
      .eq('activity_type', 'live_button')
      .eq('activity_date', today)
      .single();

    const canClaim = !existingClick && hasTikTokHandle;
    const rewardAmount = await getLiveButtonReward(user.user_tier);

    res.status(200).json(
      formatResponse('success', MESSAGES.SUCCESS.STATUS_RETRIEVED, {
        status: {
          can_claim: canClaim,
          has_tiktok_handle: hasTikTokHandle,
          claimed_today: !!existingClick,
          user_tier: user.user_tier,
          potential_reward: rewardAmount,
          next_claim_available: getNextClaimTime(),
          last_claim: existingClick ? {
            amount: existingClick.reward_amount,
            claimed_at: existingClick.created_at
          } : null
        }
      })
    );

  } catch (error) {
    console.error('Get live button status error:', error);
    res.status(500).json(
      formatResponse('error', MESSAGES.ERROR.DATABASE_ERROR)
    );
  }
};

/**
 * Get user's live button click history
 */
const getLiveButtonHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;
    const offset = (page - 1) * limit;

    const { data: activities, error, count } = await supabaseAdmin
      .from('user_daily_activities')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('activity_type', 'live_button')
      .order('activity_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error('Failed to fetch history');
    }

    // Calculate total earnings from live button
    const totalEarnings = activities.reduce((sum, activity) => 
      sum + parseFloat(activity.reward_amount), 0
    );

    res.status(200).json(
      formatResponse('success', 'Live button history retrieved', {
        history: activities.map(activity => ({
          date: activity.activity_date,
          reward_amount: activity.reward_amount,
          claimed_at: activity.created_at,
          metadata: activity.metadata
        })),
        statistics: {
          total_claims: count,
          total_earnings: totalEarnings,
          current_page: page,
          total_pages: Math.ceil(count / limit),
          has_more: offset + limit < count
        }
      })
    );

  } catch (error) {
    console.error('Get live button history error:', error);
    res.status(500).json(
      formatResponse('error', MESSAGES.ERROR.DATABASE_ERROR)
    );
  }
};

/**
 * Admin: Get live button statistics
 */
const getLiveButtonStatistics = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's clicks
    const { count: todayClicks } = await supabaseAdmin
      .from('user_daily_activities')
      .select('*', { count: 'exact', head: true })
      .eq('activity_type', 'live_button')
      .eq('activity_date', today);

    // Get total clicks
    const { count: totalClicks } = await supabaseAdmin
      .from('user_daily_activities')
      .select('*', { count: 'exact', head: true })
      .eq('activity_type', 'live_button');

    // Get total rewards distributed
    const { data: rewardsData } = await supabaseAdmin
      .from('user_daily_activities')
      .select('reward_amount')
      .eq('activity_type', 'live_button');

    const totalRewards = rewardsData?.reduce((sum, item) => 
      sum + parseFloat(item.reward_amount), 0
    ) || 0;

    // Get clicks by tier
    const { data: tierStats } = await supabaseAdmin
      .from('user_daily_activities')
      .select(`
        reward_amount,
        metadata
      `)
      .eq('activity_type', 'live_button');

    const tierBreakdown = {
      Amateur: { count: 0, total_rewards: 0 },
      Pro: { count: 0, total_rewards: 0 }
    };

    tierStats?.forEach(stat => {
      const tier = stat.metadata?.user_tier;
      if (tier && tierBreakdown[tier]) {
        tierBreakdown[tier].count++;
        tierBreakdown[tier].total_rewards += parseFloat(stat.reward_amount);
      }
    });

    res.status(200).json(
      formatResponse('success', 'Statistics retrieved', {
        statistics: {
          today_clicks: todayClicks || 0,
          total_clicks: totalClicks || 0,
          total_rewards_distributed: totalRewards,
          tier_breakdown: tierBreakdown,
          average_reward: totalClicks ? (totalRewards / totalClicks).toFixed(2) : 0
        }
      })
    );

  } catch (error) {
    console.error('Get live button statistics error:', error);
    res.status(500).json(
      formatResponse('error', MESSAGES.ERROR.DATABASE_ERROR)
    );
  }
};

/**
 * Helper: Calculate next claim time (midnight)
 */
const getNextClaimTime = () => {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow.toISOString();
};

module.exports = {
  clickLiveButton,
  getLiveButtonStatus,
  getLiveButtonHistory,
  getLiveButtonStatistics
};