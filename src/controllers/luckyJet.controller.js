
const { supabaseAdmin } = require('../services/supabase.service');
const { validationResult } = require('express-validator');
const { 
  generateCrashPoint, 
  getLuckyJetSettings, 
  calculatePayout 
} = require('../utils/helpers/luckyJet.helpers');

/**
 * Get Lucky Jet game settings
 * GET /api/lucky-jet/settings
 */
const getGameSettings = async (req, res) => {
  try {
    const settings = await getLuckyJetSettings();

    return res.status(200).json({
      status: 'success',
      message: 'Lucky Jet settings retrieved successfully',
      data: { settings }
    });
  } catch (error) {
    console.error('Error getting Lucky Jet settings:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve game settings'
    });
  }
};

/**
 * Start a new Lucky Jet game round
 * POST /api/lucky-jet/start
 */
const startGame = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        data: { errors: errors.array() }
      });
    }

    const userId = req.user.id;
    const { stake_amount } = req.body;

    // Get game settings
    const settings = await getLuckyJetSettings();

    // Check if game is enabled
    if (!settings.enabled) {
      return res.status(403).json({
        status: 'error',
        message: 'Lucky Jet game is currently disabled'
      });
    }

    // Validate minimum stake
    if (stake_amount < settings.minStake) {
      return res.status(400).json({
        status: 'error',
        message: `Minimum stake amount is ₦${settings.minStake}`
      });
    }

    // Get user's gaming wallet balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('gaming_wallet')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }

    // Check if user has sufficient balance
    if (wallet.gaming_wallet < stake_amount) {
      return res.status(400).json({
        status: 'error',
        message: `Insufficient gaming wallet balance. You have ₦${wallet.gaming_wallet.toFixed(2)}`
      });
    }

    // Generate crash point
    const crashPoint = generateCrashPoint(settings.winRate, settings.maxMultiplier);

    // Deduct stake from gaming wallet
    const { error: deductError } = await supabaseAdmin
      .from('wallets')
      .update({ 
        gaming_wallet: wallet.gaming_wallet - stake_amount 
      })
      .eq('user_id', userId);

    if (deductError) {
      console.error('Error deducting stake:', deductError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to process stake'
      });
    }

    // Create game round
    const { data: round, error: roundError } = await supabaseAdmin
      .from('lucky_jet_rounds')
      .insert({
        user_id: userId,
        stake_amount: stake_amount,
        crash_point: crashPoint,
        status: 'active'
      })
      .select()
      .single();

    if (roundError) {
      console.error('Error creating round:', roundError);
      
      // Refund stake on error
      await supabaseAdmin
        .from('wallets')
        .update({ 
          gaming_wallet: wallet.gaming_wallet 
        })
        .eq('user_id', userId);

      return res.status(500).json({
        status: 'error',
        message: 'Failed to start game round'
      });
    }

    // Create transaction record
    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'gaming',
        earning_type: 'lucky_jet_stake',
        amount: -stake_amount,
        currency: 'NGN',
        status: 'completed',
        description: `Lucky Jet stake - Round ${round.id.substring(0, 8)}`,
        metadata: {
          game: 'lucky_jet',
          round_id: round.id,
          stake_amount: stake_amount
        }
      });

    // Return round details  
   return res.status(201).json({
  status: 'success',
  message: 'Game round started successfully',
  data: {
    round: {
      id: round.id,
      stake_amount: round.stake_amount,
      crash_point: round.crash_point,  
      status: round.status,
      started_at: round.started_at,
      max_multiplier: settings.maxMultiplier,
      progression_time: settings.progressionTime
    },
    new_gaming_wallet_balance: (wallet.gaming_wallet - stake_amount).toFixed(2)
      }
    });

  } catch (error) {
    console.error('Error starting Lucky Jet game:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

  
/**
 * Process game result (cashout or crash)
 * POST /api/lucky-jet/:roundId/result
 */
const processGameResult = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        data: { errors: errors.array() }
      });
    }

    const userId = req.user.id;
    const { roundId } = req.params;
    const { current_multiplier } = req.body;

    // Get round details
    const { data: round, error: roundError } = await supabaseAdmin
      .from('lucky_jet_rounds')
      .select('*')
      .eq('id', roundId)
      .eq('user_id', userId)
      .single();

    if (roundError || !round) {
      return res.status(404).json({
        status: 'error',
        message: 'Game round not found'
      });
    }

    // Check if round is still active
    if (round.status !== 'active') {
      return res.status(400).json({
        status: 'error',
        message: `Round has already ${round.status === 'cashed_out' ? 'been cashed out' : 'crashed'}`
      });
    }

    // Validate current_multiplier
    if (current_multiplier < 1.0) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid multiplier value'
      });
    }

    // Check if user won or lost
    const didWin = current_multiplier < round.crash_point;
    
    let finalStatus, payout, profitLoss, message;

    if (didWin) {
      // USER WON - Calculate payout
      const payoutCalc = calculatePayout(round.stake_amount, current_multiplier);
      payout = payoutCalc.payout;
      profitLoss = payoutCalc.profitLoss;
      finalStatus = 'cashed_out';
      message = 'Cashout successful! ';
    } else {
      // USER LOST - Game crashed
      payout = 0;
      profitLoss = -round.stake_amount;
      finalStatus = 'crashed';
      message = 'Game crashed! Better luck next time.';
    }

    // Update round status
    const { error: updateError } = await supabaseAdmin
      .from('lucky_jet_rounds')
      .update({
        cashout_multiplier: didWin ? current_multiplier : null,
        payout_amount: payout,
        profit_loss: profitLoss,
        status: finalStatus,
        ended_at: new Date().toISOString()
      })
      .eq('id', roundId);

    if (updateError) {
      console.error('Error updating round:', updateError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to process game result'
      });
    }

    // Get user's current gaming wallet balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('gaming_wallet')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      console.error('Error fetching wallet:', walletError);
      
      // Rollback round update
      await supabaseAdmin
        .from('lucky_jet_rounds')
        .update({ status: 'active', ended_at: null })
        .eq('id', roundId);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update wallet'
      });
    }

    let newBalance = parseFloat(wallet.gaming_wallet);

    // Add payout to wallet if user won
    if (didWin && payout > 0) {
      newBalance += payout;

      const { error: balanceError } = await supabaseAdmin
        .from('wallets')
        .update({ gaming_wallet: newBalance })
        .eq('user_id', userId);

      if (balanceError) {
        console.error('Error updating balance:', balanceError);
        
        // Rollback round update
        await supabaseAdmin
          .from('lucky_jet_rounds')
          .update({ 
            status: 'active',
            cashout_multiplier: null,
            payout_amount: 0,
            profit_loss: 0,
            ended_at: null 
          })
          .eq('id', roundId);
        
        return res.status(500).json({
          status: 'error',
          message: 'Failed to update wallet balance'
        });
      }
    }

    // Create transaction record
    const transactionType = didWin ? 'lucky_jet_win' : 'lucky_jet_loss';
    const transactionDesc = didWin 
      ? `Lucky Jet win - ${current_multiplier}x multiplier`
      : `Lucky Jet loss - Crashed at ${round.crash_point}x`;

    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'gaming',
        earning_type: transactionType,
        amount: didWin ? payout : -round.stake_amount,
        currency: 'NGN',
        status: 'completed',
        description: transactionDesc,
        metadata: {
          game: 'lucky_jet',
          round_id: roundId,
          stake_amount: round.stake_amount,
          crash_point: round.crash_point,
          current_multiplier: current_multiplier,
          result: didWin ? 'win' : 'loss',
          payout: payout,
          profit_loss: profitLoss
        }
      });

    // Return appropriate response
    return res.status(200).json({
      status: didWin ? 'success' : 'error',
      message: message,
      data: {
        result: didWin ? 'win' : 'loss',
        round: {
          id: round.id,
          stake_amount: round.stake_amount,
          crash_point: round.crash_point,
          cashout_multiplier: didWin ? current_multiplier : null,
          payout_amount: payout,
          profit_loss: profitLoss,
          status: finalStatus,
          ended_at: new Date().toISOString()
        },
        new_gaming_wallet_balance: newBalance.toFixed(2)
      }
    });

  } catch (error) {
    console.error('Error processing Lucky Jet game result:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

 
/**
 * Get user's Lucky Jet game history
 * GET /api/lucky-jet/history
 */
const getGameHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit) > 100 ? 100 : parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    let query = supabaseAdmin
      .from('lucky_jet_rounds')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    // Filter by status if provided
    if (status && ['active', 'cashed_out', 'crashed'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: rounds, error, count } = await query;

    if (error) {
      console.error('Error fetching game history:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve game history'
      });
    }

    const totalPages = Math.ceil(count / limitNum);

    return res.status(200).json({
      status: 'success',
      message: 'Game history retrieved successfully',
      data: {
        rounds: rounds || [],
        pagination: {
          current_page: pageNum,
          total_pages: totalPages,
          total_rounds: count,
          has_next: pageNum < totalPages,
          has_prev: pageNum > 1,
          limit: limitNum
        }
      }
    });

  } catch (error) {
    console.error('Error getting Lucky Jet history:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

/**
 * Get user's Lucky Jet statistics
 * GET /api/lucky-jet/statistics
 */
const getUserStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all rounds for the user
    const { data: rounds, error } = await supabaseAdmin
      .from('lucky_jet_rounds')
      .select('status, stake_amount, payout_amount, profit_loss')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching statistics:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve statistics'
      });
    }

    const stats = {
      total_rounds: rounds.length,
      total_wins: rounds.filter(r => r.status === 'cashed_out').length,
      total_losses: rounds.filter(r => r.status === 'crashed').length,
      active_rounds: rounds.filter(r => r.status === 'active').length,
      total_wagered: rounds.reduce((sum, r) => sum + parseFloat(r.stake_amount || 0), 0),
      total_won: rounds.reduce((sum, r) => sum + parseFloat(r.payout_amount || 0), 0),
      net_profit_loss: rounds.reduce((sum, r) => sum + parseFloat(r.profit_loss || 0), 0),
      win_rate: rounds.length > 0 
        ? ((rounds.filter(r => r.status === 'cashed_out').length / (rounds.length - rounds.filter(r => r.status === 'active').length)) * 100).toFixed(2)
        : 0
    };

    return res.status(200).json({
      status: 'success',
      message: 'Statistics retrieved successfully',
      data: { stats }
    });

  } catch (error) {
    console.error('Error getting Lucky Jet statistics:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

/**
 * Get Lucky Jet admin statistics
 * GET /api/lucky-jet/admin/statistics
 */
const getAdminStatistics = async (req, res) => {
  try {
    // Get all rounds
    const { data: allRounds, error: roundsError } = await supabaseAdmin
      .from('lucky_jet_rounds')
      .select('status, stake_amount, payout_amount, profit_loss, created_at, user_id');

    if (roundsError) {
      console.error('Error fetching rounds:', roundsError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve statistics'
      });
    }

    // Calculate time-based statistics
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter rounds by time periods
    const roundsToday = allRounds.filter(r => new Date(r.created_at) >= today);
    const roundsThisWeek = allRounds.filter(r => new Date(r.created_at) >= weekAgo);
    const roundsThisMonth = allRounds.filter(r => new Date(r.created_at) >= monthAgo);

    // Overall statistics
    const totalRounds = allRounds.length;
    const completedRounds = allRounds.filter(r => r.status !== 'active');
    const totalWins = allRounds.filter(r => r.status === 'cashed_out').length;
    const totalLosses = allRounds.filter(r => r.status === 'crashed').length;
    const activeRounds = allRounds.filter(r => r.status === 'active').length;

    // Financial statistics
    const totalWagered = allRounds.reduce((sum, r) => sum + parseFloat(r.stake_amount || 0), 0);
    const totalPaidOut = allRounds.reduce((sum, r) => sum + parseFloat(r.payout_amount || 0), 0);
    const totalProfit = allRounds.reduce((sum, r) => sum - parseFloat(r.profit_loss || 0), 0); // House profit
    const houseEdge = totalWagered > 0 ? ((totalProfit / totalWagered) * 100).toFixed(2) : 0;

    // Calculate win rate
    const winRate = completedRounds.length > 0 
      ? ((totalWins / completedRounds.length) * 100).toFixed(2)
      : 0;

    // Today's statistics
    const todayStats = {
      total_rounds: roundsToday.length,
      total_wins: roundsToday.filter(r => r.status === 'cashed_out').length,
      total_losses: roundsToday.filter(r => r.status === 'crashed').length,
      total_wagered: roundsToday.reduce((sum, r) => sum + parseFloat(r.stake_amount || 0), 0),
      total_paid_out: roundsToday.reduce((sum, r) => sum + parseFloat(r.payout_amount || 0), 0),
      house_profit: roundsToday.reduce((sum, r) => sum - parseFloat(r.profit_loss || 0), 0)
    };

    // This week's statistics
    const weekStats = {
      total_rounds: roundsThisWeek.length,
      total_wins: roundsThisWeek.filter(r => r.status === 'cashed_out').length,
      total_losses: roundsThisWeek.filter(r => r.status === 'crashed').length,
      total_wagered: roundsThisWeek.reduce((sum, r) => sum + parseFloat(r.stake_amount || 0), 0),
      total_paid_out: roundsThisWeek.reduce((sum, r) => sum + parseFloat(r.payout_amount || 0), 0),
      house_profit: roundsThisWeek.reduce((sum, r) => sum - parseFloat(r.profit_loss || 0), 0)
    };

    // This month's statistics
    const monthStats = {
      total_rounds: roundsThisMonth.length,
      total_wins: roundsThisMonth.filter(r => r.status === 'cashed_out').length,
      total_losses: roundsThisMonth.filter(r => r.status === 'crashed').length,
      total_wagered: roundsThisMonth.reduce((sum, r) => sum + parseFloat(r.stake_amount || 0), 0),
      total_paid_out: roundsThisMonth.reduce((sum, r) => sum + parseFloat(r.payout_amount || 0), 0),
      house_profit: roundsThisMonth.reduce((sum, r) => sum - parseFloat(r.profit_loss || 0), 0)
    };

    // Get unique players
    const uniquePlayers = new Set(allRounds.map(r => r.user_id)).size;
    const uniquePlayersToday = new Set(roundsToday.map(r => r.user_id)).size;

    // Top players by total wagered
    const playerWagers = {};
    allRounds.forEach(round => {
      if (!playerWagers[round.user_id]) {
        playerWagers[round.user_id] = {
          user_id: round.user_id,
          total_wagered: 0,
          total_won: 0,
          total_rounds: 0,
          wins: 0,
          losses: 0
        };
      }
      playerWagers[round.user_id].total_wagered += parseFloat(round.stake_amount || 0);
      playerWagers[round.user_id].total_won += parseFloat(round.payout_amount || 0);
      playerWagers[round.user_id].total_rounds += 1;
      
      if (round.status === 'cashed_out') playerWagers[round.user_id].wins += 1;
      if (round.status === 'crashed') playerWagers[round.user_id].losses += 1;
    });

    // Get top 10 players by wagered amount
    const topPlayerIds = Object.values(playerWagers)
      .sort((a, b) => b.total_wagered - a.total_wagered)
      .slice(0, 10)
      .map(p => p.user_id);

    // Fetch user details for top players
    let topPlayers = [];
    if (topPlayerIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, username, full_name, user_tier')
        .in('id', topPlayerIds);

      topPlayers = topPlayerIds.map(userId => {
        const user = users?.find(u => u.id === userId);
        const stats = playerWagers[userId];
        return {
          user_id: userId,
          username: user?.username || 'Unknown',
          full_name: user?.full_name || 'Unknown',
          user_tier: user?.user_tier || 'Unknown',
          total_wagered: stats.total_wagered,
          total_won: stats.total_won,
          net_profit_loss: stats.total_won - stats.total_wagered,
          total_rounds: stats.total_rounds,
          wins: stats.wins,
          losses: stats.losses,
          win_rate: stats.total_rounds > 0 ? ((stats.wins / stats.total_rounds) * 100).toFixed(2) : 0
        };
      });
    }

    // Recent big wins (top 10)
    const { data: bigWins } = await supabaseAdmin
      .from('lucky_jet_rounds')
      .select(`
        id,
        stake_amount,
        cashout_multiplier,
        payout_amount,
        profit_loss,
        created_at,
        users!lucky_jet_rounds_user_id_fkey (
          username,
          full_name,
          user_tier
        )
      `)
      .eq('status', 'cashed_out')
      .order('payout_amount', { ascending: false })
      .limit(10);

    const recentBigWins = bigWins?.map(win => ({
      round_id: win.id,
      username: win.users?.username || 'Unknown',
      full_name: win.users?.full_name || 'Unknown',
      user_tier: win.users?.user_tier || 'Unknown',
      stake_amount: win.stake_amount,
      cashout_multiplier: win.cashout_multiplier,
      payout_amount: win.payout_amount,
      profit: win.profit_loss,
      created_at: win.created_at
    })) || [];

    // Return comprehensive statistics
    return res.status(200).json({
      status: 'success',
      message: 'Admin statistics retrieved successfully',
      data: {
        overview: {
          total_rounds: totalRounds,
          total_wins: totalWins,
          total_losses: totalLosses,
          active_rounds: activeRounds,
          win_rate: parseFloat(winRate),
          unique_players: uniquePlayers,
          unique_players_today: uniquePlayersToday
        },
        financial: {
          total_wagered: parseFloat(totalWagered.toFixed(2)),
          total_paid_out: parseFloat(totalPaidOut.toFixed(2)),
          house_profit: parseFloat(totalProfit.toFixed(2)),
          house_edge_percentage: parseFloat(houseEdge)
        },
        today: todayStats,
        this_week: weekStats,
        this_month: monthStats,
        top_players: topPlayers,
        recent_big_wins: recentBigWins
      }
    });

  } catch (error) {
    console.error('Error getting Lucky Jet admin statistics:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Add to module.exports
module.exports = {
  getGameSettings,
  startGame,
  processGameResult,
  getGameHistory,
  getUserStatistics,
  getAdminStatistics  
};