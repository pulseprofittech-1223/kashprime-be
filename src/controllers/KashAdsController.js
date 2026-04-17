const { supabaseAdmin } = require('../services/supabase.service');
const { formatResponse } = require('../utils/responseFormatter');
const { logActivity } = require('../utils/activityLogger');

const getKashAdsSettings = async () => {
  const { data: settings, error } = await supabaseAdmin
    .from('platform_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'kash_ads_reward_amount',
      'kash_ads_clicks_required',
      'kash_ads_cooldown_hours',
      'kash_ads_direct_link'
    ]);

  if (error) throw error;

  const settingsMap = {};
  settings.forEach(s => {
    settingsMap[s.setting_key] = s.setting_value;
  });

  // Handle directLink which can now be an array
  let directLinks = settingsMap.kash_ads_direct_link || [];
  if (typeof directLinks === 'string') {
    try {
      // Try parsing if it's stored as a JSON string
      const parsed = JSON.parse(directLinks);
      directLinks = Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      // If not JSON, it's a single legacy link
      directLinks = [directLinks];
    }
  } else if (!Array.isArray(directLinks)) {
    directLinks = [directLinks];
  }

  // Filter out any empty strings/nulls and clean quotes
  directLinks = directLinks
    .filter(l => l && typeof l === 'string')
    .map(l => l.replace(/^"|"$/g, '').replace(/^'|'$/g, ''));

  return {
    rewardAmount: parseInt(settingsMap.kash_ads_reward_amount) || 500,
    clicksRequired: parseInt(settingsMap.kash_ads_clicks_required) || 5,
    cooldownHours: parseInt(settingsMap.kash_ads_cooldown_hours) || 6,
    directLinks: directLinks
  };
};

const getKashAdsStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await getKashAdsSettings();
    const { rewardAmount, clicksRequired, cooldownHours, directLinks } = settings;

    let { data: kashAds, error } = await supabaseAdmin
      .from('kash_ads')
      .upsert({ user_id: userId }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    const now = new Date();
    const lastRewardAt = kashAds.last_reward_at ? new Date(kashAds.last_reward_at) : null;
    const cooldownEnd = lastRewardAt ? new Date(lastRewardAt.getTime() + (cooldownHours * 60 * 60 * 1000)) : null;
    const isOnCooldown = cooldownEnd && now < cooldownEnd;
    
    let currentClicks = kashAds.clicks_count;
    
    // Determine which link to show based on total progress to ensure rotation
    let directLink = null;
    if (directLinks.length > 0) {
      const totalProgress = (kashAds.total_rewards_claimed * clicksRequired) + currentClicks;
      directLink = directLinks[totalProgress % directLinks.length];
    }

    let timeRemaining = null;
    if (isOnCooldown) {
      const remainingMs = cooldownEnd - now;
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
      timeRemaining = { hours, minutes, seconds, total_seconds: Math.floor(remainingMs / 1000) };
    }

    res.status(200).json(
      formatResponse('success', 'Kash Ads status retrieved', {
        clicks_count: currentClicks,
        clicks_required: clicksRequired,
        clicks_remaining: Math.max(0, clicksRequired - currentClicks),
        reward_amount: rewardAmount,
        cooldown_hours: cooldownHours,
        direct_link: directLink,
        available_links_count: directLinks.length,
        is_on_cooldown: isOnCooldown,
        cooldown_ends_at: cooldownEnd ? cooldownEnd.toISOString() : null,
        time_remaining: timeRemaining,
        can_click: !isOnCooldown && currentClicks < clicksRequired && !!directLink,
        can_claim: !isOnCooldown && currentClicks >= clicksRequired,
        total_rewards_claimed: kashAds.total_rewards_claimed,
        total_coins_earned: parseFloat(kashAds.total_coins_earned || 0)
      })
    );
  } catch (error) {
    console.error('Get Kash Ads status error:', error);
    res.status(500).json(formatResponse('error', error.message));
  }
};

