const { sendEmail } = require('../services/email/sendEmail');
const { supabaseAdmin } = require('../services/supabase.service');

/**
 * Get platform setting value
 */
const getPlatformSetting = async (key, defaultValue = null) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', key)
      .single();

    if (error || !data) return defaultValue;
    return data.setting_value;
  } catch (error) {
    console.error(`Error fetching setting ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Check if raffle is enabled
 */
const isRaffleEnabled = async () => {
  const enabled = await getPlatformSetting('raffle_enabled', 'true');
  return enabled === 'true' || enabled === true;
};

/**
 * USER: Purchase raffle ticket
 * POST /api/raffle/purchase
 */
const purchaseTicket = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if raffle is enabled
    const raffleEnabled = await isRaffleEnabled();
    if (!raffleEnabled) {
      return res.status(403).json({
        status: 'error',
        message: 'Raffle feature is currently disabled'
      });
    }

    // Get settings
    const ticketPrice = parseFloat(await getPlatformSetting('raffle_ticket_price', '100'));
    const maxTicketsPerDay = parseInt(await getPlatformSetting('raffle_max_tickets_per_day', '3'));

    // Check how many tickets user already purchased today
    const { data: existingTickets, error: countError } = await supabaseAdmin
      .from('raffle_tickets')
      .select('id')
      .eq('user_id', userId)
      .eq('draw_date', new Date().toISOString().split('T')[0]);

    if (countError) throw countError;

    const ticketCount = existingTickets?.length || 0;
    if (ticketCount >= maxTicketsPerDay) {
      return res.status(400).json({
        status: 'error',
        message: `You have reached the daily limit of ${maxTicketsPerDay} tickets`
      });
    }

    // Check user's VOXcoin balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('voxcoin_balance')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;

    if (wallet.voxcoin_balance < ticketPrice) {
      return res.status(400).json({
        status: 'error',
        message: `Insufficient VOXcoin balance. You need ₦${ticketPrice} VOXcoin to purchase a ticket`
      });
    }

    // Generate ticket number and lucky number
    const { data: ticketNumber, error: ticketNumError } = await supabaseAdmin
      .rpc('generate_ticket_number');

    if (ticketNumError) throw ticketNumError;

    const { data: luckyNumber, error: luckyNumError } = await supabaseAdmin
      .rpc('generate_lucky_number');

    if (luckyNumError) throw luckyNumError;

    // Deduct VOXcoin from user's balance
    const { error: deductError } = await supabaseAdmin
      .from('wallets')
      .update({
        voxcoin_balance: wallet.voxcoin_balance - ticketPrice,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (deductError) throw deductError;

    // Create raffle ticket
    const { data: newTicket, error: ticketError } = await supabaseAdmin
      .from('raffle_tickets')
      .insert({
        user_id: userId,
        ticket_number: ticketNumber,
        lucky_number: luckyNumber,
        draw_date: new Date().toISOString().split('T')[0]
      })
      .select('*')
      .single();

    if (ticketError) throw ticketError;

    // Create transaction record
    const transactionRef = `RAFFLE-PURCHASE-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'purchase',
        earning_type: 'raffle_ticket',
        amount: -ticketPrice, // Negative for deduction
        currency: 'NGN',
        status: 'completed',
        reference: transactionRef,
        description: `Raffle ticket purchase - Ticket #${ticketNumber}`,
        metadata: {
          wallet_type: 'voxcoin',
          ticket_number: ticketNumber,
          lucky_number: luckyNumber,
          draw_date: newTicket.draw_date
        }
      });

    // Get updated balance
    const { data: updatedWallet } = await supabaseAdmin
      .from('wallets')
      .select('voxcoin_balance')
      .eq('user_id', userId)
      .single();

    return res.status(201).json({
      status: 'success',
      message: 'Raffle ticket purchased successfully',
      data: {
        ticket: {
          id: newTicket.id,
          ticket_number: newTicket.ticket_number,
          lucky_number: newTicket.lucky_number,
          draw_date: newTicket.draw_date,
          purchase_time: newTicket.purchase_time
        },
        new_voxcoin_balance: updatedWallet.voxcoin_balance,
        tickets_remaining_today: maxTicketsPerDay - (ticketCount + 1)
      }
    });

  } catch (error) {
    console.error('Error purchasing raffle ticket:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to purchase raffle ticket'
    });
  }
};

