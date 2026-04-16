const { supabaseAdmin } = require('../services/supabase.service');
const { decryptPassword } = require('../utils/helpers');

// ==================== USER MANAGEMENT ====================

const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role,
      user_tier,
      account_status,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('users')
      .select(`
        id, email, username, full_name, phone_number, 
        user_tier, role, account_status, referral_code,
        original_password, created_at, last_login_at, referred_by,
        referrer:referred_by (
          id, username, email
        ),
        wallets (
          games_balance, referral_balance, investment_balance, coins_balance,
          total_withdrawn_games, total_withdrawn_referral, 
          total_withdrawn_investment, total_withdrawn_coins
        )
      `)
      .range(offset, offset + parseInt(limit) - 1)
      .order(sort_by, { ascending: sort_order === 'asc' });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
    }
    if (role) query = query.eq('role', role);
    if (user_tier) query = query.eq('user_tier', user_tier);
    if (account_status) query = query.eq('account_status', account_status);

    const { data: users, error } = await query;
    if (error) throw error;

    const usersWithDecryptedPasswords = users.map(user => {
      const cleanUser = {
        ...user,
        decrypted_password: user.original_password ? decryptPassword(user.original_password) : 'Not available'
      };
      delete cleanUser.original_password;
      return cleanUser;
    });

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

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select(`
        id, email, username, full_name, phone_number, 
        user_tier, role, account_status, referral_code, 
        password, original_password,
       
        created_at, updated_at, last_login_at, referred_by,
        referrer:referred_by (
          id, username, full_name, email, user_tier, role,
          password, original_password, phone_number, created_at,
          wallets (
            referral_balance, coins_balance
          )
        ),
        wallets (*)
      `)
      .eq('id', userId)
      .single();

    if (error) throw error;

    let userDecryptedPassword = 'Not available';
    if (user.original_password) {
      try {
        userDecryptedPassword = decryptPassword(user.original_password);
      } catch (error) {
        console.error('Error decrypting user password:', error);
        userDecryptedPassword = 'Decryption failed';
      }
    }

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

    const { data: directReferrals } = await supabaseAdmin
      .from('users')
      .select(`
        id, username, full_name, user_tier, email, 
        password, original_password, phone_number, created_at, referred_by,
        referrer:referred_by (
          id, username, full_name, email
        ),
        wallets (
          referral_balance, coins_balance
        )
      `)
      .eq('referred_by', userId)
      .order('created_at', { ascending: false });

    const directReferralsWithPasswords = directReferrals?.map(ref => {
      let decryptedPassword = 'Not available';
      if (ref.original_password) {
        try {
          decryptedPassword = decryptPassword(ref.original_password);
        } catch (error) {
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
            referral_balance, coins_balance
          )
        `)
        .in('referred_by', directReferralIds)
        .order('created_at', { ascending: false });
      
      if (tier1Data) {
        tier1Referrals.push(...tier1Data);
      }
    }

    const tier1ReferralsWithPasswords = tier1Referrals.map(ref => {
      let decryptedPassword = 'Not available';
      if (ref.original_password) {
        try {
          decryptedPassword = decryptPassword(ref.original_password);
        } catch (error) {
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
            referral_balance, coins_balance
          )
        `)
        .in('referred_by', tier1ReferralIds)
        .order('created_at', { ascending: false });
      
      if (tier2Data) {
        tier2Referrals.push(...tier2Data);
      }
    }

    const tier2ReferralsWithPasswords = tier2Referrals.map(ref => {
      let decryptedPassword = 'Not available';
      if (ref.original_password) {
        try {
          decryptedPassword = decryptPassword(ref.original_password);
        } catch (error) {
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

    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: referralBreakdown } = await supabaseAdmin
      .from('referrals')
      .select('package_type, direct_reward, tier1_reward, tier2_reward, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    const wallet = user.wallets?.[0] || {};
    const summary = {
      total_balance: (parseFloat(wallet.games_balance || 0) + 
                     parseFloat(wallet.referral_balance || 0) + 
                     parseFloat(wallet.investment_balance || 0) + 
                     parseFloat(wallet.coins_balance || 0)),
      games_balance: parseFloat(wallet.games_balance || 0),
      referral_balance: parseFloat(wallet.referral_balance || 0),
      investment_balance: parseFloat(wallet.investment_balance || 0),
      coins_balance: parseFloat(wallet.coins_balance || 0),
      total_withdrawn: (parseFloat(wallet.total_withdrawn_games || 0) +
                       parseFloat(wallet.total_withdrawn_referral || 0) +
                       parseFloat(wallet.total_withdrawn_investment || 0) +
                       parseFloat(wallet.total_withdrawn_coins || 0))
    };

    res.status(200).json({
      status: 'success',
      message: 'User details retrieved successfully',
      data: {
        user: {
          ...user,
          decrypted_password: userDecryptedPassword,
          referrer: referrerInfo
        },
        referrer_info: referrerInfo,
        referral_network: {
          direct_referrals: directReferralsWithPasswords,
          tier1_referrals: tier1ReferralsWithPasswords,
          tier2_referrals: tier2ReferralsWithPasswords
        },
        referral_stats: {
          direct_count: directReferrals?.length || 0,
          tier1_count: tier1Referrals?.length || 0,
          tier2_count: tier2Referrals?.length || 0,
          total_network: (directReferrals?.length || 0) + (tier1Referrals?.length || 0) + (tier2Referrals?.length || 0),
          breakdown: referralBreakdown
        },
        summary,
        transactions: transactions || []
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

const determineTransactionType = (transaction) => {
  const { transaction_type, earning_type } = transaction;
  
  const creditTypes = ['reward', 'deposit', 'transfer_in', 'refund', 'bonus'];
  const debitTypes = ['withdrawal', 'game_entry', 'investment', 'transfer_out', 'purchase'];
  const creditEarningTypes = ['referral_reward', 'tier1_reward', 'tier2_reward', 'game_win', 'investment_return'];

  if (creditTypes.includes(transaction_type)) return true;
  if (debitTypes.includes(transaction_type)) return false;
  if (earning_type && creditEarningTypes.includes(earning_type)) return true;

  return parseFloat(transaction.amount) >= 0;
};

const getUserEarningsAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    const { days = 30 } = req.query;

    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;

    const { data: allTransactions, error: transError } = await supabaseAdmin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (transError) throw transError;

    let totalEarnings = 0;
    let totalDeductions = 0;
    let recentEarnings = 0;
    let recentDeductions = 0;

    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - parseInt(days));

    const earningsBreakdown = {
      referral_rewards: 0,
      tier1_rewards: 0,
      tier2_rewards: 0,
      game_wins: 0,
      investment_returns: 0,
      deposits: 0,
      other: 0
    };

    const deductionsBreakdown = {
      withdrawals: 0,
      game_entries: 0,
      investments: 0,
      transfers: 0,
      purchases: 0,
      other: 0
    };

    const enhancedRecentTransactions = [];
    const creditTransactions = [];
    const debitTransactions = [];
    const recentCreditTransactions = [];
    const recentDebitTransactions = [];

    allTransactions.forEach(t => {
      const amount = parseFloat(t.amount);
      const isCredit = determineTransactionType(t);
      const isRecent = new Date(t.created_at) >= dateLimit;

      if (isCredit) {
        totalEarnings += amount;
        creditTransactions.push(t);
        if (isRecent) {
          recentEarnings += amount;
          recentCreditTransactions.push(t);
        }

        if (t.earning_type === 'referral_reward') earningsBreakdown.referral_rewards += amount;
        else if (t.earning_type === 'tier1_reward') earningsBreakdown.tier1_rewards += amount;
        else if (t.earning_type === 'tier2_reward') earningsBreakdown.tier2_rewards += amount;
        else if (t.earning_type === 'game_win') earningsBreakdown.game_wins += amount;
        else if (t.earning_type === 'investment_return') earningsBreakdown.investment_returns += amount;
        else if (t.transaction_type === 'deposit') earningsBreakdown.deposits += amount;
        else earningsBreakdown.other += amount;

      } else {
        totalDeductions += amount;
        debitTransactions.push(t);
        if (isRecent) {
          recentDeductions += amount;
          recentDebitTransactions.push(t);
        }

        if (t.transaction_type === 'withdrawal') deductionsBreakdown.withdrawals += amount;
        else if (t.transaction_type === 'game_entry') deductionsBreakdown.game_entries += amount;
        else if (t.transaction_type === 'investment') deductionsBreakdown.investments += amount;
        else if (t.transaction_type === 'transfer_out') deductionsBreakdown.transfers += amount;
        else if (t.transaction_type === 'purchase') deductionsBreakdown.purchases += amount;
        else deductionsBreakdown.other += amount;
      }

      if (isRecent) {
        enhancedRecentTransactions.push({
          ...t,
          type_category: isCredit ? 'credit' : 'debit'
        });
      }
    });

    const { count: directReferrals } = await supabaseAdmin
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', userId);

    const responseData = {
      current_wallet: {
        coins_balance: parseFloat(wallet.coins_balance || 0),
        games_balance: parseFloat(wallet.games_balance || 0),
        referral_balance: parseFloat(wallet.referral_balance || 0),
        investment_balance: parseFloat(wallet.investment_balance || 0),
        total_withdrawn_games: parseFloat(wallet.total_withdrawn_games || 0),
        total_withdrawn_referral: parseFloat(wallet.total_withdrawn_referral || 0),
        total_withdrawn_investment: parseFloat(wallet.total_withdrawn_investment || 0),
        total_withdrawn_coins: parseFloat(wallet.total_withdrawn_coins || 0)
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
        direct_referrals: directReferrals || 0,
        tier1_referrals: 0,
        tier2_referrals: 0,
        total_referrals: directReferrals || 0
      },

      recent_transactions: enhancedRecentTransactions.slice(0, 20),

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

    let query = supabaseAdmin
      .from('transactions')
      .select(`
        id, user_id, amount, currency, description, reference,
        withdrawal_method, created_at, metadata, balance_type,
        users!transactions_user_id_fkey (id, username, full_name, email, phone_number)
      `)
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending')
      .range(offset, offset + parseInt(limit) - 1)
      .order(sort_by, { ascending: sort_order === 'asc' });

    if (search) {
      const { data: searchUsers, error: userError } = await supabaseAdmin
        .from('users')
        .select('id')
        .or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);
      
      if (userError) throw userError;
      
      if (searchUsers.length > 0) {
        const userIds = searchUsers.map(user => user.id);
        query = query.in('user_id', userIds);
      } else {
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

    let countQuery = supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'pending');

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

    if (!['approve', 'decline'].includes(action)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid action. Must be "approve" or "decline"'
      });
    }

    console.log(`=== PROCESSING WITHDRAWAL ${action.toUpperCase()}: ${transactionId} ===`);

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
      const balanceType = transaction.balance_type || 'referral_balance';
      const balanceName = balanceType.replace('_balance', '');
      const totalWithdrawnField = `total_withdrawn_${balanceName}`;

      const { data: currentWallet, error: walletFetchError } = await supabaseAdmin
        .from('wallets')
        .select(totalWithdrawnField)
        .eq('user_id', transaction.user_id)
        .single();

      if (walletFetchError) {
        console.error(`Failed to fetch wallet for ${totalWithdrawnField} update:`, walletFetchError);
        throw walletFetchError;
      }

      const currentTotal = parseFloat(currentWallet[totalWithdrawnField] || 0);
      const newTotalWithdrawn = currentTotal + parseFloat(transaction.amount);

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

      const { error: walletUpdateError } = await supabaseAdmin
        .from('wallets')
        .update({
          [totalWithdrawnField]: newTotalWithdrawn
        })
        .eq('user_id', transaction.user_id);

      if (walletUpdateError) {
        console.error(`Failed to update ${totalWithdrawnField}:`, walletUpdateError);
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

      console.log(`✅ Updated ${totalWithdrawnField}: ${currentTotal} + ${transaction.amount} = ${newTotalWithdrawn}`);
      console.log('✅ Withdrawal approved successfully');

      await supabaseAdmin
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
            new_total_withdrawn: newTotalWithdrawn,
            balance_type: balanceType
          }
        });

      return res.status(200).json({
        status: 'success',
        message: 'Withdrawal approved successfully',
        data: { 
          transactionId, 
          action: 'approve', 
          amount: parseFloat(transaction.amount),
          username: transaction.users.username,
          new_total_withdrawn: newTotalWithdrawn,
          balance_type: balanceType
        }
      });

    } else if (action === 'decline') {
      console.log('Processing decline with refund...');

      const balanceType = transaction.balance_type || 'referral_balance';

      const { data: currentWallet, error: walletFetchError } = await supabaseAdmin
        .from('wallets')
        .select(balanceType)
        .eq('user_id', transaction.user_id)
        .single();

      if (walletFetchError || !currentWallet) {
        console.error('Failed to fetch user wallet:', walletFetchError);
        return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch user wallet'
        });
      }

      const currentBalance = parseFloat(currentWallet[balanceType] || 0);
      const refundAmount = parseFloat(transaction.amount);
      const newBalance = currentBalance + refundAmount;

      console.log(`Refunding ${refundAmount} to ${balanceType}. New balance: ${newBalance}`);

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

      const { error: walletUpdateError } = await supabaseAdmin
        .from('wallets')
        .update({
          [balanceType]: newBalance
        })
        .eq('user_id', transaction.user_id);

      if (walletUpdateError) {
        console.error(`Failed to update wallet balance ${balanceType}:`, walletUpdateError);
        
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

      console.log(' Withdrawal decline and refund completed successfully');

      await supabaseAdmin
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
            balance_type: balanceType,
            refunded_to_balance: newBalance
          }
        });

      return res.status(200).json({
        status: 'success',
        message: 'Withdrawal declined successfully and amount refunded to user',
        data: { 
          transactionId, 
          action: 'decline', 
          amount: parseFloat(transaction.amount),
          username: transaction.users.username,
          decline_reason: decline_reason?.trim() || null,
          balance_type: balanceType,
          new_balance: newBalance
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
          const balanceType = transaction.balance_type || 'referral_balance';
          const balanceName = balanceType.replace('_balance', '');
          const totalWithdrawnField = `total_withdrawn_${balanceName}`;

          const { data: currentWallet, error: walletFetchError } = await supabaseAdmin
            .from('wallets')
            .select(totalWithdrawnField)
            .eq('user_id', transaction.user_id)
            .single();
            
          if (walletFetchError) {
            console.error(`Failed to fetch wallet for transaction ${transaction.id}:`, walletFetchError);
            failedIds.push(transaction.id);
            continue;
          }

          const currentTotal = parseFloat(currentWallet[totalWithdrawnField] || 0);
          const newTotalWithdrawn = currentTotal + parseFloat(transaction.amount);

          const { error: updateError } = await supabaseAdmin
            .from('transactions')
            .update({
              status: 'completed',
              processed_by: req.user.id,
              processed_at: new Date().toISOString()
            })
            .eq('id', transaction.id);

          if (!updateError) {
            const { error: walletUpdateError } = await supabaseAdmin
              .from('wallets')
              .update({
                [totalWithdrawnField]: newTotalWithdrawn
              })
              .eq('user_id', transaction.user_id);
              
            if (walletUpdateError) {
              console.error(`Failed to update ${totalWithdrawnField} for transaction ${transaction.id}:`, walletUpdateError);
              failedIds.push(transaction.id);
            } else {
              processedIds.push(transaction.id);
              totalAmount += parseFloat(transaction.amount);
              console.log(`✅ Approved transaction ${transaction.id}`);
            }
          } else {
            console.error(`Failed to approve transaction ${transaction.id}:`, updateError);
            failedIds.push(transaction.id);
          }

        } else if (action === 'decline') {
          const balanceType = transaction.balance_type || 'referral_balance';
          
          const { data: currentWallet, error: walletFetchError } = await supabaseAdmin
            .from('wallets')
            .select(balanceType)
            .eq('user_id', transaction.user_id)
            .single();

          if (walletFetchError || !currentWallet) {
            console.error(`Failed to fetch wallet for transaction ${transaction.id}:`, walletFetchError);
            failedIds.push(transaction.id);
            continue;
          }

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

          const currentBalance = parseFloat(currentWallet[balanceType] || 0);
          const refundAmount = parseFloat(transaction.amount);
          const newBalance = currentBalance + refundAmount;

          const { error: walletUpdateError } = await supabaseAdmin
            .from('wallets')
            .update({
              [balanceType]: newBalance
            })
            .eq('user_id', transaction.user_id);

          if (walletUpdateError) {
            console.error(`Failed to update wallet balance for transaction ${transaction.id}:`, walletUpdateError);
            failedIds.push(transaction.id);
          } else {
            processedIds.push(transaction.id);
            totalAmount += parseFloat(transaction.amount);
            console.log(`✅ Refunded transaction ${transaction.id} to ${balanceType}`);
          }
        }

      } catch (error) {
        console.error(`Error processing transaction ${transaction.id}:`, error);
        failedIds.push(transaction.id);
      }
    }

    console.log(`Bulk processing completed: ${processedIds.length} successful, ${failedIds.length} failed`);

    await supabaseAdmin
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

