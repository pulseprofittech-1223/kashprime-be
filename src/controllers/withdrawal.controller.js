const { supabaseAdmin } = require('../services/supabase.service');
const bcrypt = require('bcryptjs');

const createWithdrawalRequest = async (req, res) => {
  try {
    const { amount, transaction_pin } = req.body;
    const userId = req.user.id;

    // Check if withdrawals are enabled
    const { data: setting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'withdrawal_enabled')
      .single();

    if (setting?.setting_value === false) {
      return res.status(403).json({
        status: 'error',
        message: 'Withdrawals are currently disabled'
      });
    }

    // Get user information to determine plan
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

    // Get plan-based withdrawal limits from settings
    const { data: limits } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'min_withdrawal_amount_amateur',
        'min_withdrawal_amount_pro', 
        'max_withdrawal_amount'
      ]);

    // Determine minimum withdrawal based on user plan
    let minAmount;
    if (user.user_tier === 'Amateur') {
      minAmount = limits?.find(l => l.setting_key === 'min_withdrawal_amount_amateur')?.setting_value || 16000;
    } else if (user.user_tier === 'Pro') {
      minAmount = limits?.find(l => l.setting_key === 'min_withdrawal_amount_pro')?.setting_value || 26000;
    } else {
      minAmount = 16000;
    }

    const maxAmount = limits?.find(l => l.setting_key === 'max_withdrawal_amount')?.setting_value || 500000;

    // Validate amount
    if (amount < minAmount || amount > maxAmount) {
      return res.status(400).json({
        status: 'error',
        message: `Withdrawal amount must be between ₦${Number(minAmount).toLocaleString()} and ₦${Number(maxAmount).toLocaleString()} for ${user.user_tier} users`
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
        message: 'Please set Bank Withdrawal Information'
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

    // Check sufficient balance
    if (wallet.withdrawable_balance < amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Insufficient withdrawable balance'
      });
    }

    // Reset PIN attempts on successful verification
    await supabaseAdmin
      .from('wallets')
      .update({ pin_attempts: 0, pin_locked_until: null })
      .eq('user_id', userId);

    // ===== PROPER DEDUCTION LOGIC =====
    // Calculate deduction breakdown following the proper order
    let remainingAmount = amount;
    const deductionBreakdown = {
      tier2_earnings: 0,
      tier1_earnings: 0,
      manager_earnings: 0,
      growth_bonus: 0
    };

    const newBalances = {
      tier2_earnings: wallet.tier2_earnings || 0,
      tier1_earnings: wallet.tier1_earnings || 0,
      manager_earnings: wallet.manager_earnings || 0,
      growth_bonus: wallet.growth_bonus || 0
    };

    // Deduct from tier2_earnings first
    if (remainingAmount > 0 && newBalances.tier2_earnings > 0) {
      const deduction = Math.min(remainingAmount, newBalances.tier2_earnings);
      deductionBreakdown.tier2_earnings = deduction;
      newBalances.tier2_earnings -= deduction;
      remainingAmount -= deduction;
    }

    // Then tier1_earnings
    if (remainingAmount > 0 && newBalances.tier1_earnings > 0) {
      const deduction = Math.min(remainingAmount, newBalances.tier1_earnings);
      deductionBreakdown.tier1_earnings = deduction;
      newBalances.tier1_earnings -= deduction;
      remainingAmount -= deduction;
    }

    // Then manager_earnings
    if (remainingAmount > 0 && newBalances.manager_earnings > 0) {
      const deduction = Math.min(remainingAmount, newBalances.manager_earnings);
      deductionBreakdown.manager_earnings = deduction;
      newBalances.manager_earnings -= deduction;
      remainingAmount -= deduction;
    }

    // Finally growth_bonus
    if (remainingAmount > 0 && newBalances.growth_bonus > 0) {
      const deduction = Math.min(remainingAmount, newBalances.growth_bonus);
      deductionBreakdown.growth_bonus = deduction;
      newBalances.growth_bonus -= deduction;
      remainingAmount -= deduction;
    }

    // Update the individual earning balances (withdrawable_balance will auto-calculate)
    const { error: deductError } = await supabaseAdmin
      .from('wallets')
      .update({
        tier2_earnings: newBalances.tier2_earnings,
        tier1_earnings: newBalances.tier1_earnings,
        manager_earnings: newBalances.manager_earnings,
        growth_bonus: newBalances.growth_bonus
      })
      .eq('user_id', userId);

    if (deductError) throw deductError;

    // Create withdrawal transaction with deduction breakdown in metadata
    const { data: transaction, error: transError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'withdrawal',
        amount,
        currency: 'NGN',
        status: 'pending',
        description: `Withdrawal request - ₦${amount.toLocaleString()} (${user.user_tier} Plan)`,
        reference: `WD-${Date.now()}-${userId.slice(-4).toUpperCase()}`,
        metadata: {
          user_tier: user.user_tier,
          min_amount_applied: minAmount,
          account_name: wallet.account_name,
          bank_name: wallet.bank_name,
          account_number: wallet.account_number,
          deduction_breakdown: deductionBreakdown,
          original_balances: {
            tier2_earnings: wallet.tier2_earnings || 0,
            tier1_earnings: wallet.tier1_earnings || 0,
            manager_earnings: wallet.manager_earnings || 0,
            growth_bonus: wallet.growth_bonus || 0
          }
        }
      })
      .select()
      .single();

    if (transError) throw transError;

    // Calculate new total withdrawable balance
    const newTotalWithdrawable = 
      newBalances.tier2_earnings + 
      newBalances.tier1_earnings + 
      newBalances.manager_earnings + 
      newBalances.growth_bonus;

    res.status(201).json({
      status: 'success',
      message: 'Withdrawal request submitted successfully',
      data: {
        transaction: {
          id: transaction.id,
          reference: transaction.reference,
          amount: transaction.amount,
          status: transaction.status,
          user_tier: user.user_tier,
          created_at: transaction.created_at
        },
        remaining_balance: newTotalWithdrawable,
        withdrawal_info: {
          min_amount_for_tier: minAmount,
          max_amount: maxAmount,
          user_tier: user.user_tier
        },
        deduction_breakdown: deductionBreakdown
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

const setTransactionPin = async (req, res) => {
  try {
    const { pin, current_password } = req.body;
    const userId = req.user.id;

    // Validate PIN format (4-6 digits)
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({
        status: 'error',
        message: 'Transaction PIN must be 4-6 digits'
      });
    }

    // Verify current password
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('password')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const isPasswordValid = await bcrypt.compare(current_password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid current password'
      });
    }

    // Hash the PIN
    const hashedPin = await bcrypt.hash(pin, 12);

    // Update wallet with new PIN
    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({
        transaction_pin: hashedPin,
        pin_attempts: 0,
        pin_locked_until: null
      })
      .eq('user_id', userId);

    if (updateError) throw updateError;

    res.status(200).json({
      status: 'success',
      message: 'Transaction PIN set successfully'
    });

  } catch (error) {
    console.error('Set transaction PIN error:', error);
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
      status = ''
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
  setTransactionPin,
  getUserWithdrawals,
};