/**
 * USER: Get user's tickets for today
 * GET /api/raffle/my-tickets
 */
const getMyTickets = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    const { data: tickets, error } = await supabaseAdmin
      .from('raffle_tickets')
      .select('*')
      .eq('user_id', userId)
      .eq('draw_date', today)
      .order('purchase_time', { ascending: false });

    if (error) throw error;

    // Get max tickets setting
    const maxTicketsPerDay = parseInt(await getPlatformSetting('raffle_max_tickets_per_day', '3'));

    return res.json({
      status: 'success',
      message: 'Your tickets retrieved successfully',
      data: {
        tickets: tickets || [],
        tickets_purchased: tickets?.length || 0,
        tickets_remaining: maxTicketsPerDay - (tickets?.length || 0)
      }
    });

  } catch (error) {
    console.error('Error fetching user tickets:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch your tickets'
    });
  }
};

/**
 * USER: Get raffle dashboard data
 * GET /api/raffle/dashboard
 */
const getRaffleDashboard = async (req, res) => {
  try {
    const raffleEnabled = await isRaffleEnabled();
    
    if (!raffleEnabled) {
      return res.status(403).json({
        status: 'error',
        message: 'Raffle feature is currently disabled'
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Get top 10 recent ticket purchases (from all users)
    const { data: recentEntries, error: entriesError } = await supabaseAdmin
      .from('raffle_tickets')
      .select(`
        purchase_time,
        users!inner (
          username,
          user_tier
        )
      `)
      .eq('draw_date', today)
      .order('purchase_time', { ascending: false })
      .limit(10);

    if (entriesError) throw entriesError;

    // Get last 3 winners (completed draws)
    const { data: pastWinners, error: winnersError } = await supabaseAdmin
      .from('raffle_draws')
      .select('*')
      .eq('status', 'completed')
      .lt('draw_date', today)
      .order('draw_date', { ascending: false })
      .limit(3);

    if (winnersError) throw winnersError;

    // Format past winners with actual winner details
    const formattedWinners = await Promise.all(
      (pastWinners || []).map(async (draw) => {
        if (draw.admin_action === 'no_winner') {
          return {
            draw_date: draw.draw_date,
            winning_digit: draw.fake_winner_digit,
            winner_username: draw.fake_winner_username,
            ticket_number: draw.fake_winner_ticket,
            is_fake: true
          };
        }

        // Get actual winners
        const { data: winners } = await supabaseAdmin
          .from('raffle_tickets')
          .select(`
            ticket_number,
            lucky_number,
            reward_amount,
            users!inner (username, user_tier)
          `)
          .eq('draw_date', draw.draw_date)
          .eq('is_winner', true)
          .limit(3); // Show max 3 winners

        return {
          draw_date: draw.draw_date,
          winning_digits: draw.final_winning_numbers,
          winners: winners || [],
          total_winners: draw.final_winner_count,
          is_fake: false
        };
      })
    );

    // Get today's draw status
    const { data: todayDraw } = await supabaseAdmin
      .from('raffle_draws')
      .select('*')
      .eq('draw_date', today)
      .single();

    // Calculate time until draw
    const drawTime = await getPlatformSetting('raffle_draw_time', '20:00');
    const [drawHour, drawMinute] = drawTime.split(':').map(Number);
    const now = new Date();
    const drawDateTime = new Date(now);
    drawDateTime.setHours(drawHour, drawMinute, 0, 0);

    let timeUntilDraw = null;
    let drawStatus = 'pending';

    if (now < drawDateTime) {
      const diff = drawDateTime - now;
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      timeUntilDraw = `${hours}h ${minutes}m`;
      drawStatus = 'pending';
    } else if (todayDraw?.status === 'in_progress') {
      drawStatus = 'in_progress';
    } else if (todayDraw?.status === 'completed' || todayDraw?.status === 'no_winner') {
      drawStatus = 'completed';
    }

    return res.json({
      status: 'success',
      message: 'Raffle dashboard data retrieved successfully',
      data: {
        recent_entries: recentEntries?.map(entry => ({
          username: entry.users.username,
          user_tier: entry.users.user_tier,
          purchase_time: entry.purchase_time
        })) || [],
        past_winners: formattedWinners,
        draw_info: {
          draw_time: drawTime,
          time_until_draw: timeUntilDraw,
          status: drawStatus,
          draw_date: today
        }
      }
    });

  } catch (error) {
    console.error('Error fetching raffle dashboard:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch raffle dashboard data'
    });
  }
};

/**
 * USER: Get today's draw results
 * GET /api/raffle/results
 */
const getDrawResults = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: draw, error } = await supabaseAdmin
      .from('raffle_draws')
      .select('*')
      .eq('draw_date', today)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!draw) {
      return res.json({
        status: 'success',
        message: 'No draw for today yet',
        data: {
          status: 'no_draw',
          message: 'Draw has not been initiated yet'
        }
      });
    }

    // Check time - is it past 8 PM?
    const drawTime = await getPlatformSetting('raffle_draw_time', '20:00');
    const [drawHour] = drawTime.split(':').map(Number);
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour < drawHour) {
      return res.json({
        status: 'success',
        message: 'Draw has not started yet',
        data: {
          status: 'pending',
          message: `Draw starts at ${drawTime}`,
          draw_time: drawTime
        }
      });
    }