const recordAdClick = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await getKashAdsSettings();
    const { rewardAmount, clicksRequired, cooldownHours } = settings;

    let { data: kashAds, error } = await supabaseAdmin
      .from('kash_ads')
      .upsert({ user_id: userId }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    const now = new Date();
    const lastRewardAt = kashAds.last_reward_at ? new Date(kashAds.last_reward_at) : null;
    const cooldownEnd = lastRewardAt ? new Date(lastRewardAt.getTime() + (cooldownHours * 60 * 60 * 1000)) : null;
    const isOnCooldown = cooldownEnd && now < cooldownEnd;

    if (isOnCooldown) {
      const remainingMs = cooldownEnd - now;
      const hours = Math.floor(remainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      
      return res.status(400).json(
        formatResponse('error', `You're on cooldown. Come back in ${hours}h ${minutes}m`, {
          cooldown_ends_at: cooldownEnd.toISOString()
        })
      );
    }

    let currentClicks = kashAds.clicks_count;
    // Fix: Don't reset to 0 if already full, just tell them to claim
    if (currentClicks >= clicksRequired) {
      return res.status(400).json(
        formatResponse('error', 'You have completed all ad clicks. Claim your reward!')
      );
    }

    const newClickCount = currentClicks + 1;
    const { error: updateError } = await supabaseAdmin
        .from('kash_ads')
        .update({ 
          clicks_count: newClickCount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

    if (updateError) throw updateError;

    // Log Activity
    await logActivity(userId, 'ad_click', { click_count: newClickCount }, req);

    const canClaim = newClickCount >= clicksRequired;

    res.status(200).json(
      formatResponse('success', `Ad click recorded! ${clicksRequired - newClickCount} more to go`, {
        clicks_count: newClickCount,
        clicks_required: clicksRequired,
        clicks_remaining: Math.max(0, clicksRequired - newClickCount),
        can_claim: canClaim,
        reward_amount: rewardAmount
      })
    );
  } catch (error) {
    console.error('Record ad click error:', error);
    res.status(500).json(formatResponse('error', error.message));
  }
};

const claimKashAdsReward = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await getKashAdsSettings();
    const { rewardAmount, clicksRequired, cooldownHours } = settings;

    const { data: kashAds, error } = await supabaseAdmin
      .from('kash_ads')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      return res.status(404).json(formatResponse('error', 'No Kash Ads record found. Watch some ads first!'));
    }

    const now = new Date();
    const lastRewardAt = kashAds.last_reward_at ? new Date(kashAds.last_reward_at) : null;
    const cooldownEnd = lastRewardAt ? new Date(lastRewardAt.getTime() + (cooldownHours * 60 * 60 * 1000)) : null;
    const isOnCooldown = cooldownEnd && now < cooldownEnd;

    if (isOnCooldown) {
      return res.status(400).json(
        formatResponse('error', 'You are still on cooldown', { cooldown_ends_at: cooldownEnd.toISOString() })
      );
    }

    if (kashAds.clicks_count < clicksRequired) {
      return res.status(400).json(
        formatResponse('error', `You need ${clicksRequired - kashAds.clicks_count} more ad clicks to claim reward`)
      );
    }

    // Check user wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('coins_balance')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;

    const newBalance = parseFloat(wallet.coins_balance || 0) + rewardAmount;

    const { error: walletUpdateError } = await supabaseAdmin
      .from('wallets')
      .update({ coins_balance: newBalance })
      .eq('user_id', userId);

    if (walletUpdateError) throw walletUpdateError;

    const reference = `KASH_ADS_${userId.slice(-8).toUpperCase()}_${Date.now()}`;
    const { error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'reward',
        balance_type: 'coins_balance',
        amount: rewardAmount,
        status: 'completed',
        reference: reference,
        description: `Kash Ads reward - Watched ${clicksRequired} ads`,
        metadata: {
          feature: 'kash_ads',
          clicks_completed: clicksRequired,
          claim_number: kashAds.total_rewards_claimed + 1,
          reward_amount: rewardAmount
        }
      });

    if (transactionError) throw transactionError;

    const { error: kashUpdateError } = await supabaseAdmin
      .from('kash_ads')
      .update({
        clicks_count: 0,
        last_reward_at: now.toISOString(),
        total_rewards_claimed: kashAds.total_rewards_claimed + 1,
        total_coins_earned: parseFloat(kashAds.total_coins_earned || 0) + rewardAmount,
        updated_at: now.toISOString()
      })
      .eq('user_id', userId);

    if (kashUpdateError) throw kashUpdateError;

    // Log Activity
    await logActivity(userId, 'ad_reward_claim', { reward_amount: rewardAmount }, req);

    const nextAvailableAt = new Date(now.getTime() + (cooldownHours * 60 * 60 * 1000));

    res.status(200).json(
      formatResponse('success', `🎉 You earned ${rewardAmount} KashCoins!`, {
        reward_amount: rewardAmount,
        new_coins_balance: newBalance,
        next_available_at: nextAvailableAt.toISOString(),
        cooldown_hours: cooldownHours,
        total_rewards_claimed: kashAds.total_rewards_claimed + 1,
        total_coins_earned: parseFloat(kashAds.total_coins_earned || 0) + rewardAmount
      })
    );
  } catch (error) {
    console.error('Claim Kash Ads reward error:', error);
    res.status(500).json(formatResponse('error', error.message));
  }
};

module.exports = {
  getKashAdsStatus,
  recordAdClick,
  claimKashAdsReward
};
