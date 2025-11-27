
const { validationResult } = require('express-validator');
const { supabaseAdmin } = require('../services/supabase.service');
const {
  generateBombPositions,
  calculatePayout,
  isValidBombCount,
  getMaxWinsForBombCount,
  generateTransactionReference,
  formatCurrency,
  validateStakeAmount
} = require('../utils/helpers/mines.helpers');

/**
 * Get Mines game settings
 * GET /api/mines/settings
 */
const getGameSettings = async (req, res) => {
  try {
    // Fetch settings from platform_settings
    const { data: settings, error } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value')
      .in('setting_key', [
        'mines_enabled',
        'mines_min_stake',
        'mines_bomb_options',
        'mines_multipliers'
      ]);

    if (error) throw error;

    // Parse settings
    const settingsMap = {};
    settings.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });

    const gameSettings = {
      enabled: settingsMap.mines_enabled === true || settingsMap.mines_enabled === 'true',
      minStake: parseFloat(settingsMap.mines_min_stake || 50),
      bombOptions: settingsMap.mines_bomb_options || [4, 6, 8, 10],
      multipliers: settingsMap.mines_multipliers || {}
    };

    return res.status(200).json({
      status: 'success',
      message: 'Mines game settings retrieved successfully',
      data: { settings: gameSettings }
    });
  } catch (error) {
    console.error('Error fetching Mines settings:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch game settings'
    });
  }
};

