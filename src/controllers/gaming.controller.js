 

const { supabaseAdmin } = require("../services/supabase.service");

// ============================================
const updateGameBalance = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount, game_type, operation, game_reference } = req.body;

    // Validate operation
    if (!['win', 'loss'].includes(operation)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid operation. Must be "win" or "loss"'
      });
    }

    // Validate amount
    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Amount must be a positive number'
      });
    }

    const gameAmount = parseFloat(amount);

 
    // Optional: Validate game_reference (unique identifier for this game session)
    if (!game_reference) {
      return res.status(400).json({
        status: 'error',
        message: 'game_reference is required'
      });
    }

    // Check for duplicate game_reference to prevent double-spending
    const { data: existingTx } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('reference', game_reference)
      .single();

    if (existingTx) {
      return res.status(409).json({
        status: 'error',
        message: 'This game result has already been processed'
      });
    }

    // Get current wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('games_balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }

    const currentBalance = parseFloat(wallet.games_balance || 0);
    let newBalance;
    let transactionType;
    let description;

    if (operation === 'win') {
      // User won - ADD to balance
      newBalance = currentBalance + gameAmount;
      transactionType = 'reward';
      description = `${game_type.replace('_', ' ')} game win - ₦${gameAmount.toLocaleString()}`;
    } else {
      // User lost - DEDUCT from balance
      if (currentBalance < gameAmount) {
        return res.status(400).json({
          status: 'error',
          message: `Insufficient games_balance. Current balance: ₦${currentBalance.toLocaleString()}`
        });
      }
      newBalance = currentBalance - gameAmount;
      transactionType = 'bet';
      description = `${game_type.replace('_', ' ')} game bet - ₦${gameAmount.toLocaleString()}`;
    }

    // Update games_balance
    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({ 
        games_balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Wallet update error:', updateError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update games balance'
      });
    }

    // Create transaction record
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: transactionType,
        balance_type: 'games_balance',
        amount: gameAmount,
        currency: 'NGN',
        status: 'completed',
        reference: game_reference,
        description: description,
        metadata: {
          game_type: game_type,
          operation: operation,
          previous_balance: currentBalance,
          new_balance: newBalance,
          timestamp: new Date().toISOString()
        }
      })
      .select()
      .single();

    if (txError) {
      console.error('Transaction creation error:', txError);
      return res.status(500).json({
        status: 'error',
        message: 'Balance updated but transaction record failed'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: `Game ${operation} recorded successfully`,
      data: {
        operation: operation,
        game_type: game_type,
        amount: gameAmount,
        previous_balance: currentBalance,
        new_balance: newBalance,
        transaction: {
          id: transaction.id,
          reference: transaction.reference,
          created_at: transaction.created_at
        }
      }
    });

  } catch (error) {
    console.error('Update game balance error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// ============================================
// 2. GET GAME TRANSACTION HISTORY
// ============================================
const getGameHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, game_type, operation } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('balance_type', 'games_balance')
      .in('transaction_type', ['reward', 'bet'])
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    // Filter by game type
    if (game_type) {
      query = query.contains('metadata', { game_type: game_type });
    }

    // Filter by operation (win/loss)
    if (operation) {
      query = query.contains('metadata', { operation: operation });
    }

    const { data: history, error, count } = await query;

    if (error) {
      console.error('Get game history error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to retrieve game history'
      });
    }

    const totalPages = Math.ceil(count / parseInt(limit));

    // Calculate statistics
    const stats = {
      total_wins: 0,
      total_losses: 0,
      total_win_amount: 0,
      total_loss_amount: 0,
      net_profit: 0
    };

    history.forEach(tx => {
      if (tx.transaction_type === 'reward') {
        stats.total_wins++;
        stats.total_win_amount += parseFloat(tx.amount);
      } else if (tx.transaction_type === 'bet') {
        stats.total_losses++;
        stats.total_loss_amount += parseFloat(tx.amount);
      }
    });

    stats.net_profit = stats.total_win_amount - stats.total_loss_amount;

    return res.status(200).json({
      status: 'success',
      message: 'Game history retrieved successfully',
      data: {
        history,
        statistics: stats,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_games: count,
          has_next: parseInt(page) < totalPages,
          has_prev: parseInt(page) > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get game history error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// ============================================
// 3. GET CURRENT GAMES BALANCE
// ============================================
const getGamesBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: wallet, error } = await supabaseAdmin
      .from('wallets')
      .select('games_balance, total_withdrawn_games')
      .eq('user_id', userId)
      .single();

    if (error || !wallet) {
      return res.status(404).json({
        status: 'error',
        message: 'Wallet not found'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Games balance retrieved successfully',
      data: {
        games_balance: parseFloat(wallet.games_balance || 0),
        total_withdrawn: parseFloat(wallet.total_withdrawn_games || 0)
      }
    });

  } catch (error) {
    console.error('Get games balance error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  updateGameBalance,
  getGameHistory,
  getGamesBalance
};