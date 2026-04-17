const { supabaseAdmin } = require('../services/supabase.service');
const { formatResponse } = require('../utils/responseFormatter');
const { logActivity } = require('../utils/activityLogger');

const getKashAdsSettings = async () => {
  const { data: settings, error } = await supabaseAdmin
    .from('platform_settings')
    .select('setting_key, setting_value')
    .in('setting_key', [
      'kash_ads_reward_amount',
      'kash_ads_reward_amount_free',
      'kash_ads_reward_amount_pro',
      'kash_ads_clicks_required',
      'kash_ads_cooldown_hours',
      'kash_ads_cooldown_hours_pro',
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
    rewardAmountFree: parseInt(settingsMap.kash_ads_reward_amount_free || settingsMap.kash_ads_reward_amount) || 500,
    rewardAmountPro: parseInt(settingsMap.kash_ads_reward_amount_pro) || 1000,
    clicksRequired: parseInt(settingsMap.kash_ads_clicks_required) || 5,
    cooldownHoursFree: parseInt(settingsMap.kash_ads_cooldown_hours) || 6,
    cooldownHoursPro: parseInt(settingsMap.kash_ads_cooldown_hours_pro) || 4,
    directLinks: directLinks
  };
};

const getKashAdsStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const settings = await getKashAdsSettings();
    const { rewardAmountFree, rewardAmountPro, clicksRequired, cooldownHoursFree, cooldownHoursPro, directLinks } = settings;

    // Fetch user for tier info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_tier')
      .eq('id', userId)
      .single();

    if (userError) throw userError;
    const isPro = user?.user_tier === 'Pro';
    const dynamicReward = isPro ? rewardAmountPro : rewardAmountFree;

    let { data: kashAds, error } = await supabaseAdmin
      .from('kash_ads')
      .upsert({ user_id: userId }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    const now = new Date();
    const lastRewardAt = kashAds.last_reward_at ? new Date(kashAds.last_reward_at) : null;
    
    // Both Free and Pro endure explicit cooldowns post-batch.
    const activeCooldownHours = isPro ? cooldownHoursPro : cooldownHoursFree;
    const cooldownEnd = lastRewardAt ? new Date(lastRewardAt.getTime() + (activeCooldownHours * 60 * 60 * 1000)) : null;
    
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
        reward_amount: dynamicReward,
        user_tier: user?.user_tier || 'Free',
        cooldown_hours: activeCooldownHours,
        direct_link: directLink,
        available_links_count: directLinks.length,
        is_on_cooldown: isOnCooldown,
        cooldown_ends_at: isOnCooldown ? cooldownEnd.toISOString() : null,
        cooldown_remaining: timeRemaining ? timeRemaining.total_seconds : 0,
        restriction_reason: isOnCooldown ? 'cooldown' : null,
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
    const { rewardAmountFree, rewardAmountPro, clicksRequired, cooldownHoursFree, cooldownHoursPro } = settings;

    const { data: user } = await supabaseAdmin.from('users').select('user_tier').eq('id', userId).single();
    const isPro = user?.user_tier === 'Pro';
    const dynamicReward = isPro ? rewardAmountPro : rewardAmountFree;

    let { data: kashAds, error } = await supabaseAdmin
      .from('kash_ads')
      .upsert({ user_id: userId }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;

    const now = new Date();
    const lastRewardAt = kashAds.last_reward_at ? new Date(kashAds.last_reward_at) : null;
    const activeCooldownHours = isPro ? cooldownHoursPro : cooldownHoursFree;
    const cooldownEnd = lastRewardAt ? new Date(lastRewardAt.getTime() + (activeCooldownHours * 60 * 60 * 1000)) : null;
    const isOnCooldown = cooldownEnd && now < cooldownEnd;

    if (isOnCooldown) {
      const remainingMs = cooldownEnd - now;
      const totalSeconds = Math.floor(remainingMs / 1000);
      return res.status(403).json(
        formatResponse('error', `You are on cooldown. Wait for it to expire or upgrade to Pro!`, {
          restriction_reason: 'cooldown',
          cooldown_remaining: totalSeconds,
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
        reward_amount: dynamicReward
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
    const { rewardAmountFree, rewardAmountPro, clicksRequired, cooldownHoursFree, cooldownHoursPro } = settings;

    const { data: user } = await supabaseAdmin.from('users').select('user_tier').eq('id', userId).single();
    const isPro = user?.user_tier === 'Pro';
    const dynamicReward = isPro ? rewardAmountPro : rewardAmountFree;

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
    const activeCooldownHours = isPro ? cooldownHoursPro : cooldownHoursFree;
    const cooldownEnd = lastRewardAt ? new Date(lastRewardAt.getTime() + (activeCooldownHours * 60 * 60 * 1000)) : null;
    const isOnCooldown = cooldownEnd && now < cooldownEnd;

    if (isOnCooldown) {
      const remainingMs = cooldownEnd - now;
      const totalSeconds = Math.floor(remainingMs / 1000);
      return res.status(403).json(
        formatResponse('error', 'You are still on cooldown', { 
           restriction_reason: 'cooldown',
           cooldown_remaining: totalSeconds,
           cooldown_ends_at: cooldownEnd.toISOString() 
        })
      );
    }

    if (kashAds.clicks_count < clicksRequired) {
      return res.status(400).json(
        formatResponse('error', `You need ${clicksRequired - kashAds.clicks_count} more ad clicks to claim reward`)
      );
    }

    // Concurrency Lock: Atomic deduction FIRST
    // Use original click count ensuring it matches our memory, preventing concurrent claim processing
    const { data: updatedKashAds, error: kashUpdateError } = await supabaseAdmin
      .from('kash_ads')
      .update({
        clicks_count: 0,
        last_reward_at: now.toISOString(),
        total_rewards_claimed: kashAds.total_rewards_claimed + 1,
        total_coins_earned: parseFloat(kashAds.total_coins_earned || 0) + dynamicReward,
        updated_at: now.toISOString()
      })
      .eq('user_id', userId)
      .eq('clicks_count', kashAds.clicks_count) // explicit optimistic locking
      .select();

    if (kashUpdateError) throw kashUpdateError;

    // Verify optimistic lock successfully grabbed the row
    if (!updatedKashAds || updatedKashAds.length === 0) {
      return res.status(409).json(formatResponse('error', 'Reward already claimed or concurrent request conflict.'));
    }

    // Now safely issue wallet credits 
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('coins_balance')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;

    const newBalance = parseFloat(wallet.coins_balance || 0) + dynamicReward;

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
        amount: dynamicReward,
        status: 'completed',
        reference: reference,
        description: `Kash Ads reward - Watched ${clicksRequired} ads`,
        metadata: {
          feature: 'kash_ads',
          clicks_completed: kashAds.clicks_count,
          claim_number: kashAds.total_rewards_claimed + 1,
          reward_amount_issued: dynamicReward,
          user_tier: user?.user_tier
        }
      });

    if (transactionError) throw transactionError;

    if (kashUpdateError) throw kashUpdateError;

    // Log Activity with deep tracking
    await logActivity(userId, 'ad_reward_claim', { 
        reward_amount: dynamicReward,
        reference_id: reference 
    }, req);

    const nextAvailableAt = new Date(now.getTime() + (activeCooldownHours * 60 * 60 * 1000));

    res.status(200).json(
      formatResponse('success', `🎉 You earned ${dynamicReward} KashCoins!`, {
        reward_amount: dynamicReward,
        new_coins_balance: newBalance,
        next_available_at: nextAvailableAt.toISOString(),
        cooldown_hours: isPro ? 0 : activeCooldownHours,
        total_rewards_claimed: kashAds.total_rewards_claimed + 1,
        total_coins_earned: parseFloat(kashAds.total_coins_earned || 0) + dynamicReward
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
