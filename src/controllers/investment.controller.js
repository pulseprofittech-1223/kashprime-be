const { supabaseAdmin } = require('../services/supabase.service');
const { validationResult } = require('express-validator');
const { formatResponse } = require('../utils/helpers');
const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);

// Get available investment plans
const getPlans = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user tier
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_tier')
      .eq('id', userId)
      .single();

    if (userError) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Get all plan settings
    const { data: settings } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value')
      .or('setting_key.like.investment_plan_%,setting_key.eq.investments_enabled');

    // Convert settings to object
    const settingsMap = {};
    settings?.forEach(s => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    // Check if investments are enabled
    if (settingsMap['investments_enabled'] !== 'true') {
      return res.status(403).json({
        status: 'error',
        message: 'Investments are currently disabled'
      });
    }

    // Build plans array
    const plans = [
      {
        name: 'starter',
        display_name: 'Starter',
        capital: parseFloat(settingsMap['investment_plan_starter_amount'] || 20000),
        roi_percent: parseFloat(settingsMap['investment_plan_starter_roi_percent'] || 20),
        weekly_payout: parseFloat(settingsMap['investment_plan_starter_amount'] || 20000) * 
                      (parseFloat(settingsMap['investment_plan_starter_roi_percent'] || 20) / 100),
        total_return: parseFloat(settingsMap['investment_plan_starter_amount'] || 20000) * 
                     (parseFloat(settingsMap['investment_plan_starter_roi_percent'] || 20) / 100) * 6,
        duration_weeks: 6,
        enabled: settingsMap['investment_plan_starter_enabled'] === 'true',
        available_for: ['Free', 'Pro']
      },
      {
        name: 'amateur',
        display_name: 'Amateur',
        capital: parseFloat(settingsMap['investment_plan_amateur_amount'] || 50000),
        roi_percent: parseFloat(settingsMap['investment_plan_amateur_roi_percent'] || 20),
        weekly_payout: parseFloat(settingsMap['investment_plan_amateur_amount'] || 50000) * 
                      (parseFloat(settingsMap['investment_plan_amateur_roi_percent'] || 20) / 100),
        total_return: parseFloat(settingsMap['investment_plan_amateur_amount'] || 50000) * 
                     (parseFloat(settingsMap['investment_plan_amateur_roi_percent'] || 20) / 100) * 6,
        duration_weeks: 6,
        enabled: settingsMap['investment_plan_amateur_enabled'] === 'true',
        available_for: ['Free', 'Pro']
      },
      {
        name: 'semi_amateur',
        display_name: 'Semi-Amateur',
        capital: parseFloat(settingsMap['investment_plan_semi_amateur_amount'] || 100000),
        roi_percent: parseFloat(settingsMap['investment_plan_semi_amateur_roi_percent'] || 20),
        weekly_payout: parseFloat(settingsMap['investment_plan_semi_amateur_amount'] || 100000) * 
                      (parseFloat(settingsMap['investment_plan_semi_amateur_roi_percent'] || 20) / 100),
        total_return: parseFloat(settingsMap['investment_plan_semi_amateur_amount'] || 100000) * 
                     (parseFloat(settingsMap['investment_plan_semi_amateur_roi_percent'] || 20) / 100) * 6,
        duration_weeks: 6,
        enabled: settingsMap['investment_plan_semi_amateur_enabled'] === 'true',
        available_for: ['Free', 'Pro']
      },
      {
        name: 'pro',
        display_name: 'Pro',
        capital: parseFloat(settingsMap['investment_plan_pro_amount'] || 160000),
        roi_percent: parseFloat(settingsMap['investment_plan_pro_roi_percent'] || 25),
        weekly_payout: parseFloat(settingsMap['investment_plan_pro_amount'] || 160000) * 
                      (parseFloat(settingsMap['investment_plan_pro_roi_percent'] || 25) / 100),
        total_return: parseFloat(settingsMap['investment_plan_pro_amount'] || 160000) * 
                     (parseFloat(settingsMap['investment_plan_pro_roi_percent'] || 25) / 100) * 6,
        duration_weeks: 6,
        enabled: settingsMap['investment_plan_pro_enabled'] === 'true',
        available_for: ['Pro']
      },
      {
        name: 'master',
        display_name: 'Master',
        capital: parseFloat(settingsMap['investment_plan_master_amount'] || 250000),
        roi_percent: parseFloat(settingsMap['investment_plan_master_roi_percent'] || 25),
        weekly_payout: parseFloat(settingsMap['investment_plan_master_amount'] || 250000) * 
                      (parseFloat(settingsMap['investment_plan_master_roi_percent'] || 25) / 100),
        total_return: parseFloat(settingsMap['investment_plan_master_amount'] || 250000) * 
                     (parseFloat(settingsMap['investment_plan_master_roi_percent'] || 25) / 100) * 6,
        duration_weeks: 6,
        enabled: settingsMap['investment_plan_master_enabled'] === 'true',
        available_for: ['Pro']
      }
    ];

    // Filter plans based on user tier and enabled status
    const availablePlans = plans.filter(plan => 
      plan.enabled && plan.available_for.includes(user.user_tier)
    );

    res.json({
      status: 'success',
      message: 'Investment plans retrieved successfully',
      data: {
        plans: availablePlans,
        user_tier: user.user_tier
      }
    });

  } catch (error) {
    console.error('Get investment plans error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Initialize investment payment
const initializePayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        data: { errors: errors.array() }
      });
    }

    const { plan_name } = req.body;
    const userId = req.user.id;

    // Get user details
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, user_tier, full_name')
      .eq('id', userId)
      .single();

    if (userError) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Check if investments are enabled
    const { data: investmentsSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'investments_enabled')
      .single();

    if (investmentsSetting?.setting_value !== 'true') {
      return res.status(403).json({
        status: 'error',
        message: 'Investments are currently disabled'
      });
    }

    // Get plan settings
    const { data: planSettings } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value')
      .like('setting_key', `investment_plan_${plan_name}_%`);

    const planConfig = {};
    planSettings?.forEach(s => {
      const key = s.setting_key.replace(`investment_plan_${plan_name}_`, '');
      planConfig[key] = s.setting_value;
    });

    // Validate plan
    if (!planConfig.amount || !planConfig.roi_percent) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid investment plan'
      });
    }

    if (planConfig.enabled !== 'true') {
      return res.status(403).json({
        status: 'error',
        message: 'This investment plan is currently disabled'
      });
    }

    // Check user tier restrictions
    const proOnlyPlans = ['pro', 'master'];
    if (proOnlyPlans.includes(plan_name) && user.user_tier !== 'Pro') {
      return res.status(403).json({
        status: 'error',
        message: 'This plan is only available for Pro users'
      });
    }

    const capitalAmount = parseFloat(planConfig.amount);
    const roiPercent = parseFloat(planConfig.roi_percent);

    // Generate reference
    const reference = `INV_${plan_name.toUpperCase()}_${userId.slice(-8)}_${Date.now()}`;

    // Initialize Paystack payment
    const paymentData = {
      email: user.email,
      amount: capitalAmount * 100, // Convert to kobo
      reference: reference,
      callback_url: `${process.env.FRONTEND_URL}/investments/success?reference=${reference}`,
      metadata: {
        user_id: userId,
        full_name: user.full_name,
        purpose: 'investment',
        plan_name: plan_name,
        capital_amount: capitalAmount,
        roi_percent: roiPercent
      }
    };

    const initialization = await paystack.transaction.initialize(paymentData);

    if (!initialization.status) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment initialization failed'
      });
    }

    res.json({
      status: 'success',
      message: 'Payment initialized successfully',
      data: {
        authorization_url: initialization.data.authorization_url,
        access_code: initialization.data.access_code,
        reference: reference,
        amount: capitalAmount,
        plan_name: plan_name
      }
    });

  } catch (error) {
    console.error('Initialize investment payment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Verify payment and create investment
const verifyPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        data: { errors: errors.array() }
      });
    }

    const { reference } = req.body;
    const userId = req.user.id;

    // Check if investment already exists
    const { data: existingInvestment } = await supabaseAdmin
      .from('investments')
      .select('id')
      .eq('reference', reference)
      .single();

    if (existingInvestment) {
      return res.status(400).json({
        status: 'error',
        message: 'Investment already created for this payment'
      });
    }

    // Verify payment with Paystack
    const verification = await paystack.transaction.verify(reference);
    if (!verification.status ) {
      return res.status(400).json({
        status: 'error',
        message: 'Payment verification failed'
      });
    }

    const metadata = verification.data.metadata;
    const planName = metadata.plan_name;
    const capitalAmount = parseFloat(metadata.capital_amount);
    const roiPercent = parseFloat(metadata.roi_percent);

    // Calculate investment details
    const weeklyPayoutAmount = capitalAmount * (roiPercent / 100);
    const totalRoiAmount = weeklyPayoutAmount * 6;

    const startDate = new Date();
    const nextPayoutDate = new Date(startDate);
    nextPayoutDate.setDate(nextPayoutDate.getDate() + 7);
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (7 * 6));

    // Create investment
    const { data: investment, error: investmentError } = await supabaseAdmin
      .from('investments')
      .insert({
        user_id: userId,
        plan_name: planName,
        capital_amount: capitalAmount,
        roi_percent: roiPercent,
        weekly_payout_amount: weeklyPayoutAmount,
        total_roi_amount: totalRoiAmount,
        duration_weeks: 6,
        current_week: 0,
        start_date: startDate.toISOString(),
        next_payout_date: nextPayoutDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active',
        reference: reference,
        payment_reference: verification.data.reference
      })
      .select()
      .single();

    if (investmentError) {
      console.error('Investment creation error:', investmentError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create investment'
      });
    }

    // Create payout schedule (6 weeks)
    const payoutRecords = [];
    for (let week = 1; week <= 6; week++) {
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(scheduledDate.getDate() + (7 * week));
      
      payoutRecords.push({
        investment_id: investment.id,
        user_id: userId,
        week_number: week,
        amount: weeklyPayoutAmount,
        status: 'pending',
        scheduled_date: scheduledDate.toISOString()
      });
    }

    const { error: payoutsError } = await supabaseAdmin
      .from('investment_payouts')
      .insert(payoutRecords);

    if (payoutsError) {
      console.error('Payouts creation error:', payoutsError);
    }

    // Create deposit transaction
    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'deposit',
        balance_type: 'investment_balance',
        amount: capitalAmount,
        currency: 'NGN',
        status: 'completed',
        reference: reference,
        description: `Investment deposit - ${planName.replace('_', '-')} plan (₦${capitalAmount.toLocaleString()})`,
        metadata: verification.data
      });

    res.json({
      status: 'success',
      message: 'Investment created successfully',
      data: {
        investment: {
          id: investment.id,
          plan_name: planName,
          capital_amount: capitalAmount,
          roi_percent: roiPercent,
          weekly_payout_amount: weeklyPayoutAmount,
          total_return: totalRoiAmount,
          duration_weeks: 6,
          start_date: investment.start_date,
          next_payout_date: investment.next_payout_date,
          end_date: investment.end_date,
          status: investment.status
        }
      }
    });

  } catch (error) {
    console.error('Verify investment payment error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get user's investments
const getMyInvestments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('investments')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: investments, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      status: 'success',
      message: 'Investments retrieved successfully',
      data: {
        investments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get my investments error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get single investment details
const getInvestmentDetails = async (req, res) => {
  try {
    const { investmentId } = req.params;
    const userId = req.user.id;

    // Get investment
    const { data: investment, error: investmentError } = await supabaseAdmin
      .from('investments')
      .select('*')
      .eq('id', investmentId)
      .eq('user_id', userId)
      .single();

    if (investmentError || !investment) {
      return res.status(404).json({
        status: 'error',
        message: 'Investment not found'
      });
    }

    // Get payouts
    const { data: payouts } = await supabaseAdmin
      .from('investment_payouts')
      .select('*')
      .eq('investment_id', investmentId)
      .order('week_number', { ascending: true });

    res.json({
      status: 'success',
      message: 'Investment details retrieved successfully',
      data: {
        investment,
        payouts: payouts || []
      }
    });

  } catch (error) {
    console.error('Get investment details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get investment dashboard
const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get active investments
    const { data: activeInvestments } = await supabaseAdmin
      .from('investments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    // Get completed investments
    const { data: completedInvestments } = await supabaseAdmin
      .from('investments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'completed');

    // Calculate totals
    const totalInvested = [...(activeInvestments || []), ...(completedInvestments || [])]
      .reduce((sum, inv) => sum + parseFloat(inv.capital_amount), 0);

    const totalRoiEarned = (completedInvestments || [])
      .reduce((sum, inv) => sum + parseFloat(inv.total_paid_out), 0) +
      (activeInvestments || [])
      .reduce((sum, inv) => sum + parseFloat(inv.total_paid_out), 0);

    // Get wallet balance
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('investment_balance')
      .eq('user_id', userId)
      .single();

    // Get next payout info
    const nextPayout = activeInvestments && activeInvestments.length > 0
      ? activeInvestments.reduce((earliest, inv) => {
          const invDate = new Date(inv.next_payout_date);
          const earliestDate = earliest ? new Date(earliest.next_payout_date) : null;
          return !earliestDate || invDate < earliestDate ? inv : earliest;
        }, null)
      : null;

    res.json({
      status: 'success',
      message: 'Investment dashboard retrieved successfully',
      data: {
        summary: {
          total_invested: totalInvested,
          total_roi_earned: totalRoiEarned,
          withdrawable_balance: parseFloat(wallet?.investment_balance || 0),
          active_investments_count: activeInvestments?.length || 0,
          completed_investments_count: completedInvestments?.length || 0
        },
        next_payout: nextPayout ? {
          investment_id: nextPayout.id,
          plan_name: nextPayout.plan_name,
          amount: nextPayout.weekly_payout_amount,
          date: nextPayout.next_payout_date,
          week: nextPayout.current_week + 1
        } : null,
        active_investments: activeInvestments || [],
        recent_completed: (completedInvestments || []).slice(0, 5)
      }
    });

  } catch (error) {
    console.error('Get investment dashboard error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Request withdrawal from investment balance
const requestWithdrawal = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        data: { errors: errors.array() }
      });
    }

    const { amount } = req.body;
    const userId = req.user.id;

    // Check if withdrawals are enabled
    const { data: withdrawalSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'withdrawal_investment_enabled')
      .single();

    if (withdrawalSetting?.setting_value !== 'true') {
      return res.status(403).json({
        status: 'error',
        message: 'Investment withdrawals are currently disabled'
      });
    }

    // Get minimum withdrawal amount
    const { data: minSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'min_withdrawal_investment')
      .single();

    const minAmount = parseFloat(minSetting?.setting_value || 5000);

    if (amount < minAmount) {
      return res.status(400).json({
        status: 'error',
        message: `Minimum withdrawal amount is ₦${minAmount.toLocaleString()}`
      });
    }

    // Get user wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('investment_balance, account_name, bank_name, account_number')
      .eq('user_id', userId)
      .single();

    if (walletError) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }

    // Check bank details
    if (!wallet.account_name || !wallet.bank_name || !wallet.account_number) {
      return res.status(400).json({
        status: 'error',
        message: 'Please set your bank account details before withdrawing'
      });
    }

    // Check balance
    if (parseFloat(wallet.investment_balance) < amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Insufficient investment balance'
      });
    }

    // Deduct from balance immediately
    const newBalance = parseFloat(wallet.investment_balance) - amount;

    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({ investment_balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    // Create pending withdrawal transaction
    const reference = `WD_INVESTMENT_${Date.now()}_${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'withdrawal',
        balance_type: 'investment_balance',
        amount: amount,
        currency: 'NGN',
        status: 'pending',
        reference: reference,
        description: `Investment withdrawal request - ₦${amount.toLocaleString()}`,
        withdrawal_method: 'bank_transfer',
        metadata: {
          bank_details: {
            account_name: wallet.account_name,
            bank_name: wallet.bank_name,
            account_number: wallet.account_number
          }
        }
      })
      .select()
      .single();

    if (transactionError) {
      // Rollback balance if transaction creation fails
      await supabaseAdmin
        .from('wallets')
        .update({ investment_balance: wallet.investment_balance })
        .eq('user_id', userId);
      
      throw transactionError;
    }

    res.json({
      status: 'success',
      message: 'Withdrawal request submitted successfully',
      data: {
        transaction: {
          id: transaction.id,
          reference: reference,
          amount: amount,
          status: 'pending',
          created_at: transaction.created_at
        },
        new_balance: newBalance
      }
    });

  } catch (error) {
    console.error('Request investment withdrawal error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Transfer from investment balance to games balance
const transferToGames = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        data: { errors: errors.array() }
      });
    }

    const { amount } = req.body;
    const userId = req.user.id;

    // Get minimum transfer amount
    const { data: minSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'investment_transfer_min_amount')
      .single();

    const minAmount = parseFloat(minSetting?.setting_value || 5000);

    if (amount < minAmount) {
      return res.status(400).json({
        status: 'error',
        message: `Minimum transfer amount is ₦${minAmount.toLocaleString()}`
      });
    }

    // Get wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('investment_balance, games_balance')
      .eq('user_id', userId)
      .single();

    if (walletError) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }

    // Check balance
    if (parseFloat(wallet.investment_balance) < amount) {
      return res.status(400).json({
        status: 'error',
        message: 'Insufficient investment balance'
      });
    }

    // Calculate new balances
    const newInvestmentBalance = parseFloat(wallet.investment_balance) - amount;
    const newGamesBalance = parseFloat(wallet.games_balance) + amount;

    // Update wallet
    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({
        investment_balance: newInvestmentBalance,
        games_balance: newGamesBalance
      })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    // Create transaction record
    const reference = `TRF_INV_GAMES_${Date.now()}_${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'transfer',
        balance_type: 'games_balance',
        amount: amount,
        currency: 'NGN',
        status: 'completed',
        reference: reference,
        description: `Transfer from investment to games balance - ₦${amount.toLocaleString()}`,
        metadata: {
          from_balance: 'investment_balance',
          to_balance: 'games_balance',
          previous_investment_balance: wallet.investment_balance,
          previous_games_balance: wallet.games_balance,
          new_investment_balance: newInvestmentBalance,
          new_games_balance: newGamesBalance
        }
      });

    res.json({
      status: 'success',
      message: 'Transfer successful',
      data: {
        amount: amount,
        new_investment_balance: newInvestmentBalance,
        new_games_balance: newGamesBalance
      }
    });

  } catch (error) {
    console.error('Transfer investment to games error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};


// Admin: Get all investments
const adminGetAllInvestments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('investments')
      .select(`
        *,
        users (
          id, username, email, full_name, phone_number, user_tier
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (search) {
      query = query.or(`reference.ilike.%${search}%`);
    }

    const { data: investments, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      status: 'success',
      message: 'Investments retrieved successfully',
      data: {
        investments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Admin get all investments error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Admin: Get investment statistics
const adminGetInvestmentStats = async (req, res) => {
  try {
    // Get all investments
    const { data: allInvestments } = await supabaseAdmin
      .from('investments')
      .select('*');

    // Calculate statistics
    const activeInvestments = allInvestments?.filter(inv => inv.status === 'active') || [];
    const completedInvestments = allInvestments?.filter(inv => inv.status === 'completed') || [];

    const totalCapitalInvested = allInvestments?.reduce((sum, inv) => 
      sum + parseFloat(inv.capital_amount), 0) || 0;

    const totalRoiPaid = allInvestments?.reduce((sum, inv) => 
      sum + parseFloat(inv.total_paid_out), 0) || 0;

    const activeCapital = activeInvestments.reduce((sum, inv) => 
      sum + parseFloat(inv.capital_amount), 0);

    // Get plan breakdown
    const planBreakdown = {};
    allInvestments?.forEach(inv => {
      if (!planBreakdown[inv.plan_name]) {
        planBreakdown[inv.plan_name] = {
          count: 0,
          total_capital: 0,
          total_roi_paid: 0
        };
      }
      planBreakdown[inv.plan_name].count += 1;
      planBreakdown[inv.plan_name].total_capital += parseFloat(inv.capital_amount);
      planBreakdown[inv.plan_name].total_roi_paid += parseFloat(inv.total_paid_out);
    });

    // Get pending payouts
    const { data: pendingPayouts } = await supabaseAdmin
      .from('investment_payouts')
      .select('amount')
      .eq('status', 'pending');

    const totalPendingPayouts = pendingPayouts?.reduce((sum, p) => 
      sum + parseFloat(p.amount), 0) || 0;

    res.json({
      status: 'success',
      message: 'Investment statistics retrieved successfully',
      data: {
        overview: {
          total_investments: allInvestments?.length || 0,
          active_investments: activeInvestments.length,
          completed_investments: completedInvestments.length,
          total_capital_invested: totalCapitalInvested,
          active_capital: activeCapital,
          total_roi_paid: totalRoiPaid,
          pending_payouts_amount: totalPendingPayouts
        },
        plan_breakdown: planBreakdown
      }
    });

  } catch (error) {
    console.error('Admin get investment stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Admin: Process weekly payouts (manually trigger)
const adminProcessWeeklyPayouts = async (req, res) => {
  try {
    const currentDate = new Date();
    
    // Get all active investments where next payout is due
    const { data: dueInvestments, error: investmentError } = await supabaseAdmin
      .from('investments')
      .select('*')
      .eq('status', 'active')
      .lte('next_payout_date', currentDate.toISOString());

    if (investmentError) {
      throw investmentError;
    }

    if (!dueInvestments || dueInvestments.length === 0) {
      return res.json({
        status: 'success',
        message: 'No payouts due at this time',
        data: {
          processed: 0,
          total_amount: 0
        }
      });
    }

    let processedCount = 0;
    let totalAmountPaid = 0;
    const errors = [];

    // Process each investment
    for (const investment of dueInvestments) {
      try {
        const nextWeek = investment.current_week + 1;
        const payoutAmount = parseFloat(investment.weekly_payout_amount);

        // Get user's current investment balance
        const { data: wallet } = await supabaseAdmin
          .from('wallets')
          .select('investment_balance')
          .eq('user_id', investment.user_id)
          .single();

        const newBalance = parseFloat(wallet?.investment_balance || 0) + payoutAmount;

        // Update wallet
        await supabaseAdmin
          .from('wallets')
          .update({ investment_balance: newBalance })
          .eq('user_id', investment.user_id);

        // Create transaction
        const { data: transaction } = await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: investment.user_id,
            transaction_type: 'reward',
            balance_type: 'investment_balance',
            amount: payoutAmount,
            currency: 'NGN',
            status: 'completed',
            reference: `INV_PAYOUT_${investment.id}_WK${nextWeek}_${Date.now()}`,
            description: `Investment ROI payout - Week ${nextWeek} of ${investment.plan_name} plan`,
            metadata: {
              investment_id: investment.id,
              week_number: nextWeek,
              plan_name: investment.plan_name
            }
          })
          .select()
          .single();

        // Update payout record
        await supabaseAdmin
          .from('investment_payouts')
          .update({
            status: 'completed',
            processed_at: currentDate.toISOString(),
            transaction_id: transaction.id
          })
          .eq('investment_id', investment.id)
          .eq('week_number', nextWeek);

        // Calculate next payout date
        const nextPayoutDate = new Date(investment.next_payout_date);
        nextPayoutDate.setDate(nextPayoutDate.getDate() + 7);

        const newTotalPaidOut = parseFloat(investment.total_paid_out) + payoutAmount;

        // Check if investment is complete
        if (nextWeek >= 6) {
          // Investment completed
          await supabaseAdmin
            .from('investments')
            .update({
              status: 'completed',
              current_week: nextWeek,
              total_paid_out: newTotalPaidOut,
              updated_at: currentDate.toISOString()
            })
            .eq('id', investment.id);
        } else {
          // Update investment for next week
          await supabaseAdmin
            .from('investments')
            .update({
              current_week: nextWeek,
              next_payout_date: nextPayoutDate.toISOString(),
              total_paid_out: newTotalPaidOut,
              updated_at: currentDate.toISOString()
            })
            .eq('id', investment.id);
        }

        processedCount++;
        totalAmountPaid += payoutAmount;

      } catch (error) {
        console.error(`Error processing investment ${investment.id}:`, error);
        errors.push({
          investment_id: investment.id,
          error: error.message
        });
      }
    }

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: req.user.id,
        activity_type: 'investment_payouts_processed',
        description: `Processed ${processedCount} investment payouts totaling ₦${totalAmountPaid.toLocaleString()}`,
        metadata: {
          processed_count: processedCount,
          total_amount: totalAmountPaid,
          failed_count: errors.length,
          errors: errors
        }
      });

    res.json({
      status: 'success',
      message: `Processed ${processedCount} payouts successfully`,
      data: {
        processed: processedCount,
        total_amount: totalAmountPaid,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Admin process weekly payouts error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Admin: Get pending investment withdrawals
const adminGetPendingWithdrawals = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('transactions')
      .select(`
        *,
        users!transactions_user_id_fkey (
          id, username, email, full_name, phone_number
        )
      `, { count: 'exact' })
      .eq('transaction_type', 'withdrawal')
      .eq('balance_type', 'investment_balance')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (search) {
      query = query.or(`reference.ilike.%${search}%`);
    }

    const { data: withdrawals, error, count } = await query;

    if (error) {
      throw error;
    }

    res.json({
      status: 'success',
      message: 'Pending investment withdrawals retrieved successfully',
      data: {
        withdrawals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Admin get pending investment withdrawals error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Admin: Process investment withdrawal (approve/decline)
const adminProcessWithdrawal = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        data: { errors: errors.array() }
      });
    }

    const { transactionId } = req.params;
    const { action, decline_reason } = req.body;
    const adminId = req.user.id;

    // Get transaction
    const { data: transaction, error: transactionError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('transaction_type', 'withdrawal')
      .eq('balance_type', 'investment_balance')
      .eq('status', 'pending')
      .single();

    if (transactionError || !transaction) {
      return res.status(404).json({
        status: 'error',
        message: 'Withdrawal transaction not found'
      });
    }

    if (action === 'approve') {
      // Approve withdrawal
      const { error: updateError } = await supabaseAdmin
        .from('transactions')
        .update({
          status: 'completed',
          processed_by: adminId,
          processed_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (updateError) {
        throw updateError;
      }

      // Update total withdrawn
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('total_withdrawn_investment')
        .eq('user_id', transaction.user_id)
        .single();

      const newTotalWithdrawn = parseFloat(wallet?.total_withdrawn_investment || 0) + parseFloat(transaction.amount);

      await supabaseAdmin
        .from('wallets')
        .update({ total_withdrawn_investment: newTotalWithdrawn })
        .eq('user_id', transaction.user_id);

      // Log admin activity
      await supabaseAdmin
        .from('admin_activities')
        .insert({
          admin_id: adminId,
          activity_type: 'investment_withdrawal_approved',
          description: `Approved investment withdrawal of ₦${parseFloat(transaction.amount).toLocaleString()}`,
          metadata: {
            transaction_id: transactionId,
            user_id: transaction.user_id,
            amount: transaction.amount
          }
        });

      res.json({
        status: 'success',
        message: 'Withdrawal approved successfully',
        data: {
          transactionId,
          action: 'approve',
          amount: transaction.amount
        }
      });

    } else if (action === 'decline') {
      // Decline withdrawal - return money to balance
      const { data: wallet } = await supabaseAdmin
        .from('wallets')
        .select('investment_balance')
        .eq('user_id', transaction.user_id)
        .single();

      const restoredBalance = parseFloat(wallet?.investment_balance || 0) + parseFloat(transaction.amount);

      await supabaseAdmin
        .from('wallets')
        .update({ investment_balance: restoredBalance })
        .eq('user_id', transaction.user_id);

      // Update transaction
      const { error: updateError } = await supabaseAdmin
        .from('transactions')
        .update({
          status: 'cancelled',
          processed_by: adminId,
          processed_at: new Date().toISOString(),
          decline_reason: decline_reason || 'Declined by admin'
        })
        .eq('id', transactionId);

      if (updateError) {
        throw updateError;
      }

      // Log admin activity
      await supabaseAdmin
        .from('admin_activities')
        .insert({
          admin_id: adminId,
          activity_type: 'investment_withdrawal_declined',
          description: `Declined investment withdrawal of ₦${parseFloat(transaction.amount).toLocaleString()}`,
          metadata: {
            transaction_id: transactionId,
            user_id: transaction.user_id,
            amount: transaction.amount,
            reason: decline_reason
          }
        });

      res.json({
        status: 'success',
        message: 'Withdrawal declined successfully',
        data: {
          transactionId,
          action: 'decline',
          amount: transaction.amount,
          restored_balance: restoredBalance
        }
      });

    } else {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action. Use "approve" or "decline"'
      });
    }

  } catch (error) {
    console.error('Admin process investment withdrawal error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Admin: Bulk process investment withdrawals
const adminBulkProcessWithdrawals = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        data: { errors: errors.array() }
      });
    }

    const { transaction_ids, action, decline_reason } = req.body;
    const adminId = req.user.id;

    if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'transaction_ids must be a non-empty array'
      });
    }

    if (transaction_ids.length > 50) {
      return res.status(400).json({
        status: 'error',
        message: 'Maximum 50 withdrawals can be processed at once'
      });
    }

    let processedCount = 0;
    let totalAmount = 0;
    const processedIds = [];
    const failedIds = [];

    for (const transactionId of transaction_ids) {
      try {
        // Get transaction
        const { data: transaction } = await supabaseAdmin
          .from('transactions')
          .select('*')
          .eq('id', transactionId)
          .eq('transaction_type', 'withdrawal')
          .eq('balance_type', 'investment_balance')
          .eq('status', 'pending')
          .single();

        if (!transaction) {
          failedIds.push(transactionId);
          continue;
        }

        if (action === 'approve') {
          // Approve withdrawal
          await supabaseAdmin
            .from('transactions')
            .update({
              status: 'completed',
              processed_by: adminId,
              processed_at: new Date().toISOString()
            })
            .eq('id', transactionId);

          // Update total withdrawn
          const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('total_withdrawn_investment')
            .eq('user_id', transaction.user_id)
            .single();

          const newTotalWithdrawn = parseFloat(wallet?.total_withdrawn_investment || 0) + parseFloat(transaction.amount);

          await supabaseAdmin
            .from('wallets')
            .update({ total_withdrawn_investment: newTotalWithdrawn })
            .eq('user_id', transaction.user_id);

        } else if (action === 'decline') {
          // Return money to balance
          const { data: wallet } = await supabaseAdmin
            .from('wallets')
            .select('investment_balance')
            .eq('user_id', transaction.user_id)
            .single();

          const restoredBalance = parseFloat(wallet?.investment_balance || 0) + parseFloat(transaction.amount);

          await supabaseAdmin
            .from('wallets')
            .update({ investment_balance: restoredBalance })
            .eq('user_id', transaction.user_id);

          // Update transaction
          await supabaseAdmin
            .from('transactions')
            .update({
              status: 'cancelled',
              processed_by: adminId,
              processed_at: new Date().toISOString(),
              decline_reason: decline_reason || 'Declined by admin'
            })
            .eq('id', transactionId);
        }

        processedCount++;
        totalAmount += parseFloat(transaction.amount);
        processedIds.push(transactionId);

      } catch (error) {
        console.error(`Error processing transaction ${transactionId}:`, error);
        failedIds.push(transactionId);
      }
    }

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: adminId,
        activity_type: `investment_withdrawals_bulk_${action}`,
        description: `Bulk ${action} ${processedCount} investment withdrawals totaling ₦${totalAmount.toLocaleString()}`,
        metadata: {
          action,
          processed_count: processedCount,
          failed_count: failedIds.length,
          total_amount: totalAmount,
          processed_ids: processedIds,
          failed_ids: failedIds
        }
      });

    res.json({
      status: 'success',
      message: `Bulk ${action} completed`,
      data: {
        processed_count: processedCount,
        failed_count: failedIds.length,
        total_amount: totalAmount,
        processed_ids: processedIds,
        failed_ids: failedIds.length > 0 ? failedIds : undefined
      }
    });

  } catch (error) {
    console.error('Admin bulk process investment withdrawals error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  // User endpoints
  getPlans,
  initializePayment,
  verifyPayment,
  getMyInvestments,
  getInvestmentDetails,
  getDashboard,
  requestWithdrawal,
  transferToGames,
  
  // Admin endpoints
  adminGetAllInvestments,
  adminGetInvestmentStats,
  adminProcessWeeklyPayouts,
  adminGetPendingWithdrawals,
  adminProcessWithdrawal,
  adminBulkProcessWithdrawals
};

 