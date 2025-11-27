const { supabaseAdmin } = require('../services/supabase.service');
const { decryptPassword } = require('../utils/helpers');  


// ==================== USER MANAGEMENT ====================
 
 
const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      user_tier = '',
      account_status = '',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query with minimal referrer info
    let query = supabaseAdmin
      .from('users')
      .select(`
        id, email, username, full_name, phone_number, country,
        user_tier, role, account_status, referral_code,
        original_password, created_at, last_login_at, referred_by,
        referrer:referred_by (
          id, username, email
        ),
        wallets (
          voxcoin_balance, growth_bonus, tier1_earnings,
          tier2_earnings, manager_earnings, withdrawable_balance,
          games_balance, investment_balance, total_withdrawn
        )
      `)
      .range(offset, offset + parseInt(limit) - 1)
      .order(sort_by, { ascending: sort_order === 'asc' });

    // Apply filters
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
    }
    if (role) query = query.eq('role', role);
    if (user_tier) query = query.eq('user_tier', user_tier);
    if (account_status) query = query.eq('account_status', account_status);

    const { data: users, error } = await query;

    if (error) throw error;

    // Decrypt passwords for users only, clean up response
    const usersWithDecryptedPasswords = users.map(user => {
      const cleanUser = {
        ...user,
        decrypted_password: user.original_password ? decryptPassword(user.original_password) : 'Not available'
      };
      
      // Remove original_password from response
      delete cleanUser.original_password;
      
      return cleanUser;
    });

    // Get total count for pagination
    let countQuery = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (search) {
      countQuery = countQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
    }
    if (role) countQuery = countQuery.eq('role', role);
    if (user_tier) countQuery = countQuery.eq('user_tier', user_tier);
    if (account_status) countQuery = countQuery.eq('account_status', account_status);

    const { count: totalUsers } = await countQuery;

    res.status(200).json({
      status: 'success',
      message: 'Users retrieved successfully',
      data: {
        users: usersWithDecryptedPasswords,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil(totalUsers / limit),
          total_users: totalUsers,
          has_next: offset + limit < totalUsers,
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user with wallet info, encrypted password, and populated referrer
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select(`
        id, email, username, full_name, phone_number, country,
        user_tier, role, account_status, referral_code, 
        password, original_password,
        tiktok_handle, snapchat_handle, instagram_handle,
        created_at, updated_at, last_login_at, referred_by,
        referrer:referred_by (
          id, username, full_name, email, user_tier, role,
          password, original_password, phone_number, created_at,
          wallets (
            voxcoin_balance, withdrawable_balance, growth_bonus,
            tier1_earnings, tier2_earnings
          )
        ),
        wallets (*)
      `)
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    // Decrypt user password
    let userDecryptedPassword = 'Not available';
    if (user.original_password) {
      try {
        userDecryptedPassword = decryptPassword(user.original_password);
      } catch (error) {
        console.error('Error decrypting user password:', error);
        userDecryptedPassword = 'Decryption failed';
      }
    }

    // Process referrer information
    let referrerInfo = null;
    if (user.referrer) {
      let referrerDecryptedPassword = 'Not available';
      
      if (user.referrer.original_password) {
        try {
          referrerDecryptedPassword = decryptPassword(user.referrer.original_password);
        } catch (error) {
          console.error('Error decrypting referrer password:', error);
          referrerDecryptedPassword = 'Decryption failed';
        }
      }

      referrerInfo = {
        ...user.referrer,
        decrypted_password: referrerDecryptedPassword
      };
    }

    // Get direct referrals with decrypted passwords and their referrer info
    const { data: directReferrals, error: directError } = await supabaseAdmin
      .from('users')
      .select(`
        id, username, full_name, user_tier, email, 
        password, original_password, phone_number, created_at, referred_by,
        referrer:referred_by (
          id, username, full_name, email
        ),
        wallets (
          voxcoin_balance, withdrawable_balance, growth_bonus
        )
      `)
      .eq('referred_by', userId)
      .order('created_at', { ascending: false });

    // Decrypt passwords for direct referrals
    const directReferralsWithPasswords = directReferrals?.map(ref => {
      let decryptedPassword = 'Not available';
      
      if (ref.original_password) {
        try {
          decryptedPassword = decryptPassword(ref.original_password);
        } catch (error) {
          console.error('Error decrypting direct referral password:', error);
          decryptedPassword = 'Decryption failed';
        }
      }

      return {
        ...ref,
        decrypted_password: decryptedPassword,
        level: 'Direct (Level 1)',
        referred_by_info: ref.referrer
      };
    }) || [];

    // Get tier1 referrals (people referred by this user's direct referrals)
    const tier1Referrals = [];
    if (directReferrals && directReferrals.length > 0) {
      const directReferralIds = directReferrals.map(ref => ref.id);
      
      const { data: tier1Data } = await supabaseAdmin
        .from('users')
        .select(`
          id, username, full_name, user_tier, email, 
          password, original_password, phone_number, created_at, referred_by,
          referrer:referred_by (
            id, username, full_name, email
          ),
          wallets (
            voxcoin_balance, withdrawable_balance, growth_bonus
          )
        `)
        .in('referred_by', directReferralIds)
        .order('created_at', { ascending: false });
      
      if (tier1Data) {
        tier1Referrals.push(...tier1Data);
      }
    }

    // Decrypt passwords for tier1 referrals
    const tier1ReferralsWithPasswords = tier1Referrals.map(ref => {
      let decryptedPassword = 'Not available';
      
      if (ref.original_password) {
        try {
          decryptedPassword = decryptPassword(ref.original_password);
        } catch (error) {
          console.error('Error decrypting tier1 referral password:', error);
          decryptedPassword = 'Decryption failed';
        }
      }

      return {
        ...ref,
        decrypted_password: decryptedPassword,
        level: 'Tier 1 (Level 2)',
        referred_by_info: ref.referrer,
        referred_by_username: ref.referrer?.username || 'Unknown'
      };
    });

    // Get tier2 referrals (people referred by tier1 referrals)
    const tier2Referrals = [];
    if (tier1Referrals && tier1Referrals.length > 0) {
      const tier1ReferralIds = tier1Referrals.map(ref => ref.id);
      
      const { data: tier2Data } = await supabaseAdmin
        .from('users')
        .select(`
          id, username, full_name, user_tier, email, 
          password, original_password, phone_number, created_at, referred_by,
          referrer:referred_by (
            id, username, full_name, email
          ),
          wallets (
            voxcoin_balance, withdrawable_balance, growth_bonus
          )
        `)
        .in('referred_by', tier1ReferralIds)
        .order('created_at', { ascending: false });
      
      if (tier2Data) {
        tier2Referrals.push(...tier2Data);
      }
    }

    // Decrypt passwords for tier2 referrals
    const tier2ReferralsWithPasswords = tier2Referrals.map(ref => {
      let decryptedPassword = 'Not available';
      
      if (ref.original_password) {
        try {
          decryptedPassword = decryptPassword(ref.original_password);
        } catch (error) {
          console.error('Error decrypting tier2 referral password:', error);
          decryptedPassword = 'Decryption failed';
        }
      }

      return {
        ...ref,
        decrypted_password: decryptedPassword,
        level: 'Tier 2 (Level 3)',
        referred_by_info: ref.referrer,
        referred_by_username: ref.referrer?.username || 'Unknown'
      };
    });

    // Get recent transactions
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get referral earnings breakdown
    const { data: referralBreakdown } = await supabaseAdmin
      .from('referrals')
      .select('package_type, direct_reward, tier1_reward, tier2_reward, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    res.status(200).json({
      status: 'success',
      message: 'User details retrieved successfully',
      data: {
        user: {
          ...user,
          decrypted_password: userDecryptedPassword,
          referrer: referrerInfo
        },
        referrer_info: referrerInfo, // Keep this for backward compatibility
        referral_network: {
          direct_referrals: directReferralsWithPasswords,
          tier1_referrals: tier1ReferralsWithPasswords,
          tier2_referrals: tier2ReferralsWithPasswords
        },
        referral_stats: {
          referral_breakdown: referralBreakdown || [],
          total_direct_referrals: directReferralsWithPasswords.length,
          total_tier1_referrals: tier1ReferralsWithPasswords.length,
          total_tier2_referrals: tier2ReferralsWithPasswords.length,
          total_network_size: directReferralsWithPasswords.length + tier1ReferralsWithPasswords.length + tier2ReferralsWithPasswords.length,
          total_referral_earnings: user.wallets?.[0]?.growth_bonus || 0
        },
        recent_transactions: transactions || [],
        summary: {
          total_earnings: (user.wallets?.[0]?.withdrawable_balance || 0) + (user.wallets?.[0]?.voxcoin_balance || 0),
          withdrawable_balance: user.wallets?.[0]?.withdrawable_balance || 0,
          voxcoin_balance: user.wallets?.[0]?.voxcoin_balance || 0,
          total_withdrawn: user.wallets?.[0]?.total_withdrawn || 0
        }
      }
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

 

/**
 * Helper function to determine if a transaction is a credit (money in) or debit (money out)
 * @param {Object} transaction - Transaction object
 * @returns {Boolean} - true if credit (money in), false if debit (money out)
 */
const determineTransactionType = (transaction) => {
  const { transaction_type, earning_type, amount } = transaction;
  
  // Credit transactions (money coming in)
  const creditTypes = [
    'reward',           // All reward earnings
    'deposit',          // Deposits to gaming wallet
    'refund',           // Refunds
    'bonus',            // Bonuses
    'commission'        // Manager commissions
  ];
  
  const creditEarningTypes = [
    'growth_bonus',     // Direct referral earnings
    'tier1',            // Tier 1 referral earnings
    'tier2',            // Tier 2 referral earnings
    'manager_earnings', // Manager commissions
    'voxskit',          // VoxSkit video rewards
    'live_button',      // Live button rewards
    'social_task',      // Social media task rewards
    'welcome_bonus',    // Welcome bonus
    'upgrade_bonus'     // Pro upgrade bonus
  ];
  
  // Debit transactions (money going out)
  const debitTypes = [
    'withdrawal',       // Withdrawals from platform
    'transfer',         // Transfers between wallets
    'bet',              // Gaming bets/losses
    'investment'        // Investments made
  ];
  
  // Check transaction type
  if (creditTypes.includes(transaction_type)) {
    return true; // Credit
  }
  
  if (debitTypes.includes(transaction_type)) {
    return false; // Debit
  }
  
  // Check earning type if transaction type is ambiguous
  if (earning_type && creditEarningTypes.includes(earning_type)) {
    return true; // Credit
  }
  
  // Default: Check amount sign (negative = debit, positive = credit)
  return parseFloat(amount) >= 0;
};

/**
 * Add isCredit field to transaction objects
 * @param {Array} transactions - Array of transaction objects
 * @returns {Array} - Transactions with isCredit field added
 */
const enhanceTransactionsWithCreditFlag = (transactions) => {
  if (!transactions || !Array.isArray(transactions)) {
    return [];
  }
  
  return transactions.map(transaction => ({
    ...transaction,
    isCredit: determineTransactionType(transaction),
    // Add formatted amount with sign for easier display
    formattedAmount: determineTransactionType(transaction) 
      ? `₦${parseFloat(transaction.amount).toLocaleString()}`
      : `₦${Math.abs(parseFloat(transaction.amount)).toLocaleString()}`
  }));
};

/**
 * Admin endpoint to get detailed user earnings breakdown by user ID
 * GET /api/admin/user/:userId/earnings
 */
const getUserEarningsAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query; // Default to last 30 days for recent activity

    // Validate user ID format
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        status: 'error',
        message: 'Valid user ID is required',
        data: null
      });
    }

    // 1. Get user basic information
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, username, email, full_name, user_tier, role, created_at')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
        data: null
      });
    }

    // 2. Get wallet details
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (walletError) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found for user',
        data: null
      });
    }

    // 3. Get all transactions for the user
    const { data: allTransactions, error: transError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (transError) {
      console.error('Error fetching transactions:', transError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch transaction data',
        data: null
      });
    }

    // 4. Get recent transactions for specified period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const recentTransactions = (allTransactions || []).filter(
      transaction => new Date(transaction.created_at) >= startDate
    );

    // 5. Enhance transactions with credit/debit flags
    const enhancedAllTransactions = enhanceTransactionsWithCreditFlag(allTransactions || []);
    const enhancedRecentTransactions = enhanceTransactionsWithCreditFlag(recentTransactions || []);

    // 6. Calculate earnings breakdown
    const creditTransactions = enhancedAllTransactions.filter(t => t.isCredit);
    const debitTransactions = enhancedAllTransactions.filter(t => !t.isCredit);

    // Group credit transactions by earning type
    const earningsBreakdown = creditTransactions.reduce((acc, transaction) => {
      const type = transaction.earning_type || transaction.transaction_type;
      
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          total_amount: 0,
          transactions: []
        };
      }
      
      const amount = parseFloat(transaction.amount);
      acc[type].count += 1;
      acc[type].total_amount += amount;
      acc[type].transactions.push({
        id: transaction.id,
        amount: amount,
        description: transaction.description,
        status: transaction.status,
        created_at: transaction.created_at
      });
      
      return acc;
    }, {});

    // Group debit transactions by type
    const deductionsBreakdown = debitTransactions.reduce((acc, transaction) => {
      const type = transaction.transaction_type;
      
      if (!acc[type]) {
        acc[type] = {
          count: 0,
          total_amount: 0,
          transactions: []
        };
      }
      
      const amount = Math.abs(parseFloat(transaction.amount));
      acc[type].count += 1;
      acc[type].total_amount += amount;
      acc[type].transactions.push({
        id: transaction.id,
        amount: amount,
        description: transaction.description,
        status: transaction.status,
        created_at: transaction.created_at
      });
      
      return acc;
    }, {});

    // 7. Calculate totals
    const totalEarnings = creditTransactions.reduce(
      (sum, t) => sum + parseFloat(t.amount), 0
    );
    
    const totalDeductions = debitTransactions.reduce(
      (sum, t) => sum + Math.abs(parseFloat(t.amount)), 0
    );

    // 8. Recent activity summary
    const recentCreditTransactions = enhancedRecentTransactions.filter(t => t.isCredit);
    const recentDebitTransactions = enhancedRecentTransactions.filter(t => !t.isCredit);
    
    const recentEarnings = recentCreditTransactions.reduce(
      (sum, t) => sum + parseFloat(t.amount), 0
    );
    
    const recentDeductions = recentDebitTransactions.reduce(
      (sum, t) => sum + Math.abs(parseFloat(t.amount)), 0
    );

    // 9. Get referral statistics
    const { data: referralStats } = await supabaseAdmin
      .from('referrals')
      .select('direct_referrer_id, tier1_referrer_id, tier2_referrer_id, created_at')
      .or(`direct_referrer_id.eq.${userId},tier1_referrer_id.eq.${userId},tier2_referrer_id.eq.${userId}`);

    const directReferrals = referralStats?.filter(r => r.direct_referrer_id === userId).length || 0;
    const tier1Referrals = referralStats?.filter(r => r.tier1_referrer_id === userId).length || 0;
    const tier2Referrals = referralStats?.filter(r => r.tier2_referrer_id === userId).length || 0;

    // 10. Prepare response data
    const responseData = {
      user_info: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        user_tier: user.user_tier,
        role: user.role,
        joined_date: user.created_at
      },
      
      current_wallet: {
        voxcoin_balance: parseFloat(wallet.voxcoin_balance || 0),
        growth_bonus: parseFloat(wallet.growth_bonus || 0),
        tier1_earnings: parseFloat(wallet.tier1_earnings || 0),
        tier2_earnings: parseFloat(wallet.tier2_earnings || 0),
        manager_earnings: parseFloat(wallet.manager_earnings || 0),
        withdrawable_balance: parseFloat(wallet.withdrawable_balance || 0),
        games_balance: parseFloat(wallet.games_balance || 0),
        investment_balance: parseFloat(wallet.investment_balance || 0),
        total_withdrawn: parseFloat(wallet.total_withdrawn || 0),
        total_accumulated_earnings: parseFloat(wallet.total_accumulated_earnings || 0)
      },

      earnings_summary: {
        all_time: {
          total_earnings: totalEarnings,
          breakdown: earningsBreakdown,
          transaction_count: creditTransactions.length
        },
        recent_period: {
          days: parseInt(days),
          total_earnings: recentEarnings,
          transaction_count: recentCreditTransactions.length
        }
      },

      deductions_summary: {
        all_time: {
          total_deductions: totalDeductions,
          breakdown: deductionsBreakdown,
          transaction_count: debitTransactions.length
        },
        recent_period: {
          days: parseInt(days),
          total_deductions: recentDeductions,
          transaction_count: recentDebitTransactions.length
        }
      },

      net_summary: {
        all_time_net: totalEarnings - totalDeductions,
        recent_period_net: recentEarnings - recentDeductions
      },

      referral_statistics: {
        direct_referrals: directReferrals,
        tier1_referrals: tier1Referrals,
        tier2_referrals: tier2Referrals,
        total_referrals: directReferrals + tier1Referrals + tier2Referrals
      },

      recent_transactions: enhancedRecentTransactions.slice(0, 20), // Last 20 transactions

      statistics: {
        total_transactions: (allTransactions || []).length,
        first_transaction_date: (allTransactions || []).length > 0 
          ? allTransactions[allTransactions.length - 1].created_at 
          : null,
        last_transaction_date: (allTransactions || []).length > 0 
          ? allTransactions[0].created_at 
          : null
      }
    };

    res.status(200).json({
      status: 'success',
      message: 'User earnings data retrieved successfully',
      data: responseData
    });

  } catch (error) {
    console.error('Get user earnings admin error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user earnings data',
      data: null
    });
  }
};


 