// Draw is in progress or completed
    if (draw.status === 'in_progress') {
      return res.json({
        status: 'success',
        message: 'Draw results are being processed',
        data: {
          status: 'in_progress',
          message: '🔄 Hold on, we are still collating results...'
        }
      });
    }

    if (draw.status === 'completed' || draw.status === 'no_winner') {
      // Check if it's a fake winner (no actual winner)
      if (draw.admin_action === 'no_winner') {
        return res.json({
          status: 'success',
          message: 'Draw results announced',
          data: {
            status: 'completed',
            winning_digit: draw.fake_winner_digit,
            winner_username: draw.fake_winner_username,
            ticket_number: draw.fake_winner_ticket,
            is_real_winner: false,
            message: 'Better luck next time! 🍀',
            draw_date: draw.draw_date
          }
        });
      }

      // Get actual winners
      const { data: winners, error: winnersError } = await supabaseAdmin
        .from('raffle_tickets')
        .select(`
          ticket_number,
          lucky_number,
          reward_amount,
          users!inner (
            username,
            user_tier
          )
        `)
        .eq('draw_date', today)
        .eq('is_winner', true)
        .order('purchase_time', { ascending: true });

      if (winnersError) throw winnersError;

      return res.json({
        status: 'success',
        message: 'Draw results announced',
        data: {
          status: 'completed',
          winning_digits: draw.final_winning_numbers,
          winners: winners?.map(w => ({
            username: w.users.username,
            user_tier: w.users.user_tier,
            ticket_number: w.ticket_number,
            lucky_number: w.lucky_number,
            reward_amount: w.reward_amount
          })) || [],
          total_winners: draw.final_winner_count,
          total_rewards_paid: draw.total_rewards_paid,
          is_real_winner: true,
          draw_date: draw.draw_date
        }
      });
    }

    return res.json({
      status: 'success',
      message: 'Draw status retrieved',
      data: {
        status: draw.status,
        message: 'Draw processing...'
      }
    });

  } catch (error) {
    console.error('Error fetching draw results:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch draw results'
    });
  }
};

/**
 * ADMIN: Get draw overview for today
 * GET /api/raffle/admin/draw-overview
 */
 
