const { supabaseAdmin } = require('../services/supabase.service');
require("dotenv").config();
const crypto = require('crypto');

const paystack = require('paystack')(process.env.PAYSTACK_SECRET_KEY);

class PaymentController {
  
  // Initialize payment with purpose (gaming, investment, upgrade)
  static async initializePayment(req, res) {
    try {
      const { amount, email, purpose } = req.body;
      const userId = req.user.id;

      // Validation
      if (!amount || amount < 50) {
        return res.status(400).json({
          success: false,
          message: 'Minimum deposit amount is ₦50'
        });
      }

      if (amount > 1000000) {
        return res.status(400).json({
          success: false,
          message: 'Maximum deposit amount is ₦1,000,000'
        });
      }

      // Validate purpose
      const validPurposes = ['gaming', 'investment', 'upgrade'];
      if (!purpose || !validPurposes.includes(purpose)) {
        return res.status(400).json({
          success: false,
          message: 'Purpose must be one of: gaming, investment, upgrade'
        });
      }

      // Additional validation for upgrade
      if (purpose === 'upgrade') {
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('user_tier')
          .eq('id', userId)
          .single();

        if (user?.user_tier === 'Pro') {
          return res.status(400).json({
            success: false,
            message: 'You are already a Pro user'
          });
        }

        // Verify upgrade amount matches platform settings
        const { data: upgradeCostSetting } = await supabaseAdmin
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'tier_upgrade_cost')
          .single();

        const expectedUpgradeCost = upgradeCostSetting 
          ? parseFloat(upgradeCostSetting.setting_value) 
          : 2500;

        if (amount !== expectedUpgradeCost) {
          return res.status(400).json({
            success: false,
            message: `Upgrade cost is ₦${expectedUpgradeCost.toLocaleString()}`,
            expected_amount: expectedUpgradeCost
          });
        }
      }

      // Generate unique reference
      const reference = `LV_${purpose.toUpperCase()}_${userId.slice(-8)}_${Date.now()}`;

      // Purpose-specific callback URLs
      const callbackUrls = {
        gaming: `${process.env.FRONTEND_URL}/gaming/wallet/success`,
        investment: `${process.env.FRONTEND_URL}/investment/wallet/success`,
        upgrade: `${process.env.FRONTEND_URL}/profile/upgrade/success`
      };

      // Initialize payment with Paystack
      const paymentData = {
        email: email || req.user.email,
        amount: amount * 100, // Convert to kobo
        reference: reference,
        callback_url: `${callbackUrls[purpose]}?reference=${reference}&amount=${amount}&purpose=${purpose}`,
        metadata: {
          user_id: userId,
          purpose: purpose,
          amount: amount,
          description: purpose === 'gaming' 
            ? 'Gaming wallet funding' 
            : purpose === 'investment'
            ? 'Investment wallet funding'
            : 'Pro tier upgrade'
        }
      };

      const initialization = await paystack.transaction.initialize(paymentData);

      if (!initialization.status) {
        return res.status(400).json({
          success: false,
          message: 'Payment initialization failed',
          data: initialization
        });
      }

      res.json({
        success: true,
        message: `${purpose.charAt(0).toUpperCase() + purpose.slice(1)} payment initialized successfully`,
        data: {
          authorization_url: initialization.data.authorization_url,
          access_code: initialization.data.access_code,
          reference: reference,
          purpose: purpose
        }
      });

    } catch (error) {
      console.error('Payment initialization error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Verify payment and process based on purpose (WITH REFERRAL REWARD PROCESSING)
  static async verifyPayment(req, res) {
    try {
      const { reference, amount, purpose } = req.body;
      const userId = req.user.id;

      // Validation
      if (!reference || !amount || !purpose) {
        return res.status(400).json({
          success: false,
          message: 'Reference, amount, and purpose are required'
        });
      }

      const validPurposes = ['gaming', 'investment', 'upgrade'];
      if (!validPurposes.includes(purpose)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid purpose'
        });
      }

      // 1. Verify payment with Paystack
      const verification = await paystack.transaction.verify(reference);
      
      if (!verification.status || verification.data.status !== 'success') {
        return res.status(400).json({
          success: false,
          message: 'Payment verification failed',
          data: verification.data
        });
      }

      // 2. Check if payment amount matches
      const paidAmount = verification.data.amount / 100;
      if (paidAmount !== parseFloat(amount)) {
        return res.status(400).json({
          success: false,
          message: 'Amount mismatch',
          expected: amount,
          received: paidAmount
        });
      }

      // 3. Check if transaction already exists
      const { data: existingTransaction } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('reference', reference)
        .single();

      if (existingTransaction) {
        return res.status(400).json({
          success: false,
          message: 'Transaction already processed'
        });
      }

      let responseData = {};

      // 4. Process based on purpose
      if (purpose === 'gaming') {
        // Credit gaming wallet
        const { data: currentWallet } = await supabaseAdmin
          .from('wallets')
          .select('games_balance')
          .eq('user_id', userId)
          .single();

        const newBalance = parseFloat(currentWallet.games_balance || 0) + paidAmount;

        await supabaseAdmin
          .from('wallets')
          .update({
            games_balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        responseData = {
          new_games_balance: newBalance,
          wallet_type: 'gaming'
        };

        // Record transaction
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: userId,
            transaction_type: 'deposit',
            earning_type: 'gaming_deposit',
            amount: paidAmount,
            currency: 'NGN',
            status: 'completed',
            reference: reference,
            description: 'Gaming wallet funding via Paystack',
            metadata: verification.data,
            created_at: new Date().toISOString()
          });

      } else if (purpose === 'investment') {
        // Credit investment wallet
        const { data: currentWallet } = await supabaseAdmin
          .from('wallets')
          .select('investment_balance')
          .eq('user_id', userId)
          .single();

        const newBalance = parseFloat(currentWallet.investment_balance || 0) + paidAmount;

        await supabaseAdmin
          .from('wallets')
          .update({
            investment_balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        responseData = {
          new_investment_balance: newBalance,
          wallet_type: 'investment'
        };

        // Record transaction
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: userId,
            transaction_type: 'deposit',
            earning_type: 'investment_deposit',
            amount: paidAmount,
            currency: 'NGN',
            status: 'completed',
            reference: reference,
            description: 'Investment wallet funding via Paystack',
            metadata: verification.data,
            created_at: new Date().toISOString()
          });

      } else if (purpose === 'upgrade') {
        // Process Pro upgrade
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('user_tier, referred_by')
          .eq('id', userId)
          .single();

        if (user?.user_tier === 'Pro') {
          return res.status(400).json({
            success: false,
            message: 'You are already a Pro user'
          });
        }

        // Get Pro upgrade bonus
        const { data: proUpgradeSetting } = await supabaseAdmin
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'pro_upgrade_bonus')
          .single();

        const upgradeBonus = proUpgradeSetting 
          ? parseFloat(proUpgradeSetting.setting_value) 
          : 5000;

        // Get referral reward amount from platform settings
        const { data: referralRewardSetting } = await supabaseAdmin
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', 'referral_reward_amount')
          .single();

        const referralRewardAmount = referralRewardSetting 
          ? parseFloat(referralRewardSetting.setting_value) 
          : 500;

        // Update user tier
        await supabaseAdmin
          .from('users')
          .update({
            user_tier: 'Pro',
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        // Award upgrade bonus to coins_balance
        const { data: currentWallet } = await supabaseAdmin
          .from('wallets')
          .select('coins_balance')
          .eq('user_id', userId)
          .single();

        const newCoinsBalance = parseFloat(currentWallet.coins_balance || 0) + upgradeBonus;

        await supabaseAdmin
          .from('wallets')
          .update({
            coins_balance: newCoinsBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        responseData = {
          new_tier: 'Pro',
          upgrade_bonus: upgradeBonus,
          new_coins_balance: newCoinsBalance
        };

        // Record upgrade payment transaction
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: userId,
            transaction_type: 'upgrade_payment',
            earning_type: 'tier_upgrade',
            amount: paidAmount,
            currency: 'NGN',
            status: 'completed',
            reference: reference,
            description: 'Pro tier upgrade payment via Paystack',
            metadata: verification.data,
            created_at: new Date().toISOString()
          });

        // Record upgrade bonus transaction
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: userId,
            transaction_type: 'reward',
            earning_type: 'upgrade_bonus',
            amount: upgradeBonus,
            currency: 'NGN',
            status: 'completed',
            description: `Pro upgrade bonus - Welcome to Pro tier!`,
            metadata: {
              previous_tier: 'Free',
              new_tier: 'Pro',
              upgrade_reference: reference
            },
            created_at: new Date().toISOString()
          });

        // ========== PROCESS REFERRAL REWARD ==========
        if (user.referred_by) {
          // Update referral status to active and set reward amount
          const { data: referralRecord } = await supabaseAdmin
            .from('referrals')
            .update({
              status: 'active',
              reward_amount: referralRewardAmount
            })
            .eq('referred_id', userId)
            .eq('referrer_id', user.referred_by)
            .select()
            .single();

          if (referralRecord) {
            // Credit referrer's referral_balance
            const { data: referrerWallet } = await supabaseAdmin
              .from('wallets')
              .select('referral_balance')
              .eq('user_id', user.referred_by)
              .single();

            const newReferralBalance = parseFloat(referrerWallet.referral_balance || 0) + referralRewardAmount;

            await supabaseAdmin
              .from('wallets')
              .update({
                referral_balance: newReferralBalance,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', user.referred_by);

            // Record referral reward transaction for referrer
            await supabaseAdmin
              .from('transactions')
              .insert({
                user_id: user.referred_by,
                transaction_type: 'reward',
                earning_type: 'referral_reward',
                amount: referralRewardAmount,
                currency: 'NGN',
                status: 'completed',
                description: `Referral reward - ${user.username || 'User'} upgraded to Pro`,
                source_user_id: userId,
                metadata: {
                  referred_user_id: userId,
                  upgrade_reference: reference
                },
                created_at: new Date().toISOString()
              });

            responseData.referral_reward_processed = true;
            responseData.referral_reward_amount = referralRewardAmount;
          }
        }
      }

      // 5. Return success response
      res.json({
        success: true,
        message: `${purpose.charAt(0).toUpperCase() + purpose.slice(1)} payment successful`,
        data: {
          ...responseData,
          transaction_reference: reference,
          amount: paidAmount,
          purpose: purpose,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Get transaction history
  static async getTransactionHistory(req, res) {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, type, purpose } = req.query;
      
      const offset = (page - 1) * limit;
      
      let query = supabaseAdmin
        .from('transactions')
        .select(`
          id,
          transaction_type,
          earning_type,
          amount,
          currency,
          reference,
          status,
          description,
          created_at,
          metadata
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter by transaction type if provided
      if (type) {
        query = query.eq('transaction_type', type);
      }

      // Filter by purpose (earning_type) if provided
      if (purpose) {
        const purposeMap = {
          gaming: 'gaming_deposit',
          investment: 'investment_deposit',
          upgrade: 'tier_upgrade'
        };
        query = query.eq('earning_type', purposeMap[purpose]);
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw new Error(`Transaction fetch failed: ${error.message}`);
      }

      // Get total count for pagination
      let countQuery = supabaseAdmin
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (type) {
        countQuery = countQuery.eq('transaction_type', type);
      }

      if (purpose) {
        const purposeMap = {
          gaming: 'gaming_deposit',
          investment: 'investment_deposit',
          upgrade: 'tier_upgrade'
        };
        countQuery = countQuery.eq('earning_type', purposeMap[purpose]);
      }

      const { count } = await countQuery;

      res.json({
        success: true,
        data: {
          transactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      console.error('Transaction history error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Admin: Get all payment transactions across all users
  static async getAllPaymentTransactions(req, res) {
    try {
      const { page = 1, limit = 50, purpose, status, user_id, date_from, date_to } = req.query;
      
      const offset = (page - 1) * limit;
      
      let query = supabaseAdmin
        .from('transactions')
        .select(`
          id,
          user_id,
          transaction_type,
          earning_type,
          amount,
          currency,
          reference,
          status,
          description,
          created_at,
          metadata,
          users:user_id (
            id,
            username,
            email,
            full_name,
            user_tier
          )
        `, { count: 'exact' })
        .in('earning_type', ['gaming_deposit', 'investment_deposit', 'tier_upgrade', 'upgrade_bonus', 'referral_reward'])
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filters
      if (purpose) {
        const purposeMap = {
          gaming: 'gaming_deposit',
          investment: 'investment_deposit',
          upgrade: 'tier_upgrade'
        };
        query = query.eq('earning_type', purposeMap[purpose]);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (user_id) {
        query = query.eq('user_id', user_id);
      }

      if (date_from) {
        query = query.gte('created_at', date_from);
      }

      if (date_to) {
        query = query.lte('created_at', date_to);
      }

      const { data: transactions, error, count } = await query;

      if (error) {
        throw new Error(`Admin transaction fetch failed: ${error.message}`);
      }

      // Calculate totals
      const totals = transactions.reduce((acc, t) => {
        const purpose = t.earning_type === 'gaming_deposit' ? 'gaming'
          : t.earning_type === 'investment_deposit' ? 'investment'
          : t.earning_type === 'tier_upgrade' ? 'upgrade'
          : t.earning_type === 'upgrade_bonus' ? 'upgrade_bonus'
          : 'referral_reward';
        
        if (!acc[purpose]) {
          acc[purpose] = { count: 0, total_amount: 0 };
        }
        
        acc[purpose].count += 1;
        acc[purpose].total_amount += parseFloat(t.amount);
        
        return acc;
      }, {});

      res.json({
        success: true,
        message: 'Payment transactions retrieved successfully',
        data: {
          transactions,
          summary: {
            total_transactions: count,
            totals_by_purpose: totals,
            grand_total: transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0)
          },
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            pages: Math.ceil(count / limit)
          }
        }
      });

    } catch (error) {
      console.error('Admin get payment transactions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Paystack webhook handler
  static async handleWebhook(req, res) {
    try {
      const hash = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY_LIVE)
        .update(JSON.stringify(req.body))
        .digest('hex');

      if (hash !== req.headers['x-paystack-signature']) {
        return res.status(400).json({
          success: false,
          message: 'Invalid signature'
        });
      }

      const event = req.body;

      if (event.event === 'charge.success') {
        const { reference, amount, customer, metadata } = event.data;
        
        console.log('Webhook received for successful payment:', {
          reference,
          amount: amount / 100,
          purpose: metadata?.purpose,
          user_id: metadata?.user_id
        });
      }

      res.status(200).json({ success: true });

    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({
        success: false,
        message: 'Webhook processing failed'
      });
    }
  }
}

module.exports = PaymentController;