/**
 * Start new Mines game
 * POST /api/mines/start
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

    const { stake_amount, bomb_count } = req.body;
    const userId = req.user.id;

    // Get game settings
    const { data: settingsData } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['mines_enabled', 'mines_min_stake', 'mines_bomb_options', 'mines_multipliers']);

    const settingsMap = {};
    settingsData?.forEach(s => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    // Check if game is enabled
    if (settingsMap.mines_enabled === false || settingsMap.mines_enabled === 'false') {
      return res.status(403).json({
        status: 'error',
        message: 'Mines game is currently disabled'
      });
    }

    // Validate bomb count
    const allowedBombOptions = settingsMap.mines_bomb_options || [4, 6, 8, 10];
    if (!isValidBombCount(bomb_count, allowedBombOptions)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid bomb count. Allowed options: ${allowedBombOptions.join(', ')}`
      });
    }

    // Get multiplier config for the selected bomb count
    const multiplierConfig = settingsMap.mines_multipliers || {};
    const bombMultipliers = multiplierConfig[bomb_count.toString()];

    if (!bombMultipliers) {
      return res.status(500).json({
        status: 'error',
        message: 'Multiplier configuration not found for selected bomb count'
      });
    }

    // Get user's gaming wallet balance
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('games_balance')
      .eq('user_id', userId)
      .single();

    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }

    // Validate stake amount
    const minStake = parseFloat(settingsMap.mines_min_stake || 50);
    const validation = validateStakeAmount(stake_amount, minStake, wallet.games_balance);
    
    if (!validation.valid) {
      return res.status(400).json({
        status: 'error',
        message: validation.error
      });
    }

    // Generate bomb positions
    const bombPositions = generateBombPositions(bomb_count);

    // Deduct stake from gaming wallet
    const newBalance = parseFloat(wallet.games_balance) - parseFloat(stake_amount);
    
    const { error: walletError } = await supabaseAdmin
      .from('wallets')
      .update({ games_balance: newBalance })
      .eq('user_id', userId);

    if (walletError) throw walletError;

    // Create game round
    const { data: round, error: roundError } = await supabaseAdmin
      .from('mines_rounds')
      .insert({
        user_id: userId,
        stake_amount: stake_amount,
        bomb_count: bomb_count,
        bomb_positions: bombPositions,
        status: 'active'
      })
      .select()
      .single();

    if (roundError) {
      // Rollback: Add stake back to wallet
      await supabaseAdmin
        .from('wallets')
        .update({ games_balance: wallet.games_balance })
        .eq('user_id', userId);
      throw roundError;
    }

    // Log transaction
    await supabaseAdmin.from('transactions').insert({
      user_id: userId,
      transaction_type: 'gaming',
      earning_type: 'mines_stake',
      amount: -stake_amount,
      currency: 'NGN',
      status: 'completed',
      reference: generateTransactionReference('stake'),
      description: `Mines game stake - ${formatCurrency(stake_amount)}`,
      metadata: {
        game: 'mines',
        round_id: round.id,
        bomb_count: bomb_count,
        stake_amount: stake_amount
      }
    });

    return res.status(201).json({
      status: 'success',
      message: 'Mines game started successfully',
      data: {
        round: {
          id: round.id,
          stake_amount: round.stake_amount,
          bomb_count: round.bomb_count,
          bomb_positions: round.bomb_positions,
          status: round.status,
          started_at: round.started_at
          ,bombMultipliers
        },
        new_games_balance_balance: newBalance.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error starting Mines game:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to start game'
    });
  }
};

// src/controllers/mines.controller.js (Part 2)
// Add this to the existing controller file

/**
 * Process game result (cashout or hit bomb)
 * POST /api/mines/:roundId/result
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

    const { roundId } = req.params;
    const { successful_clicks, hit_bomb } = req.body;
    const userId = req.user.id;

    // Get round details
    const { data: round, error: roundError } = await supabaseAdmin
      .from('mines_rounds')
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
        message: `Game already ended with status: ${round.status}`
      });
    }

    // Get multiplier configuration
    const { data: multiplierSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'mines_multipliers')
      .single();

    const multiplierConfig = multiplierSetting?.setting_value || {};

    // Validate successful clicks is within allowed range
    const maxWins = getMaxWinsForBombCount(round.bomb_count, multiplierConfig);
    if (successful_clicks > maxWins) {
      return res.status(400).json({
        status: 'error',
        message: `Maximum ${maxWins} successful clicks allowed for ${round.bomb_count} bombs`
      });
    }

    // Get user's current gaming wallet
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('games_balance')
      .eq('user_id', userId)
      .single();

    if (!wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }

    let updateData = {
      successful_clicks: successful_clicks,
      ended_at: new Date().toISOString()
    };

    let newBalance = parseFloat(wallet.games_balance);
    let transactionData = {
      user_id: userId,
      transaction_type: 'gaming',
      currency: 'NGN',
      status: 'completed',
      metadata: {
        game: 'mines',
        round_id: roundId,
        bomb_count: round.bomb_count,
        successful_clicks: successful_clicks
      }
    };

    // SCENARIO 1: User hit a bomb (LOSS)
    if (hit_bomb) {
      updateData.status = 'hit_bomb';
      updateData.payout_amount = 0;
      updateData.profit_loss = -round.stake_amount;

      // Transaction for loss
      transactionData.earning_type = 'mines_loss';
      transactionData.amount = -round.stake_amount;
      transactionData.reference = generateTransactionReference('loss');
      transactionData.description = `Mines game loss - Hit bomb at ${successful_clicks} clicks`;

      // Update round
      await supabaseAdmin
        .from('mines_rounds')
        .update(updateData)
        .eq('id', roundId);

      // Log transaction
      await supabaseAdmin.from('transactions').insert(transactionData);

      return res.status(200).json({
        status: 'error',
        message: 'Game crashed! Better luck next time. 💣',
        data: {
          result: 'loss',
          round: {
            id: round.id,
            stake_amount: round.stake_amount,
            bomb_count: round.bomb_count,
            successful_clicks: successful_clicks,
            cashout_multiplier: null,
            payout_amount: 0,
            profit_loss: -round.stake_amount,
            status: 'hit_bomb',
            ended_at: updateData.ended_at
          },
          new_games_balance_balance: newBalance.toFixed(2)
        }
      });
    }

    // SCENARIO 2: User cashed out (WIN)
    // Validate user clicked at least one field
    if (successful_clicks < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Must have at least 1 successful click to cash out'
      });
    }

    // Calculate payout
    const { cashoutMultiplier, payout, profit } = calculatePayout(
      round.stake_amount,
      successful_clicks,
      round.bomb_count,
      multiplierConfig
    );

    updateData.status = 'cashed_out';
    updateData.cashout_multiplier = cashoutMultiplier;
    updateData.payout_amount = payout;
    updateData.profit_loss = profit;

    // Add payout to gaming wallet
    newBalance += payout;

    const { error: walletUpdateError } = await supabaseAdmin
      .from('wallets')
      .update({ games_balance: newBalance })
      .eq('user_id', userId);

    if (walletUpdateError) throw walletUpdateError;

    // Update round
    await supabaseAdmin
      .from('mines_rounds')
      .update(updateData)
      .eq('id', roundId);

    // Transaction for win
    transactionData.earning_type = 'mines_win';
    transactionData.amount = payout;
    transactionData.reference = generateTransactionReference('win');
    transactionData.description = `Mines game win - ${successful_clicks} successful clicks at ${cashoutMultiplier}x`;
    transactionData.metadata.cashout_multiplier = cashoutMultiplier;
    transactionData.metadata.payout = payout;
    transactionData.metadata.profit = profit;

    await supabaseAdmin.from('transactions').insert(transactionData);

    return res.status(200).json({
      status: 'success',
      message: 'Cashout successful! ',
      data: {
        result: 'win',
        round: {
          id: round.id,
          stake_amount: round.stake_amount,
          bomb_count: round.bomb_count,
          successful_clicks: successful_clicks,
          cashout_multiplier: cashoutMultiplier,
          payout_amount: payout,
          profit_loss: profit,
          status: 'cashed_out',
          ended_at: updateData.ended_at
        },
        new_games_balance_balance: newBalance.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error processing Mines game result:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process game result'
    });
  }
};

 
 
/**
 * Get user's game history
 * GET /api/mines/history
 */
const getGameHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const status = req.query.status; // optional filter
    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from('mines_rounds')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply status filter if provided
    if (status && ['active', 'cashed_out', 'hit_bomb'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: rounds, error, count } = await query;

    if (error) throw error;

    const totalPages = Math.ceil(count / limit);

    return res.status(200).json({
      status: 'success',
      message: 'Game history retrieved successfully',
      data: {
        rounds: rounds || [],
        pagination: {
          current_page: page,
          total_pages: totalPages,
          total_rounds: count,
          has_next: page < totalPages,
          has_prev: page > 1,
          limit: limit
        }
      }
    });
  } catch (error) {
    console.error('Error fetching Mines game history:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch game history'
    });
  }
};

/**
 * Get user's game statistics
 * GET /api/mines/statistics
 */
const getUserStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all user's rounds
    const { data: rounds, error } = await supabaseAdmin
      .from('mines_rounds')
      .select('status, stake_amount, payout_amount, profit_loss')
      .eq('user_id', userId);

    if (error) throw error;

    // Calculate statistics
    const stats = {
      total_rounds: rounds.length,
      total_wins: rounds.filter(r => r.status === 'cashed_out').length,
      total_losses: rounds.filter(r => r.status === 'hit_bomb').length,
      active_rounds: rounds.filter(r => r.status === 'active').length,
      total_wagered: rounds.reduce((sum, r) => sum + parseFloat(r.stake_amount), 0),
      total_won: rounds
        .filter(r => r.status === 'cashed_out')
        .reduce((sum, r) => sum + parseFloat(r.payout_amount), 0),
      net_profit_loss: rounds.reduce((sum, r) => sum + parseFloat(r.profit_loss || 0), 0)
    };

    // Calculate win rate
    const completedGames = stats.total_wins + stats.total_losses;
    stats.win_rate = completedGames > 0 
      ? ((stats.total_wins / completedGames) * 100).toFixed(2)
      : '0.00';

    return res.status(200).json({
      status: 'success',
      message: 'Statistics retrieved successfully',
      data: { stats }
    });
  } catch (error) {
    console.error('Error fetching Mines statistics:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch statistics'
    });
  }
};

/**
 * Get admin statistics for Mines game
 * GET /api/mines/admin/statistics
 */