const getAdminDrawOverview = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Get reward settings upfront
    const rewardAmateur = parseFloat(await getPlatformSetting('raffle_reward_amateur', '1000'));
    const rewardPro = parseFloat(await getPlatformSetting('raffle_reward_pro', '2000'));
    const ticketPrice = parseFloat(await getPlatformSetting('raffle_ticket_price', '100'));

    // Get today's draw
    const { data: draw, error: drawError } = await supabaseAdmin
      .from('raffle_draws')
      .select('*')
      .eq('draw_date', today)
      .single();

    if (drawError && drawError.code !== 'PGRST116') throw drawError;

    // Get all tickets for today
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('raffle_tickets')
      .select(`
        *,
        users!inner (
          username,
          user_tier,
          email
        )
      `)
      .eq('draw_date', today)
      .order('purchase_time', { ascending: false });

    if (ticketsError) throw ticketsError;

    // Group tickets by lucky_number
    const digitBreakdown = {};
    tickets?.forEach(ticket => {
      if (!digitBreakdown[ticket.lucky_number]) {
        digitBreakdown[ticket.lucky_number] = {
          digit: ticket.lucky_number,
          count: 0,
          tickets: []
        };
      }
      digitBreakdown[ticket.lucky_number].count += 1;
      digitBreakdown[ticket.lucky_number].tickets.push({
        ticket_number: ticket.ticket_number,
        username: ticket.users.username,
        user_tier: ticket.users.user_tier,
        purchase_time: ticket.purchase_time
      });
    });

    // Convert to array and sort
    const digitArray = Object.values(digitBreakdown).sort((a, b) => a.count - b.count);

    // Find most and least common
    const leastCommon = digitArray.length > 0 ? digitArray[0] : null;
    const mostCommon = digitArray.length > 0 ? digitArray[digitArray.length - 1] : null;

    // Get suggested winners (if draw is in progress)
    let suggestedWinners = [];
    if (draw?.suggested_winning_numbers) {
      suggestedWinners = tickets
        ?.filter(t => draw.suggested_winning_numbers.includes(t.lucky_number))
        .map(t => ({
          username: t.users.username,
          user_tier: t.users.user_tier,
          ticket_number: t.ticket_number,
          lucky_number: t.lucky_number,
          potential_reward: t.users.user_tier === 'Pro' ? rewardPro : rewardAmateur
        })) || [];
    }

    return res.json({
      status: 'success',
      message: 'Admin draw overview retrieved successfully',
      data: {
        draw_info: draw || {
          status: 'pending',
          draw_date: today
        },
        statistics: {
          total_tickets_sold: tickets?.length || 0,
          unique_digits: digitArray.length,
          total_revenue: (tickets?.length || 0) * ticketPrice,
          least_common: leastCommon,
          most_common: mostCommon
        },
        digit_breakdown: digitArray,
        suggested_winners: suggestedWinners,
        all_tickets: tickets?.map(t => ({
          id: t.id,
          ticket_number: t.ticket_number,
          lucky_number: t.lucky_number,
          username: t.users.username,
          user_tier: t.users.user_tier,
          purchase_time: t.purchase_time,
          is_winner: t.is_winner
        })) || []
      }
    });

  } catch (error) {
    console.error('Error fetching admin draw overview:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch admin draw overview'
    });
  }
};

/**
 * ADMIN: Manual winner selection (Option A)
 * POST /api/raffle/admin/select-winners
 */
const selectWinnersManually = async (req, res) => {
  try {
    const { winning_digit } = req.body;
    const adminId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Validate winning_digit
    if (!winning_digit || !/^\d{4}$/.test(winning_digit)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid winning digit. Must be a 4-digit number'
      });
    }

    // Check if tickets exist with this digit
    const { data: matchingTickets, error: ticketsError } = await supabaseAdmin
      .from('raffle_tickets')
      .select('id')
      .eq('draw_date', today)
      .eq('lucky_number', winning_digit);

    if (ticketsError) throw ticketsError;

    if (!matchingTickets || matchingTickets.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: `No tickets found with digit ${winning_digit} for today`
      });
    }

    // Award winners using the database function
    const { data: result, error: awardError } = await supabaseAdmin
      .rpc('award_raffle_winners', {
        winning_digits: [winning_digit],
        admin_id: adminId,
        action_type: 'manual_override'
      });

    if (awardError) throw awardError;

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: adminId,
        activity_type: 'raffle_manual_selection',
        description: `Manually selected winning digit: ${winning_digit}`,
        metadata: {
          draw_date: today,
          winning_digit: winning_digit,
          winners_awarded: result.winners_awarded,
          total_rewarded: result.total_rewarded
        }
      });

    return res.json({
      status: 'success',
      message: 'Winners selected and awarded successfully',
      data: {
        winning_digit: winning_digit,
        winners_awarded: result.winners_awarded,
        total_rewarded: result.total_rewarded
      }
    });

  } catch (error) {
    console.error('Error selecting winners manually:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to select winners'
    });
  }
};

