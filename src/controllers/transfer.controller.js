const { supabaseAdmin } = require('../services/supabase.service');
const bcrypt = require('bcryptjs');

const transferToGamingWallet = async (req, res) => {
  try {
    const { amount, transaction_pin } = req.body;
    const userId = req.user.id;

    // Get user tier and wallet info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_tier')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Validate user tier
    if (!['Amateur', 'Pro'].includes(user.user_tier)) {
      return res.status(403).json({
        status: 'error',
        message: 'Only Amateur and Pro users can transfer to gaming wallet'
      });
    }

    // Get wallet details
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }

    // Check if user has set transaction PIN
    if (!wallet.transaction_pin) {
      return res.status(400).json({
        status: 'error',
        message: 'Please set your transaction PIN first'
      });
    }

    // Check if PIN is locked
    if (wallet.pin_locked_until && new Date(wallet.pin_locked_until) > new Date()) {
      return res.status(403).json({
        status: 'error',
        message: 'Transaction PIN is temporarily locked. Please try again later.'
      });
    }

    // Verify transaction PIN
    const isPinValid = await bcrypt.compare(transaction_pin, wallet.transaction_pin);
    
    if (!isPinValid) {
      // Increment PIN attempts
      const newAttempts = (wallet.pin_attempts || 0) + 1;
      let updateData = { pin_attempts: newAttempts };

      // Lock PIN after 3 failed attempts for 30 minutes
      if (newAttempts >= 3) {
        updateData.pin_locked_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      }

      await supabaseAdmin
        .from('wallets')
        .update(updateData)
        .eq('user_id', userId);

      return res.status(401).json({
        status: 'error',
        message: `Invalid transaction PIN. ${newAttempts >= 3 ? 'PIN locked for 30 minutes.' : `${3 - newAttempts} attempts remaining.`}`
      });
    }

    // Reset PIN attempts on successful verification
    await supabaseAdmin
      .from('wallets')
      .update({ pin_attempts: 0, pin_locked_until: null })
      .eq('user_id', userId);

    // Get minimum threshold from platform settings
    const thresholdKey = user.user_tier === 'Amateur' 
      ? 'transfer_min_threshold_amateur' 
      : 'transfer_min_threshold_pro';

    const { data: thresholdSetting, error: thresholdError } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', thresholdKey)
      .single();

    if (thresholdError) {
      console.error('Error fetching threshold setting:', thresholdError);
    }

    // Default thresholds if settings not found
    const defaultThresholds = {
      'Amateur': 16000,
      'Pro': 26000
    };

    const minThreshold = thresholdSetting?.setting_value 
      ? parseFloat(thresholdSetting.setting_value) 
      : defaultThresholds[user.user_tier];

    // Calculate total withdrawable balance
    const tier2Earnings = parseFloat(wallet.tier2_earnings || 0);
    const tier1Earnings = parseFloat(wallet.tier1_earnings || 0);
    const managerEarnings = parseFloat(wallet.manager_earnings || 0);
    const growthBonus = parseFloat(wallet.growth_bonus || 0);
    
    const totalWithdrawable = tier2Earnings + tier1Earnings + managerEarnings + growthBonus;

    // Check if total withdrawable balance meets minimum threshold
    if (totalWithdrawable < minThreshold) {
      return res.status(400).json({
        status: 'error',
        message: `Your total withdrawable balance (₦${totalWithdrawable.toLocaleString()}) is below the minimum threshold of ₦${minThreshold.toLocaleString()} for ${user.user_tier} users`
      });
    }

    // Validate transfer amount
    if (amount <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Transfer amount must be greater than zero'
      });
    }

    if (amount > totalWithdrawable) {
      return res.status(400).json({
        status: 'error',
        message: `Insufficient balance. You have ₦${totalWithdrawable.toLocaleString()} available for transfer`
      });
    }

    // Deduct from smallest to largest balance
    let remainingAmount = amount;
    let deductions = {
      tier2_earnings: 0,
      tier1_earnings: 0,
      manager_earnings: 0,
      growth_bonus: 0
    };

    // Sort balances from smallest to largest
    const balances = [
      { key: 'tier2_earnings', value: tier2Earnings },
      { key: 'tier1_earnings', value: tier1Earnings },
      { key: 'manager_earnings', value: managerEarnings },
      { key: 'growth_bonus', value: growthBonus }
    ].sort((a, b) => a.value - b.value);

    // Deduct from each balance in order
    for (const balance of balances) {
      if (remainingAmount <= 0) break;

      const deductAmount = Math.min(balance.value, remainingAmount);
      deductions[balance.key] = deductAmount;
      remainingAmount -= deductAmount;
    }

    // Calculate new balances
    const newTier2 = tier2Earnings - deductions.tier2_earnings;
    const newTier1 = tier1Earnings - deductions.tier1_earnings;
    const newManager = managerEarnings - deductions.manager_earnings;
    const newGrowth = growthBonus - deductions.growth_bonus;
    const newGamingWallet = parseFloat(wallet.gaming_wallet || 0) + amount;

    // Update wallet with new balances
    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({
        tier2_earnings: newTier2,
        tier1_earnings: newTier1,
        manager_earnings: newManager,
        growth_bonus: newGrowth,
        gaming_wallet: newGamingWallet
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    // Create transaction record for the transfer
    const { data: transaction, error: transError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'transfer',
        amount,
        currency: 'NGN',
        status: 'completed',
        description: `Transfer to gaming wallet - ₦${amount.toLocaleString()}`,
        reference: `TRF-${Date.now()}-${userId.slice(-4).toUpperCase()}`,
        metadata: {
          transfer_type: 'withdrawable_to_gaming',
          deductions: deductions,
          user_tier: user.user_tier,
          threshold_applied: minThreshold
        }
      })
      .select()
      .single();

    if (transError) throw transError;

    res.status(200).json({
      status: 'success',
      message: 'Transfer to gaming wallet successful',
      data: {
        transaction: {
          id: transaction.id,
          reference: transaction.reference,
          amount: transaction.amount,
          status: transaction.status,
          created_at: transaction.created_at
        },
        deduction_breakdown: {
          tier2_earnings: deductions.tier2_earnings,
          tier1_earnings: deductions.tier1_earnings,
          manager_earnings: deductions.manager_earnings,
          growth_bonus: deductions.growth_bonus
        },
        new_balances: {
          tier2_earnings: newTier2,
          tier1_earnings: newTier1,
          manager_earnings: newManager,
          growth_bonus: newGrowth,
          gaming_wallet: newGamingWallet,
          total_withdrawable: newTier2 + newTier1 + newManager + newGrowth
        }
      }
    });

  } catch (error) {
    console.error('Transfer to gaming wallet error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const getTransferHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10
    } = req.query;

    const offset = (page - 1) * limit;
    const userId = req.user.id;

    const { data: transfers, error } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('transaction_type', 'transfer')
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get total count
    const { count: totalCount } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('transaction_type', 'transfer');

    res.status(200).json({
      status: 'success',
      message: 'Transfer history retrieved successfully',
      data: {
        transfers,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalCount / limit),
          total_transfers: totalCount,
          has_next: offset + limit < totalCount,
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get transfer history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const getTransferInfo = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user tier and wallet info
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_tier')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get wallet details
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('tier2_earnings, tier1_earnings, manager_earnings, growth_bonus, gaming_wallet')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }

    // Get minimum threshold from platform settings
    const thresholdKey = user.user_tier === 'Amateur' 
      ? 'transfer_min_threshold_amateur' 
      : 'transfer_min_threshold_pro';

    const { data: thresholdSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', thresholdKey)
      .single();

    // Default thresholds if settings not found
    const defaultThresholds = {
      'Amateur': 16000,
      'Pro': 26000
    };

    const minThreshold = thresholdSetting?.setting_value 
      ? parseFloat(thresholdSetting.setting_value) 
      : defaultThresholds[user.user_tier];

    // Calculate total withdrawable
    const totalWithdrawable = 
      parseFloat(wallet.tier2_earnings || 0) +
      parseFloat(wallet.tier1_earnings || 0) +
      parseFloat(wallet.manager_earnings || 0) +
      parseFloat(wallet.growth_bonus || 0);

    const canTransfer = ['Amateur', 'Pro'].includes(user.user_tier) && totalWithdrawable >= minThreshold;

    res.status(200).json({
      status: 'success',
      message: 'Transfer information retrieved successfully',
      data: {
        user_tier: user.user_tier,
        minimum_threshold: minThreshold,
        total_withdrawable: totalWithdrawable,
        can_transfer: canTransfer,
        reason: !canTransfer 
          ? (user.user_tier !== 'Amateur' && user.user_tier !== 'Pro'
              ? 'Only Amateur and Pro users can transfer to gaming wallet' 
              : `Minimum balance of ₦${minThreshold.toLocaleString()} required`)
          : null,
        breakdown: {
          tier2_earnings: parseFloat(wallet.tier2_earnings || 0),
          tier1_earnings: parseFloat(wallet.tier1_earnings || 0),
          manager_earnings: parseFloat(wallet.manager_earnings || 0),
          growth_bonus: parseFloat(wallet.growth_bonus || 0)
        },
        current_gaming_wallet: parseFloat(wallet.gaming_wallet || 0)
      }
    });

  } catch (error) {
    console.error('Get transfer info error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  transferToGamingWallet,
  getTransferHistory,
  getTransferInfo
};