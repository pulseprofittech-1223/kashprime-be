const { supabaseAdmin } = require('../services/supabase.service');
const bcrypt = require('bcryptjs');

const createWithdrawalRequest = async (req, res) => {
  try {
    const { amount, balance_type, transaction_pin } = req.body;
    const userId = req.user.id;
    // Validate balance_type
    const validBalanceTypes = ['coins_balance', 'games_balance', 'referral_balance', 'investment_balance'];
    if (!balance_type || !validBalanceTypes.includes(balance_type)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid balance type. Must be one of: ${validBalanceTypes.join(', ')}`
      });
    }
    // Check if withdrawals are enabled
    const { data: setting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'withdrawal_enabled')
      .single();
    if (setting?.setting_value === 'false' || setting?.setting_value === false) {
      return res.status(403).json({
        status: 'error',
        message: 'Withdrawals are currently disabled'
      });
    }
    // Get user information to determine tier
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_tier, role')
      .eq('id', userId)
      .single();
    if (userError || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }
    const userTier = user.user_tier || 'Free';
    // Get withdrawal limits from platform settings
    const settingKeys = [
      'max_withdrawal_amount',
      'min_withdrawal_coins_free',
      'min_withdrawal_coins_pro',
      'min_withdrawal_games',
      'min_withdrawal_referral',
      'min_withdrawal_investment'
    ];
    const { data: limits } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value')
      .in('setting_key', settingKeys);
    const limitsMap = {};
    limits?.forEach(l => {
      limitsMap[l.setting_key] = parseFloat(l.setting_value);
    });
    const maxAmount = limitsMap['max_withdrawal_amount'] || 500000;

    // Determine minimum withdrawal based on balance type and user tier
    let minAmount;
    if (balance_type === 'coins_balance') {
      minAmount = userTier === 'Pro' 
        ? (limitsMap['min_withdrawal_coins_pro'] || 15000)
        : (limitsMap['min_withdrawal_coins_free'] || 30000);
    } else if (balance_type === 'games_balance') {
      minAmount = limitsMap['min_withdrawal_games'] || 1000;
    } else if (balance_type === 'referral_balance') {
      // MERCHANTS ONLY CHECK FOR REFERRAL WITHDRAWAL
      if (user.role !== 'merchant') {
        const minRefsNeeded = limitsMap['merchant_min_referrals'] || 10;
        const minRefDeposit = limitsMap['merchant_min_referral_deposit'] || 5000;

        // Check if user has met criteria
        const { data: directReferrals } = await supabaseAdmin
           .from('users')
           .select('id')
           .eq('referred_by', userId);

        let validCount = 0;
        if (directReferrals && directReferrals.length > 0) {
           for (const refUser of directReferrals) {
              const { data: deposits } = await supabaseAdmin
                 .from('transactions')
                 .select('amount')
                 .eq('user_id', refUser.id)
                 .eq('transaction_type', 'deposit')
                 .eq('status', 'completed');
              const totalDeposit = deposits?.reduce((summ, tx) => summ + parseFloat(tx.amount), 0) || 0;
              if (totalDeposit >= minRefDeposit) {
                 validCount++;
              }
           }
        }

        if (validCount < minRefsNeeded) {
           return res.status(403).json({
             status: 'error',
             message: `You need at least ${minRefsNeeded} referrals with minimum ₦${minRefDeposit.toLocaleString()} deposits each to withdraw referral earnings. (Current valid: ${validCount}/${minRefsNeeded})`
           });
        } else {
           return res.status(403).json({
             status: 'error',
             message: 'You must apply as a Merchant on your Referral page to withdraw referral earnings.'
           });
        }
      }

      minAmount = limitsMap['min_withdrawal_referral'] || 2500;
    } else if (balance_type === 'investment_balance') {
      minAmount = limitsMap['min_withdrawal_investment'] || 3500;
    }
    // Validate amount
    if (amount < minAmount || amount > maxAmount) {
      return res.status(400).json({
        status: 'error',
        message: `Withdrawal amount must be between ₦${minAmount.toLocaleString()} and ₦${maxAmount.toLocaleString()} for ${balance_type.replace('_', ' ')}`
      });
    }
    // Get user wallet
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
    // Enhanced account information validation
    if (!wallet.account_name || !wallet.bank_name || !wallet.account_number) {
      return res.status(400).json({
        status: 'error',
        message: 'Please set your bank withdrawal information first'
      });
    }
    // Validate account name (minimum 3 characters, letters and spaces only)
    if (wallet.account_name.trim().length < 3 || !/^[a-zA-Z\s]+$/.test(wallet.account_name.trim())) {
      return res.status(400).json({
        status: 'error',
        message: 'Account name must be at least 3 characters and contain only letters'
      });
    }
    // Validate bank name (minimum 3 characters)
    if (wallet.bank_name.trim().length < 3) {
      return res.status(400).json({
        status: 'error',
        message: 'Bank name must be at least 3 characters'
      });
    }
    // Validate account number (must be exactly 10 digits)
    const accountNumber = wallet.account_number.toString().trim();
    if (!/^\d{10}$/.test(accountNumber)) {
      return res.status(400).json({
        status: 'error',
        message: 'Account number must be exactly 10 digits'
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
    // Check sufficient balance for the selected balance type
    const currentBalance = parseFloat(wallet[balance_type] || 0);
    if (currentBalance < amount) {
      return res.status(400).json({
        status: 'error',
        message: `Insufficient ${balance_type.replace('_', ' ')}. Available: ₦${currentBalance.toLocaleString()}`
      });
    }
    // Reset PIN attempts on successful verification
    await supabaseAdmin
      .from('wallets')
      .update({ pin_attempts: 0, pin_locked_until: null })
      .eq('user_id', userId);
    // Deduct from the specific balance type
    const newBalance = currentBalance - amount;
    const totalWithdrawnField = `total_withdrawn_${balance_type.replace('_balance', '')}`;
    const currentTotalWithdrawn = parseFloat(wallet[totalWithdrawnField] || 0);
    const { error: deductError } = await supabaseAdmin
      .from('wallets')
      .update({
        [balance_type]: newBalance,
        [totalWithdrawnField]: currentTotalWithdrawn + amount
      })
      .eq('user_id', userId);
    if (deductError) throw deductError;
    // Create withdrawal transaction
    const { data: transaction, error: transError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'withdrawal',
        balance_type: balance_type,
        amount,
        currency: 'NGN',
        status: 'pending',
        description: `Withdrawal from ${balance_type.replace('_', ' ')} - ₦${amount.toLocaleString()} (${userTier} tier)`,
        reference: `WD-${Date.now()}-${userId.slice(-4).toUpperCase()}`,
        metadata: {
          user_tier: userTier,
          balance_type: balance_type,
          min_amount_applied: minAmount,
          account_name: wallet.account_name,
          bank_name: wallet.bank_name,
          account_number: wallet.account_number,
          previous_balance: currentBalance,
          new_balance: newBalance
        }
      })
      .select()
      .single();
    if (transError) throw transError;
    res.status(201).json({
      status: 'success',
      message: 'Withdrawal request submitted successfully',
      data: {
        transaction: {
          id: transaction.id,
          reference: transaction.reference,
          amount: transaction.amount,
          balance_type: balance_type,
          status: transaction.status,
          user_tier: userTier,
          created_at: transaction.created_at
        },
        remaining_balance: newBalance,
        withdrawal_info: {
          min_amount_for_tier: minAmount,
          max_amount: maxAmount,
          user_tier: userTier,
          balance_type: balance_type
        }
      }
    });
  } catch (error) {
    console.error('Create withdrawal request error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};
const getUserWithdrawals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = '',
      balance_type = ''
    } = req.query;
    const offset = (page - 1) * limit;
    const userId = req.user.id;
    let query = supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal')
      .range(offset, offset + parseInt(limit) - 1)
      .order('created_at', { ascending: false });
    if (status) {
      query = query.eq('status', status);
    }
    if (balance_type) {
      query = query.eq('balance_type', balance_type);
    }
    const { data: withdrawals, error } = await query;
    if (error) throw error;
    // Get total count
    let countQuery = supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('transaction_type', 'withdrawal');
    if (status) {
      countQuery = countQuery.eq('status', status);
    }
    if (balance_type) {
      countQuery = countQuery.eq('balance_type', balance_type);
    }
    const { count: totalCount } = await countQuery;
    res.status(200).json({
      status: 'success',
      message: 'Withdrawal history retrieved successfully',
      data: {
        withdrawals,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalCount / limit),
          total_withdrawals: totalCount,
          has_next: offset + limit < totalCount,
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get user withdrawals error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};
module.exports = {
  createWithdrawalRequest,
  getUserWithdrawals,
};