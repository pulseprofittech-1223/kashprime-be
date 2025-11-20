const { supabaseAdmin, supabase } = require("../services/supabase.service");
const { validationResult } = require("express-validator");
const crypto = require("crypto");
const { getTimeAgo, formatPrice } = require('../utils/helpers/gaming');


 
/**
 * Get top 5 recent winners across all games
 * Returns winners from Coinflip, Lucky Jet, and Mines games
 * 
 * @route GET /api/games/top-winners
 * @access Public (or Authenticated based on your needs)
 */
const getTopRecentWinners = async (req, res) => {
  try {
    // Fetch recent winners from Coinflip game
    const { data: coinflipWinners, error: coinflipError } = await supabaseAdmin
      .from('coinflip_rounds')
      .select(`
        id,
        user_id,
        stake_amount,
        payout_amount,
        profit_loss,
        created_at,
        users!inner(username, full_name, user_tier)
      `)
      .eq('status', 'won')
      .order('created_at', { ascending: false })
      .limit(10);

    if (coinflipError) throw coinflipError;

    // Fetch recent winners from Lucky Jet game
    const { data: luckyJetWinners, error: luckyJetError } = await supabaseAdmin
      .from('lucky_jet_rounds')
      .select(`
        id,
        user_id,
        stake_amount,
        cashout_multiplier,
        payout_amount,
        profit_loss,
        created_at,
        users!inner(username, full_name, user_tier)
      `)
      .eq('status', 'cashed_out')
      .order('created_at', { ascending: false })
      .limit(10);

    if (luckyJetError) throw luckyJetError;

    // Fetch recent winners from Mines game
    const { data: minesWinners, error: minesError } = await supabaseAdmin
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
        created_at,
        users!inner(username, full_name, user_tier)
      `)
      .eq('status', 'cashed_out')
      .order('created_at', { ascending: false })
      .limit(10);

    if (minesError) throw minesError;

    // Transform and combine all winners with game info
    const allWinners = [
      ...(coinflipWinners || []).map(w => ({
        id: w.id,
        username: w.users?.username || 'Unknown',
        full_name: w.users?.full_name || 'Unknown Player',
        user_tier: w.users?.user_tier || 'Amateur',
        game: 'Coinflip',
        stake_amount: parseFloat(w.stake_amount),
        payout_amount: parseFloat(w.payout_amount),
        profit: parseFloat(w.profit_loss),
        multiplier: w.payout_amount > 0 ? (parseFloat(w.payout_amount) / parseFloat(w.stake_amount)).toFixed(2) : '0.00',
        created_at: w.created_at,
        game_details: {
          result: 'Won'
        }
      })),
      ...(luckyJetWinners || []).map(w => ({
        id: w.id,
        username: w.users?.username || 'Unknown',
        full_name: w.users?.full_name || 'Unknown Player',
        user_tier: w.users?.user_tier || 'Amateur',
        game: 'Lucky Jet',
        stake_amount: parseFloat(w.stake_amount),
        payout_amount: parseFloat(w.payout_amount),
        profit: parseFloat(w.profit_loss),
        multiplier: w.cashout_multiplier ? parseFloat(w.cashout_multiplier).toFixed(2) : '0.00',
        created_at: w.created_at,
        game_details: {
          cashout_at: `${w.cashout_multiplier}x`
        }
      })),
      ...(minesWinners || []).map(w => ({
        id: w.id,
        username: w.users?.username || 'Unknown',
        full_name: w.users?.full_name || 'Unknown Player',
        user_tier: w.users?.user_tier || 'Amateur',
        game: 'Mines',
        stake_amount: parseFloat(w.stake_amount),
        payout_amount: parseFloat(w.payout_amount),
        profit: parseFloat(w.profit_loss),
        multiplier: w.cashout_multiplier ? parseFloat(w.cashout_multiplier).toFixed(2) : '0.00',
        created_at: w.created_at,
        game_details: {
          bombs: w.bomb_count,
          safe_clicks: w.successful_clicks,
          cashout_at: `${w.cashout_multiplier}x`
        }
      }))
    ];

    // Sort by created_at descending and get top 5
    const topWinners = allWinners
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 5)
      .map(winner => ({
        ...winner,
        stake_amount: winner.stake_amount.toLocaleString('en-NG', { 
          style: 'currency', 
          currency: 'NGN',
          minimumFractionDigits: 2 
        }),
        payout_amount: winner.payout_amount.toLocaleString('en-NG', { 
          style: 'currency', 
          currency: 'NGN',
          minimumFractionDigits: 2 
        }),
        profit: winner.profit.toLocaleString('en-NG', { 
          style: 'currency', 
          currency: 'NGN',
          minimumFractionDigits: 2 
        }),
        time_ago: getTimeAgo(winner.created_at)
      }));

    return res.status(200).json({
      status: 'success',
      message: 'Top 5 recent winners retrieved successfully',
      data: {
        winners: topWinners,
        total_found: allWinners.length
      }
    });

  } catch (error) {
    console.error('Error fetching top winners:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve top winners',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};





// Generate gaming codes for merchants (Admin only)
const generateGamingCodes = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        data: { errors: errors.array() },
      });
    }

    const { merchantUsername, quantity, amount } = req.body;
    const adminId = req.user.id;

    

    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized. Admin access required.",
      });
    }

    // Validate quantity limit
    if (quantity > 50) {
      return res.status(400).json({
        status: "error",
        message: "Maximum 50 codes can be generated at once",
      });
    }

    // Validate amount
    if (amount < 100 || amount > 100000) {
      return res.status(400).json({
        status: "error",
        message: "Amount must be between ₦100 and ₦100,000",
      });
    }

    // Verify merchant exists
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("users")
      .select("id, username, role, full_name, can_sell_games_codes")
      .eq("username", merchantUsername)
      .eq("role", "merchant")
      .single();


    if (merchantError || !merchant) {
      return res.status(404).json({
        status: "error",
        message: "Merchant not found or invalid role",
      });
    }

    if (!merchant.can_sell_games_codes) {
  return res.status(403).json({
    status: "error",
    message: "This merchant is not authorized to sell codes",
  });
}

    // Generate codes with GM- prefix (Gaming)
    const codes = [];
    const usernamePrefix = merchant.username.slice(0, 4).toUpperCase();

    for (let i = 0; i < quantity; i++) {
      const randomCode = crypto.randomBytes(6).toString("hex").toUpperCase();
      const gamingCode = `GM-${usernamePrefix}-${randomCode}`;

      codes.push({
        code: gamingCode,
        amount: amount,
        is_used: false,
        used_by: null,
        created_by: adminId,
        merchant_id: merchant.id,
        created_at: new Date().toISOString(),
      });
    }

    // Insert codes into database
    const { error: insertError } = await supabaseAdmin
      .from("gaming_codes")
      .insert(codes);

    if (insertError) {
      console.error("Error inserting gaming codes:", insertError);
      return res.status(500).json({
        status: "error",
        message: "Failed to generate gaming codes",
      });
    }

    // Log code generation activity
    await supabaseAdmin.from("admin_activities").insert({
      admin_id: adminId,
      activity_type: "gaming_codes_generated",
      description: `Generated ${quantity} gaming codes worth ${formatPrice(amount)} each for merchant ${merchant.username}`,
      metadata: {
        merchant_id: merchant.id,
        merchant_username: merchant.username,
        quantity: quantity,
        amount_per_code: amount,
        total_value: amount * quantity,
      },
      created_at: new Date().toISOString(),
    });

    res.status(201).json({
      status: "success",
      message: `${quantity} gaming codes generated successfully`,
      data: {
        codesGenerated: quantity,
        amountPerCode: formatPrice(amount),
        totalValue: formatPrice(amount * quantity),
        merchant: {
          id: merchant.id,
          username: merchant.username,
          fullName: merchant.full_name,
        },
        codes: codes.map((code) => ({
          code: code.code,
          amount: formatPrice(amount),
          merchantUsername: merchant.username,
        })),
      },
    });
  } catch (error) {
    console.error("Generate gaming codes error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Validate gaming code (Public endpoint)
const validateGamingCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        data: { errors: errors.array() },
      });
    }

    const { code } = req.body;

    const { data: gamingCode, error } = await supabaseAdmin
      .from("gaming_codes")
      .select(`
        id,
        code,
        amount,
        is_used,
        used_by,
        created_at,
        used_at,
        users!gaming_codes_used_by_fkey(username, full_name),
        merchant:users!gaming_codes_merchant_id_fkey(id, username, full_name)
      `)
      .eq("code", code.toUpperCase())
      .single();

    if (error || !gamingCode) {
      return res.status(404).json({
        status: "error",
        message: "Gaming code does not exist",
      });
    }

    if (gamingCode.is_used) {
      return res.status(400).json({
        status: "error",
        message: "Gaming code has already been redeemed",
        data: {
          usedBy: gamingCode.users?.username || "Unknown",
          usedAt: gamingCode.used_at,
          amount: formatPrice(gamingCode.amount),
          merchant: {
            username: gamingCode.merchant?.username || "Unknown",
            fullName: gamingCode.merchant?.full_name || "Unknown",
          },
        },
      });
    }

    res.json({
      status: "success",
      message: "Gaming code is valid",
      data: {
        code: gamingCode.code,
        amount: formatPrice(gamingCode.amount),
        merchant: {
          username: gamingCode.merchant?.username || "Unknown",
          fullName: gamingCode.merchant?.full_name || "Unknown",
        },
        isValid: true,
      },
    });
  } catch (error) {
    console.error("Validate gaming code error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Redeem gaming code (Authenticated users)
const redeemGamingCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        data: { errors: errors.array() },
      });
    }

    const { code } = req.body;
    const userId = req.user.id;

    // Check if gaming code exists and is unused
    const { data: gamingCode, error: codeError } = await supabaseAdmin
      .from("gaming_codes")
      .select("*")
      .eq("code", code.toUpperCase())
      .single();

    if (codeError || !gamingCode) {
      return res.status(404).json({
        status: "error",
        message: "Gaming code does not exist",
      });
    }

    if (gamingCode.is_used) {
      return res.status(400).json({
        status: "error",
        message: "Gaming code has already been redeemed",
      });
    }

    // Update user's gaming wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .update({
        gaming_wallet: supabaseAdmin.rpc("increment_gaming_wallet", {
          p_user_id: userId,
          p_amount: gamingCode.amount,
        }),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select("gaming_wallet")
      .single();

    if (walletError) {
      // Try direct increment
      const { data: currentWallet } = await supabaseAdmin
        .from("wallets")
        .select("gaming_wallet")
        .eq("user_id", userId)
        .single();

      const newBalance = parseFloat(currentWallet?.gaming_wallet || 0) + parseFloat(gamingCode.amount);

      const { error: updateError } = await supabaseAdmin
        .from("wallets")
        .update({
          gaming_wallet: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Wallet update error:", updateError);
        return res.status(500).json({
          status: "error",
          message: "Failed to update gaming wallet",
        });
      }
    }

    // Mark code as used
    const { error: markError } = await supabaseAdmin
      .from("gaming_codes")
      .update({
        is_used: true,
        used_by: userId,
        used_at: new Date().toISOString(),
      })
      .eq("id", gamingCode.id);

    if (markError) {
      console.error("Error marking code as used:", markError);
    }

    // Log transaction
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      transaction_type: "deposit",
      earning_type: "gaming_code_redemption",
      amount: gamingCode.amount,
      status: "completed",
      description: `Gaming wallet credited via code: ${gamingCode.code}`,
      reference: `GMCODE-${Date.now()}`,
      created_at: new Date().toISOString(),
    });

    // Get updated wallet balance
    const { data: updatedWallet } = await supabaseAdmin
      .from("wallets")
      .select("gaming_wallet")
      .eq("user_id", userId)
      .single();

    res.status(200).json({
      status: "success",
      message: `Gaming code redeemed successfully! ${formatPrice(gamingCode.amount)} added to your gaming wallet`,
      data: {
        amount_credited: formatPrice(gamingCode.amount),
        new_gaming_wallet_balance: formatPrice(updatedWallet?.gaming_wallet || 0),
        code: gamingCode.code,
        redeemed_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Redeem gaming code error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Get merchant's gaming codes (Merchant only)
const getMerchantGamingCodes = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("gaming_codes")
      .select(
        `
        id,
        code,
        amount,
        is_used,
        created_at,
        used_at,
        users!gaming_codes_used_by_fkey(username, full_name)
      `,
        { count: "exact" }
      )
      .eq("merchant_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status === "used") {
      query = query.eq("is_used", true);
    } else if (status === "unused") {
      query = query.eq("is_used", false);
    }

    const { data: codes, error, count } = await query;

    if (error) {
      console.error("Error fetching merchant gaming codes:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch gaming codes",
      });
    }

    // Get total stats for this merchant
    const { data: totalStats } = await supabaseAdmin.rpc(
      "get_merchant_gaming_stats_with_revenue",
      {
        p_merchant_id: req.user.id,
      }
    );

    // Format codes
    const formattedCodes = codes.map((code) => ({
      ...code,
      amount: formatPrice(code.amount),
      usedBy: code.users?.username || null,
      usedByFullName: code.users?.full_name || null,
    }));

    res.json({
      status: "success",
      message: "Gaming codes retrieved successfully",
      data: {
        codes: formattedCodes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        },
        statistics: {
          total_codes: totalStats?.[0]?.total_codes || 0,
          used_codes: totalStats?.[0]?.used_codes || 0,
          unused_codes: totalStats?.[0]?.unused_codes || 0,
          total_value: formatPrice(totalStats?.[0]?.total_value || 0),
          redeemed_value: formatPrice(totalStats?.[0]?.redeemed_value || 0),
        },
      },
    });
  } catch (error) {
    console.error("Get merchant gaming codes error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Get gaming codes statistics (Admin only)
const getGamingCodesStatistics = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized. Admin access required.",
      });
    }

    const { data: statistics, error } = await supabaseAdmin.rpc(
      "get_merchant_gaming_code_stats"
    );

    if (error) {
      console.error("Error fetching gaming code statistics:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch statistics",
      });
    }

    // Format the statistics
    const formattedStats = statistics.map((stat) => ({
      ...stat,
      total_value: formatPrice(stat.total_value || 0),
      redeemed_value: formatPrice(stat.redeemed_value || 0),
      unredeemed_value: formatPrice(stat.unredeemed_value || 0),
    }));

    res.json({
      status: "success",
      message: "Gaming code statistics retrieved successfully",
      data: { statistics: formattedStats },
    });
  } catch (error) {
    console.error("Get gaming code statistics error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Bulk delete unused gaming codes (Admin only)
const bulkDeleteUnusedGamingCodes = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized. Admin access required.",
      });
    }

    const { merchantId } = req.body;

    let query = supabaseAdmin
      .from("gaming_codes")
      .delete()
      .eq("is_used", false);

    if (merchantId) {
      query = query.eq("merchant_id", merchantId);
    }

    const { data, error } = await query.select("id");

    if (error) {
      console.error("Error deleting gaming codes:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to delete gaming codes",
      });
    }

    res.json({
      status: "success",
      message: "Unused gaming codes deleted successfully",
      data: { deletedCount: data?.length || 0 },
    });
  } catch (error) {
    console.error("Bulk delete gaming codes error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};


// Get all gaming codes (Admin only)
const getAllGamingCodes = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized. Admin access required.",
      });
    }

    const { 
      page = 1, 
      limit = 20, 
      status, 
      merchantId, 
      search 
    } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("gaming_codes")
      .select(
        `
        id,
        code,
        amount,
        is_used,
        created_at,
        used_at,
        merchant:users!gaming_codes_merchant_id_fkey(id, username, full_name),
        user:users!gaming_codes_used_by_fkey(id, username, full_name)
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status === "used") {
      query = query.eq("is_used", true);
    } else if (status === "unused") {
      query = query.eq("is_used", false);
    }

    // Filter by merchant
    if (merchantId) {
      query = query.eq("merchant_id", merchantId);
    }

    // Search by code
    if (search) {
      query = query.ilike("code", `%${search}%`);
    }

    const { data: codes, error, count } = await query;

    if (error) {
      console.error("Error fetching gaming codes:", error);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch gaming codes",
      });
    }

    // Get overall statistics
    const { data: overallStats } = await supabaseAdmin
      .from("gaming_codes")
      .select("amount, is_used");

    const totalCodes = overallStats?.length || 0;
    const usedCodes = overallStats?.filter(c => c.is_used).length || 0;
    const unusedCodes = totalCodes - usedCodes;
    const totalValue = overallStats?.reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0;
    const redeemedValue = overallStats?.filter(c => c.is_used).reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0;

    // Format codes
    const formattedCodes = codes.map((code) => ({
      id: code.id,
      code: code.code,
      amount: formatPrice(code.amount),
      is_used: code.is_used,
      created_at: code.created_at,
      used_at: code.used_at,
      merchant: {
        id: code.merchant?.id,
        username: code.merchant?.username,
        fullName: code.merchant?.full_name,
      },
      used_by: code.user ? {
        id: code.user.id,
        username: code.user.username,
        fullName: code.user.full_name,
      } : null,
    }));

    res.json({
      status: "success",
      message: "Gaming codes retrieved successfully",
      data: {
        codes: formattedCodes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit),
        },
        statistics: {
          total_codes: totalCodes,
          used_codes: usedCodes,
          unused_codes: unusedCodes,
          total_value: formatPrice(totalValue),
          redeemed_value: formatPrice(redeemedValue),
          unredeemed_value: formatPrice(totalValue - redeemedValue),
        },
      },
    });
  } catch (error) {
    console.error("Get all gaming codes error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};


// Set merchant code selling permission (Admin only)
const setMerchantGamesCodeSellingPermission = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: "Validation error",
        data: { errors: errors.array() },
      });
    }

    const { merchantUsername, canSellCodes } = req.body;
    const adminId = req.user.id;

    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized. Admin access required.",
      });
    }

    // Verify merchant exists
    const { data: merchant, error: merchantError } = await supabase
      .from("users")
      .select("id, username, role, full_name, can_sell_games_codes")
      .eq("username", merchantUsername)
      .eq("role", "merchant")
      .single();

    if (merchantError || !merchant) {
      return res.status(404).json({
        status: "error",
        message: "Merchant not found or invalid role",
      });
    }

    // Update merchant's code selling permission
    const { error: updateError } = await supabase
      .from("users")
      .update({ 
        can_sell_games_codes: canSellCodes,
        updated_at: new Date().toISOString()
      })
      .eq("id", merchant.id);

    if (updateError) {
      console.error("Error updating merchant permission:", updateError);
      return res.status(500).json({
        status: "error",
        message: "Failed to update merchant permission",
      });
    }

    // Log admin activity
    await supabase.from("admin_activities").insert({
      admin_id: adminId,
      activity_type: "merchant_permission_updated",
      description: `${canSellCodes ? 'Enabled' : 'Disabled'} code selling permission for merchant ${merchant.username}`,
      metadata: {
        merchant_id: merchant.id,
        merchant_username: merchant.username,
        previous_permission: merchant.can_sell_games_codes,
        new_permission: canSellCodes,
      },
      created_at: new Date().toISOString(),
    });

    res.status(200).json({
      status: "success",
      message: `Code selling permission ${canSellCodes ? 'enabled' : 'disabled'} for merchant ${merchant.username}`,
      data: {
        merchant: {
          id: merchant.id,
          username: merchant.username,
          fullName: merchant.full_name,
          canSellCodes: canSellCodes,
          previousPermission: merchant.can_sell_games_codes
        }
      },
    });
  } catch (error) {
    console.error("Set merchant permission error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

// Get merchants who can sell Games codes (Admin only)
const getGamesCodeSellingMerchants = async (req, res) => {
  try {
    const adminId = req.user.id;

    // Verify admin role
    if (req.user.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message: "Unauthorized. Admin access required.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const canSellGamesCodes = req.query.canSellCodes; // 'true', 'false', or undefined for all
    const search = req.query.search || '';

    const offset = (page - 1) * limit;

    // Build query for merchants
    let query = supabase
      .from("users")
      .select(`
        id,
        username,
        full_name,
        email,
        can_sell_games_codes,
        created_at,
        updated_at
      `)
      .eq("role", "merchant")
      .order("created_at", { ascending: false });

    // Filter by games codes permission if specified
    if (canSellGamesCodes !== undefined) {
      query = query.eq("can_sell_games_codes", canSellGamesCodes === 'true');
    }

    // Add search functionality
    if (search) {
      query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Get total count for pagination (considering filters)
    let countQuery = supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role", "merchant");

    // Apply same filters to count query
    if (canSellGamesCodes !== undefined) {
      countQuery = countQuery.eq("can_sell_games_codes", canSellGamesCodes === 'true');
    }

    if (search) {
      countQuery = countQuery.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error("Error getting merchant count:", countError);
      return res.status(500).json({
        status: "error",
        message: "Failed to get merchant count",
      });
    }

    // Get paginated results
    const { data: merchants, error: fetchError } = await query
      .range(offset, offset + limit - 1);

    if (fetchError) {
      console.error("Error fetching merchants:", fetchError);
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch merchants",
      });
    }

    // Get gaming code statistics for each merchant
    const merchantsWithStats = await Promise.all(
      merchants.map(async (merchant) => {
        const { data: gamingCodeStats } = await supabase
          .from("gaming_codes")
          .select("code, amount, is_used, created_at, used_at")
          .eq("merchant_id", merchant.id);

        // Calculate total value of codes
        const totalValue = gamingCodeStats?.reduce((sum, code) => sum + parseFloat(code.amount), 0) || 0;
        const usedValue = gamingCodeStats?.filter(code => code.is_used)
          .reduce((sum, code) => sum + parseFloat(code.amount), 0) || 0;
        const unusedValue = gamingCodeStats?.filter(code => !code.is_used)
          .reduce((sum, code) => sum + parseFloat(code.amount), 0) || 0;

        const stats = {
          totalGamingCodes: gamingCodeStats?.length || 0,
          usedGamingCodes: gamingCodeStats?.filter(code => code.is_used).length || 0,
          unusedGamingCodes: gamingCodeStats?.filter(code => !code.is_used).length || 0,
          totalValue: totalValue,
          usedValue: usedValue,
          unusedValue: unusedValue,
          averageCodeValue: gamingCodeStats?.length > 0 ? totalValue / gamingCodeStats.length : 0,
          // Recent activity (codes created in last 30 days)
          recentCodes: gamingCodeStats?.filter(code => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return new Date(code.created_at) > thirtyDaysAgo;
          }).length || 0
        };

        return {
          ...merchant,
          gamingCodeStats: stats
        };
      })
    );

    const totalPages = Math.ceil(count / limit);

    // Calculate summary statistics
    const totalGamingCodes = merchantsWithStats.reduce((sum, merchant) => 
      sum + merchant.gamingCodeStats.totalGamingCodes, 0);
    const totalUsedGamingCodes = merchantsWithStats.reduce((sum, merchant) => 
      sum + merchant.gamingCodeStats.usedGamingCodes, 0);
    const totalGamingValue = merchantsWithStats.reduce((sum, merchant) => 
      sum + merchant.gamingCodeStats.totalValue, 0);

    res.status(200).json({
      status: "success",
      message: "Gaming code selling merchants fetched successfully",
      data: {
        merchants: merchantsWithStats,
        pagination: {
          currentPage: page,
          totalPages,
          totalMerchants: count,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        filters: {
          canSellGamesCodes,
          search
        },
        summary: {
          totalMerchantsWithGamingCodeAccess: merchantsWithStats.filter(m => m.can_sell_games_codes).length,
          totalMerchantsWithoutGamingCodeAccess: merchantsWithStats.filter(m => !m.can_sell_games_codes).length,
          totalGamingCodes,
          totalUsedGamingCodes,
          totalUnusedGamingCodes: totalGamingCodes - totalUsedGamingCodes,
          totalGamingValue: parseFloat(totalGamingValue.toFixed(2)),
          averageCodesPerMerchant: count > 0 ? Math.round(totalGamingCodes / count) : 0
        }
      },
    });
  } catch (error) {
    console.error("Get gaming code selling merchants error:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};



 


module.exports = {
  getTopRecentWinners,  generateGamingCodes,
  validateGamingCode,
  redeemGamingCode,
  getMerchantGamingCodes,
  getGamingCodesStatistics,
  bulkDeleteUnusedGamingCodes,getAllGamingCodes, getGamesCodeSellingMerchants, setMerchantGamesCodeSellingPermission
};