const getAdminStatistics = async (req, res) => {
  try {
    // Get all rounds
    const { data: allRounds, error } = await supabaseAdmin
      .from('mines_rounds')
      .select(`
        id,
        user_id,
        stake_amount,
        bomb_count,
        successful_clicks,
        cashout_multiplier,
        payout_amount,
        profit_loss,
        status,
        created_at,
        users!inner (
          username,
          full_name,
          user_tier
        )
      `);

    if (error) throw error;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Filter rounds by time period
    const todayRounds = allRounds.filter(r => new Date(r.created_at) >= today);
    const weekRounds = allRounds.filter(r => new Date(r.created_at) >= weekAgo);
    const monthRounds = allRounds.filter(r => new Date(r.created_at) >= monthAgo);

    // Calculate overview statistics
    const overview = {
      total_rounds: allRounds.length,
      total_wins: allRounds.filter(r => r.status === 'cashed_out').length,
      total_losses: allRounds.filter(r => r.status === 'hit_bomb').length,
      active_rounds: allRounds.filter(r => r.status === 'active').length,
      win_rate: 0,
      unique_players: new Set(allRounds.map(r => r.user_id)).size,
      unique_players_today: new Set(todayRounds.map(r => r.user_id)).size
    };

    const completedGames = overview.total_wins + overview.total_losses;
    overview.win_rate = completedGames > 0
      ? parseFloat(((overview.total_wins / completedGames) * 100).toFixed(2))
      : 0;

    // Calculate financial statistics
    const financial = {
      total_wagered: allRounds.reduce((sum, r) => sum + parseFloat(r.stake_amount), 0),
      total_paid_out: allRounds
        .filter(r => r.status === 'cashed_out')
        .reduce((sum, r) => sum + parseFloat(r.payout_amount), 0),
      house_profit: 0,
      house_edge_percentage: 0
    };

    financial.house_profit = financial.total_wagered - financial.total_paid_out;
    financial.house_edge_percentage = financial.total_wagered > 0
      ? parseFloat(((financial.house_profit / financial.total_wagered) * 100).toFixed(2))
      : 0;

    // Helper function to calculate period stats
    const calculatePeriodStats = (rounds) => {
      const wins = rounds.filter(r => r.status === 'cashed_out');
      const losses = rounds.filter(r => r.status === 'hit_bomb');
      const wagered = rounds.reduce((sum, r) => sum + parseFloat(r.stake_amount), 0);
      const paidOut = wins.reduce((sum, r) => sum + parseFloat(r.payout_amount), 0);
      
      return {
        total_rounds: rounds.length,
        total_wins: wins.length,
        total_losses: losses.length,
        total_wagered: wagered,
        total_paid_out: paidOut,
        house_profit: wagered - paidOut
      };
    };

    // Calculate period-specific stats
    const todayStats = calculatePeriodStats(todayRounds);
    const weekStats = calculatePeriodStats(weekRounds);
    const monthStats = calculatePeriodStats(monthRounds);

    // Get top players by total wagered
    const playerStats = {};
    allRounds.forEach(round => {
      if (!playerStats[round.user_id]) {
        playerStats[round.user_id] = {
          user_id: round.user_id,
          username: round.users.username,
          full_name: round.users.full_name,
          user_tier: round.users.user_tier,
          total_wagered: 0,
          total_won: 0,
          net_profit_loss: 0,
          total_rounds: 0,
          wins: 0,
          losses: 0
        };
      }

      const stats = playerStats[round.user_id];
      stats.total_wagered += parseFloat(round.stake_amount);
      stats.total_rounds++;

      if (round.status === 'cashed_out') {
        stats.total_won += parseFloat(round.payout_amount);
        stats.wins++;
      } else if (round.status === 'hit_bomb') {
        stats.losses++;
      }

      stats.net_profit_loss += parseFloat(round.profit_loss || 0);
    });

    // Convert to array and sort by total wagered
    const topPlayers = Object.values(playerStats)
      .map(player => ({
        ...player,
        win_rate: ((player.wins / (player.wins + player.losses)) * 100).toFixed(2)
      }))
      .sort((a, b) => b.total_wagered - a.total_wagered)
      .slice(0, 10);

    // Get recent big wins (top 10 highest payouts)
    const recentBigWins = allRounds
      .filter(r => r.status === 'cashed_out')
      .sort((a, b) => parseFloat(b.payout_amount) - parseFloat(a.payout_amount))
      .slice(0, 10)
      .map(r => ({
        round_id: r.id,
        username: r.users.username,
        full_name: r.users.full_name,
        user_tier: r.users.user_tier,
        stake_amount: parseFloat(r.stake_amount),
        bomb_count: r.bomb_count,
        successful_clicks: r.successful_clicks,
        cashout_multiplier: parseFloat(r.cashout_multiplier),
        payout_amount: parseFloat(r.payout_amount),
        profit: parseFloat(r.profit_loss),
        created_at: r.created_at
      }));

    return res.status(200).json({
      status: 'success',
      message: 'Admin statistics retrieved successfully',
      data: {
        overview,
        financial,
        today: todayStats,
        this_week: weekStats,
        this_month: monthStats,
        top_players: topPlayers,
        recent_big_wins: recentBigWins
      }
    });
  } catch (error) {
    console.error('Error fetching admin statistics:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch admin statistics'
    });
  }
};

module.exports = {
  getGameSettings,
  startGame,
  processGameResult,
  getGameHistory,
  getUserStatistics,
  getAdminStatistics
};