/**
 * ADMIN: Approve suggested winners
 * POST /api/raffle/admin/approve-suggested
 */
/**
 * ADMIN: Approve suggested winners
 * POST /api/raffle/admin/approve-suggested
 */
const approveSuggestedWinners = async (req, res) => {
  try {
    const adminId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Get today's draw
    const { data: draw, error: drawError } = await supabaseAdmin
      .from('raffle_draws')
      .select('*')
      .eq('draw_date', today)
      .single();

    // Handle specific error: No draw exists
    if (drawError && drawError.code === 'PGRST116') {
      return res.status(404).json({
        status: 'error',
        message: 'No raffle draw found for today. Please wait for the 8:00 PM draw processing or ensure tickets were sold today.'
      });
    }

    // Handle other database errors
    if (drawError) {
      console.error('Database error fetching draw:', drawError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch draw information',
        error: drawError.message
      });
    }

    // Validate draw status
    if (!draw) {
      return res.status(404).json({
        status: 'error',
        message: 'No raffle draw found for today'
      });
    }

    if (draw.status === 'pending') {
      return res.status(400).json({
        status: 'error',
        message: 'Draw has not been processed yet. Please wait for 8:00 PM automatic processing.'
      });
    }

    if (draw.status === 'completed') {
      return res.status(400).json({
        status: 'error',
        message: 'Draw has already been finalized. Winners have been awarded.',
        data: {
          winning_digits: draw.final_winning_numbers,
          winners_awarded: draw.final_winner_count,
          finalized_at: draw.finalized_at
        }
      });
    }

    if (draw.status === 'no_winner') {
      return res.status(400).json({
        status: 'error',
        message: 'Draw has been marked as "no winner". Cannot approve suggested winners.',
        data: {
          fake_winner: {
            username: draw.fake_winner_username,
            ticket: draw.fake_winner_ticket,
            digit: draw.fake_winner_digit
          }
        }
      });
    }

    if (draw.status !== 'in_progress') {
      return res.status(400).json({
        status: 'error',
        message: `Cannot approve winners. Draw status is: ${draw.status}`
      });
    }

    // Validate suggested winners exist
    if (!draw.suggested_winning_numbers || draw.suggested_winning_numbers.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No suggested winners available to approve'
      });
    }

    // Award winners using suggested digits
    const { data: result, error: awardError } = await supabaseAdmin
      .rpc('award_raffle_winners', {
        winning_digits: draw.suggested_winning_numbers,
        admin_id: adminId,
        action_type: 'approve_suggested'
      });

    if (awardError) {
      console.error('Error awarding winners:', awardError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to award winners',
        error: awardError.message
      });
    }

    // Validate result
    if (!result || !result.success) {
      return res.status(500).json({
        status: 'error',
        message: 'Winner award process failed',
        data: result
      });
    }

    // Log admin activity
    try {
      await supabaseAdmin
        .from('admin_activities')
        .insert({
          admin_id: adminId,
          activity_type: 'raffle_approve_suggested',
          description: `Approved suggested winners for raffle draw`,
          metadata: {
            draw_date: today,
            winning_digits: draw.suggested_winning_numbers,
            winners_awarded: result.winners_awarded,
            total_rewarded: result.total_rewarded
          }
        });
    } catch (logError) {
      console.error('Failed to log admin activity:', logError);
      // Don't fail the entire operation if logging fails
    }

    return res.json({
      status: 'success',
      message: 'Suggested winners approved and awarded successfully',
      data: {
        winning_digits: draw.suggested_winning_numbers,
        winners_awarded: result.winners_awarded,
        total_rewarded: result.total_rewarded,
        draw_date: today
      }
    });

  } catch (error) {
    console.error('Error approving suggested winners:', error);
    
    // Provide specific error message if available
    const errorMessage = error.message || 'An unexpected error occurred';
    
    return res.status(500).json({
      status: 'error',
      message: 'Failed to approve suggested winners',
      details: errorMessage
    });
  }
};