const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { account_status, user_tier, role } = req.body;

    const updateData = {};
    if (account_status) updateData.account_status = account_status;
    if (user_tier) updateData.user_tier = user_tier;
    if (role) updateData.role = role;

    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: req.user.id,
        activity_type: 'user_updated',
        description: `Updated user: ${updatedUser.username}`,
        metadata: { userId, changes: updateData }
      });

    res.status(200).json({
      status: 'success',
      message: 'User updated successfully',
      data: { user: updatedUser }
    });

  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// ==================== WITHDRAWAL MANAGEMENT ====================

const getPendingWithdrawals = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;

    // Fix: Specify the exact relationship using the foreign key constraint name
    let query = supabaseAdmin
      .from('transactions')
      .select(`
        id, user_id, amount, currency, description, reference,
        withdrawal_method, created_at, metadata,
        users!transactions_user_id_fkey (id, username, full_name, email, phone_number)
      `)
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending')
      .range(offset, offset + parseInt(limit) - 1)
      .order(sort_by, { ascending: sort_order === 'asc' });

    if (search) {
      // For search across user fields, we need to use a different approach
      // since we can't use OR with embedded relationships directly
      const { data: searchUsers, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);
      
      if (userError) throw userError;
      
      if (searchUsers.length > 0) {
        const userIds = searchUsers.map(user => user.id);
        query = query.in('user_id', userIds);
      } else {
        // If no users match, return empty result
        return res.status(200).json({
          status: 'success',
          message: 'Pending withdrawals retrieved successfully',
          data: {
            withdrawals: [],
            pagination: {
              current_page: parseInt(page),
              total_pages: 0,
              total_withdrawals: 0,
              has_next: false,
              has_prev: page > 1,
              limit: parseInt(limit)
            }
          }
        });
      }
    }

    const { data: withdrawals, error } = await query;
    if (error) throw error;

    // Get total count for pagination
    let countQuery = supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending');

    // Apply same search filter to count query
    if (search) {
      const { data: searchUsers, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);
      
      if (userError) throw userError;
      
      if (searchUsers.length > 0) {
        const userIds = searchUsers.map(user => user.id);
        countQuery = countQuery.in('user_id', userIds);
      }
    }

    const { count: totalCount, error: countError } = await countQuery;
    if (countError) throw countError;

    res.status(200).json({
      status: 'success',
      message: 'Pending withdrawals retrieved successfully',
      data: {
        withdrawals,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil((totalCount || 0) / limit),
          total_withdrawals: totalCount || 0,
          has_next: offset + limit < (totalCount || 0),
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get pending withdrawals error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const processWithdrawal = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { action, decline_reason = '' } = req.body;

    // Validate action
    if (!['approve', 'decline'].includes(action)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action. Must be "approve" or "decline"'
      });
    }

    console.log(`=== PROCESSING WITHDRAWAL ${action.toUpperCase()}: ${transactionId} ===`);

    // Get transaction details with user info
    const { data: transaction, error: transError } = await supabaseAdmin
      .from('transactions')
      .select(`
        *, 
        users!transactions_user_id_fkey(username, full_name, email)
      `)
      .eq('id', transactionId)
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending')
      .single();

    if (transError || !transaction) {
      console.error('Transaction not found:', transError);
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found or already processed'
      });
    }

    if (action === 'approve') {
      // ===== APPROVE WITHDRAWAL =====
      console.log('Processing approval with total_withdrawn update...');

      // Get current wallet to update total_withdrawn
      const { data: currentWallet, error: walletFetchError } = await supabaseAdmin
        .from('wallets')
        .select('total_withdrawn')
        .eq('user_id', transaction.user_id)
        .single();

      if (walletFetchError) {
        console.error('Failed to fetch wallet for total_withdrawn update:', walletFetchError);
        throw walletFetchError;
      }

      const newTotalWithdrawn = (currentWallet.total_withdrawn || 0) + parseFloat(transaction.amount);

      // Update transaction status to completed
      const { error: updateError } = await supabaseAdmin
        .from('transactions')
        .update({
          status: 'completed',
          processed_by: req.user.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (updateError) {
        console.error('Failed to update transaction status for approval:', updateError);
        throw updateError;
      }

      // ===== CRITICAL: Update total_withdrawn in wallet =====
      const { error: walletUpdateError } = await supabaseAdmin
        .from('wallets')
        .update({
          total_withdrawn: newTotalWithdrawn
        })
        .eq('user_id', transaction.user_id);

      if (walletUpdateError) {
        console.error('Failed to update total_withdrawn:', walletUpdateError);
        // Rollback transaction status
        await supabaseAdmin
          .from('transactions')
          .update({
            status: 'pending',
            processed_by: null,
            processed_at: null
          })
          .eq('id', transactionId);
        throw walletUpdateError;
      }

      console.log(`✅ Updated total_withdrawn: ${currentWallet.total_withdrawn} + ${transaction.amount} = ${newTotalWithdrawn}`);
      console.log('✅ Withdrawal approved successfully');

      // Log admin activity
      const { error: logError } = await supabaseAdmin
        .from('admin_activities')
        .insert({
          admin_id: req.user.id,
          activity_type: 'withdrawal_approved',
          description: `Approved withdrawal for ${transaction.users.username} - ₦${parseFloat(transaction.amount).toLocaleString()}`,
          metadata: { 
            transactionId, 
            action: 'approve', 
            amount: parseFloat(transaction.amount),
            user_id: transaction.user_id,
            new_total_withdrawn: newTotalWithdrawn
          }
        });

      if (logError) {
        console.error('Failed to log admin activity:', logError);
      }

      return res.status(200).json({
        status: 'success',
        message: 'Withdrawal approved successfully',
        data: { 
          transactionId, 
          action: 'approve', 
          amount: parseFloat(transaction.amount),
          username: transaction.users.username,
          new_total_withdrawn: newTotalWithdrawn
        }
      });

    } else if (action === 'decline') {
      // ===== DECLINE WITHDRAWAL WITH REFUND =====
      console.log('Processing decline with refund...');

      // Get current wallet state
      const { data: currentWallet, error: walletFetchError } = await supabaseAdmin
        .from('wallets')
        .select('growth_bonus, tier1_earnings, tier2_earnings, manager_earnings, withdrawable_balance')
        .eq('user_id', transaction.user_id)
        .single();

      if (walletFetchError || !currentWallet) {
        console.error('Failed to fetch user wallet:', walletFetchError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch user wallet'
        });
      }

      // Get deduction breakdown from transaction metadata
      const deductionBreakdown = transaction.metadata?.deduction_breakdown;
      
      if (!deductionBreakdown) {
        console.warn('No deduction breakdown found, using fallback refund method');
        
        // Fallback: Add entire amount to growth_bonus
        const fallbackBalances = {
          tier2_earnings: currentWallet.tier2_earnings || 0,
          tier1_earnings: currentWallet.tier1_earnings || 0,
          manager_earnings: currentWallet.manager_earnings || 0,
          growth_bonus: (currentWallet.growth_bonus || 0) + parseFloat(transaction.amount)
        };

        // Update transaction and wallet
        const { error: updateTransactionError } = await supabaseAdmin
          .from('transactions')
          .update({
            status: 'cancelled',
            decline_reason: decline_reason?.trim() || null,
            processed_by: req.user.id,
            processed_at: new Date().toISOString()
          })
          .eq('id', transactionId);

        if (updateTransactionError) throw updateTransactionError;

        const { error: fallbackWalletError } = await supabaseAdmin
          .from('wallets')
          .update(fallbackBalances)
          .eq('user_id', transaction.user_id);

        if (fallbackWalletError) {
          console.error('Failed to update wallet with fallback refund:', fallbackWalletError);
          return res.status(500).json({
            status: 'error',
            message: 'Failed to process refund'
          });
        }

        console.log('✅ Fallback refund completed');

        return res.status(200).json({
          status: 'success',
          message: 'Withdrawal declined successfully and amount refunded',
          data: { 
            transactionId, 
            action: 'decline', 
            amount: parseFloat(transaction.amount),
            username: transaction.users.username,
            decline_reason: decline_reason?.trim() || null,
            refund_method: 'fallback_to_growth_bonus'
          }
        });
      }

      // Calculate restored balances using proper deduction breakdown
      const restoredBalances = {
        tier2_earnings: (currentWallet.tier2_earnings || 0) + (deductionBreakdown.tier2_earnings || 0),
        tier1_earnings: (currentWallet.tier1_earnings || 0) + (deductionBreakdown.tier1_earnings || 0),
        manager_earnings: (currentWallet.manager_earnings || 0) + (deductionBreakdown.manager_earnings || 0),
        growth_bonus: (currentWallet.growth_bonus || 0) + (deductionBreakdown.growth_bonus || 0)
      };

      console.log('Calculated restored balances:', restoredBalances);

      // Update transaction status to cancelled
      const { error: updateTransactionError } = await supabaseAdmin
        .from('transactions')
        .update({
          status: 'cancelled',
          decline_reason: decline_reason?.trim() || null,
          processed_by: req.user.id,
          processed_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (updateTransactionError) throw updateTransactionError;

      // Update wallet with restored balances
      const { error: walletUpdateError } = await supabaseAdmin
        .from('wallets')
        .update(restoredBalances)
        .eq('user_id', transaction.user_id);

      if (walletUpdateError) {
        console.error('Failed to update wallet balance:', walletUpdateError);
        
        // Rollback transaction status if wallet update fails
        await supabaseAdmin
          .from('transactions')
          .update({
            status: 'pending',
            decline_reason: null,
            processed_by: null,
            processed_at: null
          })
          .eq('id', transactionId);

        return res.status(500).json({
          status: 'error',
          message: 'Failed to process refund'
        });
      }

      console.log('✅ Withdrawal decline and refund completed successfully');

      // Log admin activity
      const { error: logError } = await supabaseAdmin
        .from('admin_activities')
        .insert({
          admin_id: req.user.id,
          activity_type: 'withdrawal_declined',
          description: `Declined withdrawal for ${transaction.users.username} - ₦${parseFloat(transaction.amount).toLocaleString()}${decline_reason?.trim() ? ` (Reason: ${decline_reason.trim()})` : ''}`,
          metadata: { 
            transactionId, 
            action: 'decline', 
            decline_reason: decline_reason?.trim() || null, 
            amount: parseFloat(transaction.amount),
            user_id: transaction.user_id,
            deduction_breakdown: deductionBreakdown,
            restored_balances: restoredBalances
          }
        });

      if (logError) {
        console.error('Failed to log admin activity:', logError);
      }

      return res.status(200).json({
        status: 'success',
        message: 'Withdrawal declined successfully and amount refunded to user',
        data: { 
          transactionId, 
          action: 'decline', 
          amount: parseFloat(transaction.amount),
          username: transaction.users.username,
          decline_reason: decline_reason?.trim() || null,
          refund_details: {
            deduction_breakdown: deductionBreakdown,
            restored_balances: restoredBalances
          }
        }
      });
    }

  } catch (error) {
    console.error(`Process withdrawal error:`, error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const bulkProcessWithdrawals = async (req, res) => {
  try {
    const { transaction_ids, action, decline_reason = '' } = req.body;

    console.log(`=== INITIATING BULK WITHDRAWAL PROCESSING: ${action} for ${transaction_ids.length} transactions ===`);

    // Validate input
    if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid transaction IDs provided'
      });
    }

    if (transaction_ids.length > 50) {
      return res.status(400).json({
        status: 'error',
        message: 'Cannot process more than 50 transactions at once'
      });
    }

    if (!['approve', 'decline'].includes(action)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action. Must be "approve" or "decline"'
      });
    }

    console.log(`=== BULK PROCESSING ${action.toUpperCase()}: ${transaction_ids.length} transactions ===`);

    // Get all transactions with user info
    const { data: transactions, error: fetchError } = await supabaseAdmin
      .from('transactions')
      .select(`
        *, 
        users!transactions_user_id_fkey(username, full_name)
      `)
      .in('id', transaction_ids)
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending');

    if (fetchError) {
      console.error('Failed to fetch transactions:', fetchError);
      throw fetchError;
    }

    if (transactions.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No valid pending transactions found'
      });
    }

    console.log(`Found ${transactions.length} valid transactions to process`);

    const processedIds = [];
    const failedIds = [];
    let totalAmount = 0;

    for (const transaction of transactions) {
      try {
        console.log(`Processing transaction ${transaction.id} for user ${transaction.users.username}`);

        if (action === 'approve') {
          // ===== APPROVE TRANSACTION =====
          const { error: updateError } = await supabaseAdmin
            .from('transactions')
            .update({
              status: 'completed',
              processed_by: req.user.id,
              processed_at: new Date().toISOString()
            })
            .eq('id', transaction.id);

          if (!updateError) {
            processedIds.push(transaction.id);
            totalAmount += parseFloat(transaction.amount);
            console.log(`✅ Approved transaction ${transaction.id}`);
          } else {
            console.error(`Failed to approve transaction ${transaction.id}:`, updateError);
            failedIds.push(transaction.id);
          }

        } else if (action === 'decline') {
          // ===== DECLINE TRANSACTION WITH REFUND =====
          
          // Get current wallet state
          const { data: currentWallet, error: walletFetchError } = await supabaseAdmin
            .from('wallets')
            .select('growth_bonus, tier1_earnings, tier2_earnings, manager_earnings, withdrawable_balance')
            .eq('user_id', transaction.user_id)
            .single();

          if (walletFetchError || !currentWallet) {
            console.error(`Failed to fetch wallet for transaction ${transaction.id}:`, walletFetchError);
            failedIds.push(transaction.id);
            continue;
          }

          // Update transaction status first
          const { error: updateTransactionError } = await supabaseAdmin
            .from('transactions')
            .update({
              status: 'cancelled',
              decline_reason: decline_reason?.trim() || null,
              processed_by: req.user.id,
              processed_at: new Date().toISOString()
            })
            .eq('id', transaction.id);

          if (updateTransactionError) {
            console.error(`Failed to update transaction status for ${transaction.id}:`, updateTransactionError);
            failedIds.push(transaction.id);
            continue;
          }

          // Process refund
          const deductionBreakdown = transaction.metadata?.deduction_breakdown;
          let walletUpdateSuccess = false;

          if (deductionBreakdown) {
            // Use proper deduction breakdown to restore exact balances
            const restoredBalances = {
              tier2_earnings: (currentWallet.tier2_earnings || 0) + (deductionBreakdown.tier2_earnings || 0),
              tier1_earnings: (currentWallet.tier1_earnings || 0) + (deductionBreakdown.tier1_earnings || 0),
              manager_earnings: (currentWallet.manager_earnings || 0) + (deductionBreakdown.manager_earnings || 0),
              growth_bonus: (currentWallet.growth_bonus || 0) + (deductionBreakdown.growth_bonus || 0)
            };

            console.log(`Restoring balances for transaction ${transaction.id}:`, restoredBalances);

            const { error: walletUpdateError } = await supabaseAdmin
              .from('wallets')
              .update(restoredBalances)
              .eq('user_id', transaction.user_id);

            walletUpdateSuccess = !walletUpdateError;

            if (walletUpdateError) {
              console.error(`Failed to update wallet for transaction ${transaction.id}:`, walletUpdateError);
            } else {
              console.log(`✅ Refunded transaction ${transaction.id} using deduction breakdown`);
            }

          } else {
            // Fallback: Add entire amount to growth_bonus for legacy transactions
            console.warn(`Transaction ${transaction.id} missing deduction breakdown, using fallback refund`);
            
            const fallbackBalances = {
              tier2_earnings: currentWallet.tier2_earnings || 0,
              tier1_earnings: currentWallet.tier1_earnings || 0,
              manager_earnings: currentWallet.manager_earnings || 0,
              growth_bonus: (currentWallet.growth_bonus || 0) + parseFloat(transaction.amount)
            };

            const { error: fallbackError } = await supabaseAdmin
              .from('wallets')
              .update(fallbackBalances)
              .eq('user_id', transaction.user_id);

            walletUpdateSuccess = !fallbackError;

            if (fallbackError) {
              console.error(`Failed fallback refund for transaction ${transaction.id}:`, fallbackError);
            } else {
              console.log(`✅ Refunded transaction ${transaction.id} using fallback method`);
            }
          }

          if (walletUpdateSuccess) {
            processedIds.push(transaction.id);
            totalAmount += parseFloat(transaction.amount);
          } else {
            failedIds.push(transaction.id);
          }
        }

      } catch (error) {
        console.error(`Error processing transaction ${transaction.id}:`, error);
        failedIds.push(transaction.id);
      }
    }

    console.log(`Bulk processing completed: ${processedIds.length} successful, ${failedIds.length} failed`);

    // Log admin activity
    const { error: logError } = await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: req.user.id,
        activity_type: `bulk_withdrawal_${action}d`,
        description: `Bulk ${action}d ${processedIds.length} withdrawals (₦${totalAmount.toLocaleString()})${failedIds.length > 0 ? `, ${failedIds.length} failed` : ''}`,
        metadata: { 
          processedIds, 
          failedIds,
          action, 
          decline_reason: action === 'decline' ? (decline_reason?.trim() || null) : null, 
          processed_count: processedIds.length,
          failed_count: failedIds.length,
          total_amount: totalAmount,
          total_requested: transaction_ids.length
        }
      });

    if (logError) {
      console.error('Failed to log admin activity:', logError);
    }

    const response = {
      status: 'success',
      message: `Bulk ${action} completed ${failedIds.length > 0 ? 'with some failures' : 'successfully'}`,
      data: {
        processed_count: processedIds.length,
        failed_count: failedIds.length,
        total_requested: transaction_ids.length,
        total_amount: totalAmount,
        processed_ids: processedIds,
        failed_ids: failedIds
      }
    };

    // Add refund details for decline actions
    if (action === 'decline') {
      response.message += failedIds.length === 0 ? ' and amounts refunded to users' : ` (${processedIds.length} refunded successfully)`;
    }

    res.status(200).json(response);

  } catch (error) {
    console.error('Bulk process withdrawals error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};
 
// Additional helper function to get withdrawal statistics
const getWithdrawalStatistics = async (req, res) => {
  try {
    const { data: stats, error } = await supabaseAdmin
      .rpc('get_withdrawal_stats');

    if (error) throw error;

    // Fallback manual calculation if RPC doesn't exist
    if (!stats) {
      const [pendingResult, completedResult, cancelledResult] = await Promise.all([
        supabaseAdmin
          .from('transactions')
          .select('amount', { count: 'exact' })
          .eq('transaction_type', 'withdrawal')
          .eq('status', 'pending'),
        
        supabaseAdmin
          .from('transactions')
          .select('amount', { count: 'exact' })
          .eq('transaction_type', 'withdrawal')
          .eq('status', 'completed'),
        
        supabaseAdmin
          .from('transactions')
          .select('amount', { count: 'exact' })
          .eq('transaction_type', 'withdrawal')
          .eq('status', 'cancelled')
      ]);

      const pendingAmount = pendingResult.data?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
      const completedAmount = completedResult.data?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
      const cancelledAmount = cancelledResult.data?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

      return res.status(200).json({
        status: 'success',
        message: 'Withdrawal statistics retrieved successfully',
        data: {
          pending: {
            count: pendingResult.count || 0,
            total_amount: pendingAmount
          },
          completed: {
            count: completedResult.count || 0,
            total_amount: completedAmount
          },
          cancelled: {
            count: cancelledResult.count || 0,
            total_amount: cancelledAmount
          }
        }
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Withdrawal statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('Get withdrawal statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

 

 
 
// ==================== VOXCOIN WITHDRAWALS ====================

const getVoxcoinEligibleUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sort_by = 'voxcoin_balance',
      sort_order = 'desc'
    } = req.query;

    console.log('Getting VOXcoin eligible users with params:', { page, limit, search, sort_by, sort_order });

    // Get VOXcoin threshold from settings
    const { data: setting, error: settingError } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'voxcoin_withdrawal_threshold')
      .single();

    if (settingError) {
      console.log('No platform_settings table or threshold setting, using default');
    }

    const threshold = parseFloat(setting?.setting_value || 40000);
    console.log('Using VOXcoin threshold:', threshold);

    const offset = (page - 1) * limit;

    // When sorting by voxcoin_balance, query from wallets table first
    if (sort_by === 'voxcoin_balance') {
      console.log('Querying from wallets table for balance sorting...');
      
      let query = supabaseAdmin
        .from('wallets')
        .select(`
          voxcoin_balance,
          users!inner (
            id, username, full_name, email, phone_number, created_at
          )
        `)
        .gte('voxcoin_balance', threshold)
        .range(offset, offset + parseInt(limit) - 1)
        .order('voxcoin_balance', { ascending: sort_order === 'asc' });

      // Handle search - need to filter by user IDs first
      if (search) {
        console.log('Applying search filter...');
        const { data: searchUsers, error: searchError } = await supabaseAdmin
          .from('users')
          .select('id')
          .or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
        
        if (searchError) throw searchError;

        if (searchUsers && searchUsers.length > 0) {
          const userIds = searchUsers.map(user => user.id);
          query = query.in('user_id', userIds);
        } else {
          // No users match search, return empty
          return res.status(200).json({
            status: 'success',
            message: 'VOXcoin eligible users retrieved successfully',
            data: {
              users: [],
              threshold,
              pagination: {
                current_page: parseInt(page),
                total_pages: 0,
                total_users: 0,
                has_next: false,
                has_prev: page > 1,
                limit: parseInt(limit)
              }
            }
          });
        }
      }

      const { data: walletsData, error } = await query;
      if (error) throw error;

      // Transform data to match expected format
      const users = walletsData.map(wallet => ({
        ...wallet.users,
        wallets: { voxcoin_balance: wallet.voxcoin_balance }
      }));

      // Get total count
      let countQuery = supabaseAdmin
        .from('wallets')
        .select('*', { count: 'exact', head: true })
        .gte('voxcoin_balance', threshold);

      // Apply same search filter to count
      if (search) {
        const { data: searchUsers } = await supabaseAdmin
          .from('users')
          .select('id')
          .or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
        
        if (searchUsers && searchUsers.length > 0) {
          const userIds = searchUsers.map(user => user.id);
          countQuery = countQuery.in('user_id', userIds);
        }
      }

      const { count: totalCount, error: countError } = await countQuery;
      if (countError) throw countError;

      return res.status(200).json({
        status: 'success',
        message: 'VOXcoin eligible users retrieved successfully',
        data: {
          users,
          threshold,
          pagination: {
            current_page: parseInt(page),
            total_pages: Math.ceil((totalCount || 0) / limit),
            total_users: totalCount || 0,
            has_next: offset + limit < (totalCount || 0),
            has_prev: page > 1,
            limit: parseInt(limit)
          }
        }
      });
    }

    // For other sorting (by user fields), query from users table
    console.log('Querying from users table for user field sorting...');
    
    let query = supabaseAdmin
      .from('users')
      .select(`
        id, username, full_name, email, phone_number, created_at,
        wallets!inner (voxcoin_balance)
      `)
      .gte('wallets.voxcoin_balance', threshold)
      .range(offset, offset + parseInt(limit) - 1);

    // Apply sorting based on sort_by parameter
    if (sort_by === 'username' || sort_by === 'full_name' || sort_by === 'email' || sort_by === 'created_at') {
      query = query.order(sort_by, { ascending: sort_order === 'asc' });
    } else {
      // Default to created_at if invalid sort field
      query = query.order('created_at', { ascending: sort_order === 'asc' });
    }

    // Apply search filter
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
    }

    const { data: users, error } = await query;
    if (error) throw error;

    // Get total count for users table query
    let countQuery = supabaseAdmin
      .from('users')
      .select('*, wallets!inner(voxcoin_balance)', { count: 'exact', head: true })
      .gte('wallets.voxcoin_balance', threshold);

    // Apply same search filter to count
    if (search) {
      countQuery = countQuery.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
    }

    const { count: totalCount, error: countError } = await countQuery;
    if (countError) throw countError;

    res.status(200).json({
      status: 'success',
      message: 'VOXcoin eligible users retrieved successfully',
      data: {
        users,
        threshold,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil((totalCount || 0) / limit),
          total_users: totalCount || 0,
          has_next: offset + limit < (totalCount || 0),
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get VOXcoin eligible users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

 

 

// ==================== PLATFORM SETTINGS ====================

const getSettings = async (req, res) => {
  try {
    const { data: settings, error } = await supabaseAdmin
      .from('platform_settings')
      .select('*')
      .order('setting_key');

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      message: 'Settings retrieved successfully',
      data: { settings }
    });

  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const updateSetting = async (req, res) => {
  try {
    const { setting_key, setting_value } = req.body;
 

    const { data: updatedSetting, error } = await supabaseAdmin
      .from('platform_settings')
      .update({
        setting_value,
        updated_by: req.user.id,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', setting_key)
      .select()
      .single();

    if (error) throw error;

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: req.user.id,
        activity_type: 'setting_updated',
        description: `Updated setting: ${setting_key}`,
        metadata: { setting_key, new_value: setting_value }
      });

    res.status(200).json({
      status: 'success',
      message: 'Setting updated successfully',
      data: { setting: updatedSetting }
    });

  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};


const getDashboardStats = async (req, res) => {
  try {
    // Get basic user stats
    const { data: userStats } = await supabaseAdmin
      .from('users')
      .select('user_tier, account_status, role')
      .not('role', 'eq', 'admin');

    // Get transaction stats (last 30 days)
    const { data: transactionStats } = await supabaseAdmin
      .from('transactions')
      .select('transaction_type, status, amount')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Get pending withdrawals
    const { data: pendingWithdrawals } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending');

    // Get package prices from settings
    const { data: packagePrices } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['package_price_amateur', 'package_price_pro', 'upcoming_payout_date']);

    const amateurPrice = parseFloat(packagePrices?.find(p => p.setting_key === 'package_price_amateur')?.setting_value || 9500);
    const proPrice = parseFloat(packagePrices?.find(p => p.setting_key === 'package_price_pro')?.setting_value || 15000);

       const upcomingPayoutDate = packagePrices?.find(p => p.setting_key === 'upcoming_payout_date')?.setting_value
      
 

    // Get total package codes generated and used
    const { data: amateurCodes } = await supabaseAdmin
      .from('package_codes')
      .select('is_used')
      .eq('package_type', 'Amateur');

    const { data: proCodes } = await supabaseAdmin
      .from('package_codes')
      .select('is_used')
      .eq('package_type', 'Pro');

    const amateurUsedCount = amateurCodes?.filter(c => c.is_used).length || 0;
    const proUsedCount = proCodes?.filter(c => c.is_used).length || 0;

    // Calculate revenue generated
    const revenueGenerated = (amateurUsedCount * amateurPrice) + (proUsedCount * proPrice);

    // Get total codes generated
    const totalCodesGenerated = (amateurCodes?.length || 0) + (proCodes?.length || 0);

    // Get VoxSkit uploaded count
    const { count: voxskitCount } = await supabaseAdmin
      .from('voxskit_videos')
      .select('*', { count: 'exact', head: true });

    // Get most recent registered users (last 10)
    const { data: recentUsers } = await supabaseAdmin
      .from('users')
      .select(`
        *
      `)
      // .not('role', 'eq', 'admin')
      .order('created_at', { ascending: false })
      .limit(10);

 

    // Get balance growth (total withdrawable balance across all users)
    const { data: wallets } = await supabaseAdmin
      .from('wallets')
      .select('withdrawable_balance, voxcoin_balance');

    const totalWithdrawableBalance = wallets?.reduce((sum, w) => sum + parseFloat(w.withdrawable_balance || 0), 0) || 0;
    const totalVoxcoinBalance = wallets?.reduce((sum, w) => sum + parseFloat(w.voxcoin_balance || 0), 0) || 0;

    // Calculate stats
    const stats = {
      users: {
        total: userStats?.length || 0,
        by_tier: {
          Amateur: userStats?.filter(u => u.user_tier === 'Amateur').length || 0,
          Pro: userStats?.filter(u => u.user_tier === 'Pro').length || 0
        },
        by_role: {
          user: userStats?.filter(u => u.role === 'user').length || 0,
          merchant: userStats?.filter(u => u.role === 'merchant').length || 0,
          manager: userStats?.filter(u => u.role === 'manager').length || 0
        },
        active: userStats?.filter(u => u.account_status === 'active').length || 0,
        suspended: userStats?.filter(u => u.account_status === 'suspended').length || 0
      },
      revenue: {
        total_generated: revenueGenerated,
        amateur_revenue: amateurUsedCount * amateurPrice,
        pro_revenue: proUsedCount * proPrice,
        amateur_codes_used: amateurUsedCount,
        pro_codes_used: proUsedCount
      },
      codes: {
        total_generated: totalCodesGenerated,
        amateur_codes: amateurCodes?.length || 0,
        pro_codes: proCodes?.length || 0,
        total_used: amateurUsedCount + proUsedCount,
        total_unused: totalCodesGenerated - (amateurUsedCount + proUsedCount)
      },
      voxskit: {
        total_videos_uploaded: voxskitCount || 0
      },
      balance_growth: {
        total_withdrawable_balance: totalWithdrawableBalance,
        total_voxcoin_balance: totalVoxcoinBalance,
        combined_balance: totalWithdrawableBalance + totalVoxcoinBalance
      },
      transactions: {
        total_30_days: transactionStats?.length || 0,
        by_type: {
          withdrawal: transactionStats?.filter(t => t.transaction_type === 'withdrawal').length || 0,
          deposit: transactionStats?.filter(t => t.transaction_type === 'deposit').length || 0,
          reward: transactionStats?.filter(t => t.transaction_type === 'reward').length || 0,
          transfer: transactionStats?.filter(t => t.transaction_type === 'transfer').length || 0
        }
      },
      withdrawals: {
        pending_count: pendingWithdrawals?.length || 0,
        pending_amount: pendingWithdrawals?.reduce((sum, w) => sum + parseFloat(w.amount), 0) || 0
      },
      recent_users: recentUsers,
        platform_info: {
        upcoming_payout_date: upcomingPayoutDate
      }
    };

    res.status(200).json({
      status: 'success',
      message: 'Dashboard stats retrieved successfully',
      data: { stats }
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};



const getTopEarners = async (req, res) => {
  try {
    
    const { data: topEarners, error } = await supabaseAdmin
      .from('wallets')
      .select(`
        withdrawable_balance,
        total_accumulated_earnings,
        users!inner (
          username,
          user_tier
        )
      `)
      .order('total_accumulated_earnings', { ascending: false })
      .limit(10);

    if (error) throw error;

    // Format response
    const formattedEarners = topEarners?.map((entry, index) => ({
      rank: index + 1,
      username: entry.users.username,
      user_tier: entry.users.user_tier,
      current_balance: parseFloat(entry.withdrawable_balance),
      total_accumulated_earnings: parseFloat(entry.total_accumulated_earnings)
    })) || [];

    res.status(200).json({
      status: 'success',
      message: 'Top earners retrieved successfully',
      data: {
        top_earners: formattedEarners
      }
    });

  } catch (error) {
    console.error('Get top earners error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

 

module.exports = {
  // User Management
  getAllUsers,
  getUserDetails,
  updateUserStatus,getUserEarningsAdmin,
  
  // Withdrawal Management
  getPendingWithdrawals,
  processWithdrawal,
  bulkProcessWithdrawals,
  getWithdrawalStatistics,

  
  // VOXcoin Management
  getVoxcoinEligibleUsers,
  
  // Settings Management
  getSettings,
  updateSetting,
  
  // Dashboard
  getDashboardStats,

   // Public Leaderboards
  getTopEarners,
};