const getWithdrawalStatistics = async (req, res) => {
  try {
    const { data: stats, error } = await supabaseAdmin
      .rpc('get_withdrawal_stats');

    if (error || !stats) {
      if (error && error.code !== 'PGRST202') {
        console.warn('RPC get_withdrawal_stats failed or missing, falling back to manual queries details:', error.message);
      }
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

// ==================== COINS (KASHCOIN) MANAGEMENT ====================

/**
 * GET /api/admin/kashcoin/statistics
 * Comprehensive analytics for KASHcoin system
 */
const getKashcoinStatistics = async (req, res) => {
  try {
    // 1. Get Dynamic Payout Threshold
    const { data: settings } = await supabaseAdmin.from('platform_settings').select('setting_key, setting_value');
    const settingsMap = {};
    settings?.forEach(s => settingsMap[s.setting_key] = s.setting_value);
    
    const threshold = parseFloat(settingsMap['coins_withdrawal_threshold_amount'] || 50000);

    // 2. Fetch High-Level Wallet Stats
    const { data: allWallets, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('coins_balance, user_id');

    if (walletError) throw walletError;

    const totalCoinsPool = allWallets.reduce((sum, w) => sum + parseFloat(w.coins_balance || 0), 0);
    const eligibleWallets = allWallets.filter(w => parseFloat(w.coins_balance) >= threshold);
    const totalPayableUsers = eligibleWallets.length;
    const totalPayableAmount = eligibleWallets.reduce((sum, w) => sum + parseFloat(w.coins_balance || 0), 0);
    const pendingNearThreshold = allWallets.filter(w => {
      const bal = parseFloat(w.coins_balance);
      return bal >= (threshold * 0.8) && bal < threshold;
    }).length;

    // 3. Fetch Transactional Trends (Last 30 Days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentTransactions, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('amount, transaction_type, created_at, user_id, status')
      .eq('balance_type', 'coins_balance')
      .gte('created_at', thirtyDaysAgo.toISOString());

    if (txError) throw txError;

    // Aggregate Daily Earnings
    const dailyEarnings = {};
    
    recentTransactions.forEach(tx => {
      const date = tx.created_at.split('T')[0];
      const amount = Math.abs(parseFloat(tx.amount));
      
      // Treat any positive transaction or reward-like type as an earning
      const isEarning = tx.transaction_type.toLowerCase().includes('reward') || 
                        tx.transaction_type.toLowerCase().includes('earning') ||
                        tx.transaction_type === 'gaming' ||
                        parseFloat(tx.amount) > 0;

      if (isEarning && tx.transaction_type !== 'withdrawal') {
        dailyEarnings[date] = (dailyEarnings[date] || 0) + amount;
      }
    });

    const earningsChartData = Object.keys(dailyEarnings).sort().map(date => ({
      date,
      amount: dailyEarnings[date],
      display_date: new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    }));

    // 4. Calculate PAID & EARNING Rankings
    const getRanking = async (type = 'withdrawal', days = 0) => {
      let query = supabaseAdmin
        .from('transactions')
        .select(`
          amount,
          user_id,
          transaction_type,
          users:user_id (
            username,
            full_name,
            profile_picture
          )
        `)
        .eq('balance_type', 'coins_balance');

      if (type === 'withdrawal') {
        query = query.eq('transaction_type', 'withdrawal').eq('status', 'completed');
      } else {
        // For Earnings: include everything except withdrawals
        query = query.not('transaction_type', 'eq', 'withdrawal');
      }
      
      if (days > 0) {
        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - days);
        query = query.gte('created_at', dateLimit.toISOString());
      }

      const { data } = await query;
      
      const userSums = {};
      data?.forEach(tx => {
        const uid = tx.user_id;
        if (!userSums[uid]) {
          userSums[uid] = { 
            id: uid,
            username: tx.users?.username || 'Unknown',
            full_name: tx.users?.full_name || 'N/A',
            profile_picture: tx.users?.profile_picture,
            amount: 0 
          };
        }
        userSums[uid].amount += Math.abs(parseFloat(tx.amount));
      });

      return Object.values(userSums)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
    };

    const rankings = {
      payouts: {
        today: await getRanking('withdrawal', 1),
        week: await getRanking('withdrawal', 7),
        month: await getRanking('withdrawal', 30),
        all_time: await getRanking('withdrawal', 0)
      },
      earnings: {
        today: await getRanking('earning', 1),
        week: await getRanking('earning', 7),
        month: await getRanking('earning', 30),
        all_time: await getRanking('earning', 0)
      }
    };

    // 5. Total Coins Paid Out to Users
    const { data: allPayouts } = await supabaseAdmin
      .from('transactions')
      .select('amount')
      .eq('balance_type', 'coins_balance')
      .eq('transaction_type', 'withdrawal')
      .eq('status', 'completed');

    const totalPaidOut = allPayouts?.reduce((sum, tx) => sum + Math.abs(parseFloat(tx.amount)), 0) || 0;

    return res.status(200).json({
      status: 'success',
      data: {
        summary: {
          total_pool: totalCoinsPool,
          total_payable_users: totalPayableUsers,
          total_payable_amount: totalPayableAmount,
          near_threshold_count: pendingNearThreshold,
          total_paid_out: totalPaidOut,
          payout_threshold: threshold
        },
        charts: {
          earnings: earningsChartData
        },
        rankings: rankings
      }
    });

  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to fetch analytics' });
  }
};

const getKashcoinEligibleUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      sort_by = 'coins_balance',
      sort_order = 'desc'
    } = req.query;

    const { data: settings } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['coins_withdrawal_threshold_amount', 'coins_withdrawal_threshold', 'kashcoin_withdrawal_threshold']);

    const getRawSettingValue = (key) => {
      const row = settings?.find(s => s.setting_key === key);
      if (!row) return null;
      try {
        // Platform settings might be stored as JSON strings
        const parsed = JSON.parse(row.setting_value);
        return parsed;
      } catch (e) {
        return row.setting_value;
      }
    };

    const thresholdVal = getRawSettingValue('coins_withdrawal_threshold_amount') || 50000;
    
    const threshold = parseFloat(thresholdVal) || 50000;

    const offset = (page - 1) * limit;

    // Start with wallets because that's where the balance and filtering happens
    let query = supabaseAdmin
      .from('wallets')
      .select(`
        coins_balance,
        account_name,
        bank_name,
        account_number,
        users:user_id (
          id, username, full_name, email, phone_number, created_at
        )
      `)
      .gte('coins_balance', threshold)
      .range(offset, offset + parseInt(limit) - 1)
      .order('coins_balance', { ascending: sort_order === 'asc' });

    if (search) {
      // If searching, we need to filter by user details
      // In Supabase, filtering on a joined table in a select is done via !inner or filters
      // But one of the easiest ways is to get user IDs first if search is provided
      const { data: searchUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
      
      if (searchUsers && searchUsers.length > 0) {
        query = query.in('user_id', searchUsers.map(u => u.id));
      } else {
        // No users match search, return empty early
        return res.status(200).json({
          status: 'success',
          message: 'No matching users found',
          data: { users: [], threshold, pagination: { current_page: parseInt(page), total_pages: 0, total_users: 0, has_next: false, has_prev: page > 1, limit: parseInt(limit) } }
        });
      }
    }

    const { data: eligibleUsers, error } = await query;
    if (error) throw error;

    // Count query
    let countQuery = supabaseAdmin
      .from('wallets')
      .select('*', { count: 'exact', head: true })
      .gte('coins_balance', threshold);

    if (search) {
      const { data: searchUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%,username.ilike.%${search}%`);
      if (searchUsers) {
        countQuery = countQuery.in('user_id', searchUsers.map(u => u.id));
      }
    }

    const { count: totalCount } = await countQuery;

    res.status(200).json({
      status: 'success',
      message: 'Eligible users retrieved successfully',
      data: {
        users: eligibleUsers || [],
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
    console.error('Get eligible users error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const processKashcoinPayments = async (req, res) => {
  try {
    const { user_ids } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No users selected' });
    }

    const { data: settings } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['coins_withdrawal_threshold_amount', 'coins_withdrawal_threshold', 'kashcoin_withdrawal_threshold']);

    const getRawSettingValue = (key) => {
      const row = settings?.find(s => s.setting_key === key);
      if (!row) return null;
      try { return JSON.parse(row.setting_value); }
      catch (e) { return row.setting_value; }
    };

    const thresholdVal = getRawSettingValue('coins_withdrawal_threshold_amount') 
                      || getRawSettingValue('coins_withdrawal_threshold') 
                      || getRawSettingValue('kashcoin_withdrawal_threshold') 
                      || 50000;
    
    const threshold = parseFloat(thresholdVal) || 50000;

    const results = [];
    for (const userId of user_ids) {
      const { data: wallet, error: fetchError } = await supabaseAdmin
        .from('wallets')
        .select('coins_balance, total_withdrawn_coins, account_name, bank_name, account_number')
        .eq('user_id', userId)
        .single();

      if (fetchError || !wallet) {
        results.push({ user_id: userId, status: 'error', message: 'Wallet not found' });
        continue;
      }

      const currentBalance = parseFloat(wallet.coins_balance);
      if (currentBalance < threshold) {
        results.push({ user_id: userId, status: 'error', message: 'Insufficient balance' });
        continue;
      }

      const newBalance = currentBalance - threshold;
      const newWithdrawn = parseFloat(wallet.total_withdrawn_coins || 0) + threshold;

      const { error: updateError } = await supabaseAdmin
        .from('wallets')
        .update({
          coins_balance: newBalance,
          total_withdrawn_coins: newWithdrawn,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        results.push({ user_id: userId, status: 'error', message: 'Update failed' });
        continue;
      }

      const timestamp = new Date().toISOString();
      const reference = `WD-PAYOUT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      const txRecord = {
        user_id: userId,
        transaction_type: 'withdrawal',
        balance_type: 'coins_balance',
        earning_type: 'withdrawal_payout',
        amount: threshold,
        currency: 'NGN',
        status: 'completed',
        reference: reference,
        description: `Kashcoin withdrawal payout: ₦${threshold.toLocaleString()}`,
        withdrawal_method: 'bank_transfer',
        metadata: {
          account_name: wallet.account_name || 'N/A',
          bank_name: wallet.bank_name || 'N/A',
          account_number: wallet.account_number || 'N/A',
          processed_by_admin: req.user.id,
          processed_at: timestamp,
          payment_category: 'kashcoin_payout'
        }
      };

      console.log(`[PAYOUT] Attempting to log transaction for user ${userId}...`);
      const { data: txData, error: txError } = await supabaseAdmin.from('transactions').insert(txRecord).select().single();

      if (txError) {
        console.error(`[PAYOUT ERROR] Database rejected transaction for user ${userId}:`, txError);
        results.push({ user_id: userId, status: 'partial_success', message: txError.message });
      } else {
        console.log(`[PAYOUT SUCCESS] Transaction recorded with ID: ${txData?.id}`);
        results.push({ user_id: userId, status: 'success', transaction_id: txData?.id });
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Processing complete',
      data: { results }
    });

  } catch (error) {
    console.error('Process kashcoin payments error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
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
    
    // Ensure we stringify objects or arrays if the DB expects JSON/Text that is stringified.
    // Given the DB stores '"true"', '"100"', we must stringify if it's not already stringified.
    let valueToStore = setting_value;
    if (typeof setting_value === 'string' || typeof setting_value === 'number' || typeof setting_value === 'boolean' || typeof setting_value === 'object') {
       valueToStore = JSON.stringify(setting_value);
    }

    const { data: updatedSetting, error } = await supabaseAdmin
      .from('platform_settings')
      .update({
        setting_value: valueToStore,
        updated_at: new Date().toISOString()
      })
      .eq('setting_key', setting_key)
      .select()
      .single();

    if (error) throw error;

    // Clear settings cache so changes apply immediately
    const { clearCache } = require('./settings.controller');
    clearCache();

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
    // 1. User Stats
    const { data: users, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_tier, role')
      .neq('role', 'admin');

    if (userError) throw userError;

    const totalUsers = users.length;
    const proUsersCount = users.filter(u => u.user_tier === 'Pro').length;
    const freeUsersCount = totalUsers - proUsersCount;

    // 2. Platform Settings (for Pro Price)
    const { data: settings } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value')
      .eq('setting_key', 'package_price_pro')
      .single();

    const proPrice = parseFloat(settings?.setting_value || 15000);

    // 3. Game Stats (Revenue from Losses)
    // Coinflip
    const { data: coinflipRounds } = await supabaseAdmin
      .from('coinflip_rounds')
      .select('stake_amount, payout_amount');

    const coinflipWagered = coinflipRounds?.reduce((sum, r) => sum + parseFloat(r.stake_amount), 0) || 0;
    const coinflipPaidOut = coinflipRounds?.reduce((sum, r) => sum + parseFloat(r.payout_amount), 0) || 0;
    const coinflipRevenue = coinflipWagered - coinflipPaidOut;

    // Mines
    const { data: minesRounds } = await supabaseAdmin
      .from('mines_rounds')
      .select('stake_amount, payout_amount');

    const minesWagered = minesRounds?.reduce((sum, r) => sum + parseFloat(r.stake_amount), 0) || 0;
    const minesPaidOut = minesRounds?.reduce((sum, r) => sum + parseFloat(r.payout_amount), 0) || 0;
    const minesRevenue = minesWagered - minesPaidOut;

    const totalGameRevenue = coinflipRevenue + minesRevenue;

    // 4. Revenue Calculation
    const proRevenue = proUsersCount * proPrice;
    const totalRevenue = proRevenue + totalGameRevenue;

    // 5. Payables
    // Investments (Money not yet paid out)
    const { data: activeInvestments } = await supabaseAdmin
      .from('investments')
      .select('total_return, total_paid_out')
      .eq('status', 'active');

    const investmentPayables = activeInvestments?.reduce((sum, inv) => {
      const remaining = parseFloat(inv.total_return) - parseFloat(inv.total_paid_out);
      return sum + (remaining > 0 ? remaining : 0);
    }, 0) || 0;

    // Referral Balance (Due to be withdrawn)
    const { data: wallets } = await supabaseAdmin
      .from('wallets')
      .select('referral_balance');

    const referralPayables = wallets?.reduce((sum, w) => sum + parseFloat(w.referral_balance || 0), 0) || 0;

    const totalPayables = investmentPayables + referralPayables;

    // 6. Kash Ads Stats
    const { data: kashAdsData } = await supabaseAdmin
      .from('kash_ads')
      .select('total_coins_earned, total_rewards_claimed');

    const kashAdsTotalEarned = kashAdsData?.reduce((sum, r) => sum + parseFloat(r.total_coins_earned || 0), 0) || 0;
    const kashAdsTotalClaims = kashAdsData?.reduce((sum, r) => sum + parseInt(r.total_rewards_claimed || 0), 0) || 0;
    const kashAdsParticipatingUsers = kashAdsData?.length || 0;

    // 7. Recent Users
    const { data: recentUsers } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    return res.status(200).json({
      status: 'success',
      message: 'Dashboard stats retrieved successfully',
      data: {
        users: {
          total: totalUsers,
          pro: proUsersCount,
          free: freeUsersCount
        },
        kash_ads: {
          total_earned: kashAdsTotalEarned,
          total_claims: kashAdsTotalClaims,
          users_count: kashAdsParticipatingUsers
        },
        revenue: {
          total: totalRevenue,
          breakdown: {
            pro_subscriptions: proRevenue,
            games_revenue: totalGameRevenue,
            coinflip_revenue: coinflipRevenue,
            mines_revenue: minesRevenue
          }
        },
        payables: {
          total: totalPayables,
          breakdown: {
            investments_pending: investmentPayables,
            referrals_due: referralPayables
          }
        },
        recent_users: recentUsers
      }
    });

  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    return res.status(500).json({
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
        referral_balance,
        coins_balance,
        games_balance,
        investment_balance,
        users!inner (
          username,
          user_tier
        )
      `)
      .order('referral_balance', { ascending: false })
      .limit(10);

    if (error) throw error;

    const formattedEarners = topEarners?.map((entry, index) => ({
      rank: index + 1,
      username: entry.users.username,
      user_tier: entry.users.user_tier,
      referral_balance: parseFloat(entry.referral_balance),
      other_balances: {
        coins: parseFloat(entry.coins_balance),
        games: parseFloat(entry.games_balance),
        investment: parseFloat(entry.investment_balance)
      }
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
  getAllUsers,
  getUserDetails,
  updateUserStatus,
  getUserEarningsAdmin,
  
  getPendingWithdrawals,
  processWithdrawal,
  bulkProcessWithdrawals,
  getWithdrawalStatistics,

  getKashcoinEligibleUsers,
  processKashcoinPayments,
  getKashcoinStatistics,
  
  getSettings,
  updateSetting,
  
  getDashboardStats,
  getTopEarners,
};