/**
 * ADMIN: Select no winner (generate fake winner)
 * POST /api/raffle/admin/no-winner
 */
const selectNoWinner = async (req, res) => {
  try {
    const adminId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Generate fake winner
    const { data: result, error: fakeError } = await supabaseAdmin
      .rpc('generate_fake_winner');

    if (fakeError) throw fakeError;

    // Update draw with admin info
    await supabaseAdmin
      .from('raffle_draws')
      .update({
        processed_by: adminId,
        admin_action: 'no_winner',
        admin_notes: 'No winner selected by admin'
      })
      .eq('draw_date', today);

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: adminId,
        activity_type: 'raffle_no_winner',
        description: 'Selected no winner for raffle draw',
        metadata: {
          draw_date: today,
          fake_winner: result
        }
      });

    return res.json({
      status: 'success',
      message: 'No winner selected - fake winner generated',
      data: {
        fake_username: result.fake_username,
        fake_ticket: result.fake_ticket,
        fake_digit: result.fake_digit
      }
    });

  } catch (error) {
    console.error('Error selecting no winner:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to select no winner'
    });
  }
};

/**
 * ADMIN: Specify minimum winners (Option B)
 * POST /api/raffle/admin/minimum-winners
 */
const selectMinimumWinners = async (req, res) => {
  try {
    const { minimum_winners } = req.body;
    const adminId = req.user.id;
    const today = new Date().toISOString().split('T')[0];

    // Validate input
    if (!minimum_winners || minimum_winners < 1) {
      return res.status(400).json({
        status: 'error',
        message: 'Minimum winners must be at least 1'
      });
    }

    // Get all tickets for today grouped by digit
    const { data: tickets, error: ticketsError } = await supabaseAdmin
      .from('raffle_tickets')
      .select('lucky_number')
      .eq('draw_date', today);

    if (ticketsError) throw ticketsError;

    if (!tickets || tickets.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'No tickets sold today'
      });
    }

    // Count tickets per digit
    const digitCounts = {};
    tickets.forEach(t => {
      digitCounts[t.lucky_number] = (digitCounts[t.lucky_number] || 0) + 1;
    });

    // Find digit(s) with count >= minimum_winners
    const eligibleDigits = Object.entries(digitCounts)
      .filter(([digit, count]) => count >= minimum_winners)
      .sort((a, b) => a[1] - b[1]); // Sort by count ascending

    if (eligibleDigits.length === 0) {
      // No digit has enough tickets, find maximum available
      const maxCount = Math.max(...Object.values(digitCounts));
      return res.status(400).json({
        status: 'error',
        message: `No digit has ${minimum_winners} or more tickets. Maximum available is ${maxCount} ticket(s)`,
        data: {
          requested: minimum_winners,
          maximum_available: maxCount
        }
      });
    }

    // Use the digit with the smallest count that meets minimum
    const selectedDigits = [eligibleDigits[0][0]];
    const actualWinnerCount = eligibleDigits[0][1];

    // Award winners
    const { data: result, error: awardError } = await supabaseAdmin
      .rpc('award_raffle_winners', {
        winning_digits: selectedDigits,
        admin_id: adminId,
        action_type: 'minimum_winners'
      });

    if (awardError) throw awardError;

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: adminId,
        activity_type: 'raffle_minimum_winners',
        description: `Selected winners with minimum ${minimum_winners} constraint`,
        metadata: {
          draw_date: today,
          minimum_requested: minimum_winners,
          actual_winners: actualWinnerCount,
          winning_digits: selectedDigits,
          total_rewarded: result.total_rewarded
        }
      });

    return res.json({
      status: 'success',
      message: 'Winners selected based on minimum constraint',
      data: {
        minimum_requested: minimum_winners,
        actual_winners: result.winners_awarded,
        winning_digits: selectedDigits,
        total_rewarded: result.total_rewarded
      }
    });

  } catch (error) {
    console.error('Error selecting minimum winners:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to select minimum winners'
    });
  }
};

/**
 * CRON: Process draw at 8:00 PM
 * POST /api/raffle/cron/process-draw
 */
const cronProcessDraw = async (req, res) => {
  try {
    // Security: Check cron secret key
    const cronSecret = req.headers['x-cron-secret'];
    if (cronSecret !== process.env.CRON_SECRET_KEY) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized' 
      });
    }

    // Check if raffle is enabled
    const raffleEnabled = await isRaffleEnabled();
    if (!raffleEnabled) {
      return res.json({
        status: 'success',
        message: 'Raffle is disabled, skipping draw processing'
      });
    }

    // Process the draw using database function
    const { data: result, error } = await supabaseAdmin
      .rpc('process_raffle_draw');

    if (error) throw error;

    if (!result.success) {
      return res.json({
        status: 'success',
        message: result.message
      });
    }

    // Send email to admin
    const adminEmail = await getPlatformSetting('raffle_admin_email', 'admin@lumivox.com');
    const rewardAmateur = await getPlatformSetting('raffle_reward_amateur', '1000');
    const rewardPro = await getPlatformSetting('raffle_reward_pro', '2000');

    // Get winner details for email
    const { data: potentialWinners } = await supabaseAdmin
      .from('raffle_tickets')
      .select(`
        ticket_number,
        lucky_number,
        users!inner (
          username,
          user_tier
        )
      `)
      .eq('draw_date', new Date().toISOString().split('T')[0])
      .in('lucky_number', result.suggested_digits);

    const totalRewards = potentialWinners?.reduce((sum, w) => {
      const reward = w.users.user_tier === 'Pro' ? parseFloat(rewardPro) : parseFloat(rewardAmateur);
      return sum + reward;
    }, 0) || 0;

    const emailBody = `
      <h2>🎯 Raffle Draw - Admin Action Required</h2>
      <p>Hello Admin,</p>
      <p>The 8:00 PM Raffle Draw has been processed.</p>
      
      <h3>📊 Today's Results:</h3>
      <ul>
        <li><strong>Total Tickets Sold:</strong> ${result.total_tickets}</li>
        <li><strong>Suggested Winning Digit(s):</strong> ${result.suggested_digits.join(', ')}</li>
        <li><strong>Number of Potential Winners:</strong> ${result.winner_count}</li>
      </ul>
      
      <h3>🏆 Potential Winners:</h3>
      <ol>
        ${potentialWinners?.map(w => `
          <li>${w.users.username} (${w.users.user_tier}) - Ticket: ${w.ticket_number} - Digit: ${w.lucky_number}</li>
        `).join('') || '<li>No winners data available</li>'}
      </ol>
      
      <p><strong>Total Rewards to be Paid:</strong> ₦${totalRewards.toLocaleString()} VOXcoin</p>
      
      <h3>⏰ Action Required:</h3>
      <p>Please review and approve/override within 30 minutes.</p>
      <p>If no action is taken by 8:30 PM, winners will be automatically awarded.</p>
      
      <p><a href="${process.env.FRONTEND_URL}/admin/raffle" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Manage Draw</a></p>
      
      <hr>
      <p style="color: #666; font-size: 12px;">LUMIVOX Raffle System</p>
    `;

    try { 
      await sendEmail(
        adminEmail,
        '🎯 Raffle Draw - Admin Action Required',
        emailBody
      );
    } catch (emailError) {
      console.error('Failed to send admin notification email:', emailError);
      // Don't fail the entire process if email fails
    }

    return res.json({
      status: 'success',
      message: 'Draw processed successfully',
      data: result
    });

  } catch (error) {
    console.error('Error in cron process draw:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to process draw'
    });
  }
};

/**
 * CRON: Auto-finalize at 8:30 PM
 * POST /api/raffle/cron/auto-finalize
 */
const cronAutoFinalize = async (req, res) => {
  try {
    // Security: Check cron secret key
    const cronSecret = req.headers['x-cron-secret'];
    if (cronSecret !== process.env.CRON_SECRET_KEY) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized'
      });
    }

    // Check if raffle is enabled
    const raffleEnabled = await isRaffleEnabled();
    if (!raffleEnabled) {
      return res.json({
        status: 'success',
        message: 'Raffle is disabled, skipping auto-finalize'
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if draw is still in progress
    const { data: draw, error: drawError } = await supabaseAdmin
      .from('raffle_draws')
      .select('*')
      .eq('draw_date', today)
      .single();

    if (drawError && drawError.code !== 'PGRST116') throw drawError;

    if (!draw || draw.status !== 'in_progress') {
      return res.json({
        status: 'success',
        message: 'No draw in progress to finalize or already finalized'
      });
    }

    // Auto-award suggested winners
    const { data: result, error: awardError } = await supabaseAdmin
      .rpc('award_raffle_winners', {
        winning_digits: draw.suggested_winning_numbers,
        admin_id: null, // System action
        action_type: 'auto_finalized'
      });

    if (awardError) throw awardError;

    // Log system activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: null, // System action
        activity_type: 'raffle_auto_finalize',
        description: 'Auto-finalized raffle draw (admin did not act)',
        metadata: {
          draw_date: today,
          winning_digits: draw.suggested_winning_numbers,
          winners_awarded: result.winners_awarded,
          total_rewarded: result.total_rewarded
        }
      });

    return res.json({
      status: 'success',
      message: 'Draw auto-finalized successfully',
      data: result
    });

  } catch (error) {
    console.error('Error in cron auto-finalize:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to auto-finalize draw'
    });
  }
};

/**
 * ADMIN: Get raffle statistics
 * GET /api/raffle/admin/statistics
 */
const getRaffleStatistics = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const startDateStr = startDate.toISOString().split('T')[0];

    // Get draws statistics
    const { data: draws, error: drawsError } = await supabaseAdmin
      .from('raffle_draws')
      .select('*')
      .gte('draw_date', startDateStr)
      .order('draw_date', { ascending: false });

    if (drawsError) throw drawsError;

    // Calculate statistics
    const totalDraws = draws?.length || 0;
    const completedDraws = draws?.filter(d => d.status === 'completed').length || 0;
    const totalRewardsPaid = draws?.reduce((sum, d) => sum + parseFloat(d.total_rewards_paid || 0), 0) || 0;
    const totalRevenue = draws?.reduce((sum, d) => sum + parseFloat(d.total_revenue || 0), 0) || 0;
    const totalTicketsSold = draws?.reduce((sum, d) => sum + (d.total_tickets_sold || 0), 0) || 0;

    // Get today's status
    const today = new Date().toISOString().split('T')[0];
    const todayDraw = draws?.find(d => d.draw_date === today);

    return res.json({
      status: 'success',
      message: 'Raffle statistics retrieved successfully',
      data: {
        period_days: parseInt(days),
        overview: {
          total_draws: totalDraws,
          completed_draws: completedDraws,
          total_tickets_sold: totalTicketsSold,
          total_revenue: totalRevenue,
          total_rewards_paid: totalRewardsPaid,
          net_revenue: totalRevenue - totalRewardsPaid
        },
        today: todayDraw ? {
          status: todayDraw.status,
          tickets_sold: todayDraw.total_tickets_sold,
          revenue: todayDraw.total_revenue,
          winners: todayDraw.final_winner_count,
          rewards_paid: todayDraw.total_rewards_paid
        } : {
          status: 'no_draw',
          message: 'No draw for today yet'
        },
        recent_draws: draws?.slice(0, 10).map(d => ({
          draw_date: d.draw_date,
          status: d.status,
          tickets_sold: d.total_tickets_sold,
          winners: d.final_winner_count,
          rewards_paid: d.total_rewards_paid,
          winning_digits: d.final_winning_numbers
        })) || []
      }
    });

  } catch (error) {
    console.error('Error fetching raffle statistics:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch raffle statistics'
    });
  }
};

module.exports = {
  // User endpoints
  purchaseTicket,
  getMyTickets,
  getRaffleDashboard,
  getDrawResults,
  
  // Admin endpoints
  getAdminDrawOverview,
  selectWinnersManually,
  approveSuggestedWinners,
  selectNoWinner,
  selectMinimumWinners,
  getRaffleStatistics,
  
  // Cron endpoints
  cronProcessDraw,
  cronAutoFinalize
};