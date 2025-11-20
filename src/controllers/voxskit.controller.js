const { supabaseAdmin } = require('../services/supabase.service');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ==================== USER ENDPOINTS ====================

 

// Claim video reward
const claimVideoReward = async (req, res) => {
  try {
    const { video_id } = req.body;
    const userId = req.user.id;

    // Check if VoxSkit is enabled
    const { data: enabledSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'voxskit_enabled')
      .single();

    if (enabledSetting?.setting_value === 'false') {
      return res.status(403).json({
        status: 'error',
        message: 'VoxSkit feature is currently disabled'
      });
    }

    // Get user tier
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

    // Check if video exists and is active
    const { data: video, error: videoError } = await supabaseAdmin
      .from('voxskit_videos')
      .select('*')
      .eq('id', video_id)
      .eq('is_active', true)
      .single();

    if (videoError || !video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found or inactive'
      });
    }

    // Check if user already claimed this video
    const { data: existingClaim } = await supabaseAdmin
      .from('voxskit_user_claims')
      .select('id')
      .eq('user_id', userId)
      .eq('video_id', video_id)
      .single();

    if (existingClaim) {
      return res.status(409).json({
        status: 'error',
        message: 'You have already claimed reward for this video'
      });
    }

    // Check daily limit
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayClaims } = await supabaseAdmin
      .from('voxskit_user_claims')
      .select('id')
      .eq('user_id', userId)
      .gte('claimed_at', todayStart.toISOString());

    // Get daily limits from settings
    const isPaidUser = ['Amateur', 'Pro'].includes(user.user_tier);
    const limitKey = isPaidUser ? 'voxskit_daily_limit_paid' : 'voxskit_daily_limit_free';

    const { data: limitSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', limitKey)
      .single();

    const dailyLimit = parseInt(limitSetting?.setting_value || (isPaidUser ? 5 : 3));

    if (todayClaims && todayClaims.length >= dailyLimit) {
      return res.status(429).json({
        status: 'error',
        message: `Daily claim limit of ${dailyLimit} videos reached. Come back tomorrow!`
      });
    }

    // Get reward amount based on user tier
    const rewardKey = isPaidUser ? 'voxskit_reward_paid' : 'voxskit_reward_free';

    const { data: rewardSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', rewardKey)
      .single();

    const rewardAmount = parseFloat(rewardSetting?.setting_value || (isPaidUser ? 1000 : 500));

    // Create claim record
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('voxskit_user_claims')
      .insert({
        user_id: userId,
        video_id: video_id,
        reward_amount: rewardAmount
      })
      .select()
      .single();

    if (claimError) {
      if (claimError.code === '23505') {
        return res.status(409).json({
          status: 'error',
          message: 'You have already claimed reward for this video'
        });
      }
      throw claimError;
    }

    // Update user's coins_balance
    const { data: wallet } = await supabaseAdmin
      .from('wallets')
      .select('coins_balance')
      .eq('user_id', userId)
      .single();

    const newBalance = parseFloat(wallet?.coins_balance || 0) + rewardAmount;

    const { error: walletError } = await supabaseAdmin
      .from('wallets')
      .update({ coins_balance: newBalance })
      .eq('user_id', userId);

    if (walletError) throw walletError;

    // Update video statistics
    await supabaseAdmin
      .from('voxskit_videos')
      .update({
        claims_count: video.claims_count + 1,
        views_count: video.views_count + 1
      })
      .eq('id', video_id);

    // Create transaction record
    await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        transaction_type: 'video_reward',
        balance_type: 'coins_balance',
        amount: rewardAmount,
        currency: 'NGN',
        status: 'completed',
        description: `VoxSkit reward - ${video.skit_title}`,
        reference: `VOXSKIT-${Date.now()}-${userId.slice(-4).toUpperCase()}`,
        metadata: {
          video_id: video_id,
          video_title: video.skit_title,
          user_tier: user.user_tier
        }
      });

    res.status(200).json({
      status: 'success',
      message: 'Video reward claimed successfully',
      data: {
        claim: {
          id: claim.id,
          reward_amount: rewardAmount,
          claimed_at: claim.claimed_at
        },
        video: {
          id: video.id,
          title: video.skit_title,
          creator: video.creator
        },
        new_coins_balance: newBalance,
        remaining_claims_today: dailyLimit - (todayClaims?.length || 0) - 1
      }
    });

  } catch (error) {
    console.error('Claim video reward error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get available videos
const getAvailableVideos = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    // Check if VoxSkit is enabled
    const { data: enabledSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'voxskit_enabled')
      .single();

    if (enabledSetting?.setting_value === 'false') {
      return res.status(403).json({
        status: 'error',
        message: 'VoxSkit feature is currently disabled'
      });
    }

    // Get user tier for daily limit
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('user_tier')
      .eq('id', userId)
      .single();

    const isPaidUser = ['Amateur', 'Pro'].includes(user?.user_tier);

    // Get user's claims for today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayClaims, error: claimsError } = await supabaseAdmin
      .from('voxskit_user_claims')
      .select('video_id')
      .eq('user_id', userId)
      .gte('claimed_at', todayStart.toISOString());

    if (claimsError) throw claimsError;

    const claimedVideoIds = todayClaims?.map(c => c.video_id) || [];

    // Get active videos excluding already claimed ones
    let query = supabaseAdmin
      .from('voxskit_videos')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (claimedVideoIds.length > 0) {
      query = query.not('id', 'in', `(${claimedVideoIds.join(',')})`);
    }

    const { data: videos, error: videoError, count } = await query;
    if (videoError) throw videoError;

    // Get daily limit from settings
    const limitKey = isPaidUser ? 'voxskit_daily_limit_paid' : 'voxskit_daily_limit_free';

    const { data: limitSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', limitKey)
      .single();

    const dailyLimit = parseInt(limitSetting?.setting_value || (isPaidUser ? 5 : 3));
    const claimsToday = todayClaims?.length || 0;

    res.status(200).json({
      status: 'success',
      message: 'Videos retrieved successfully',
      data: {
        videos,
        daily_stats: {
          claims_today: claimsToday,
          daily_limit: dailyLimit,
          remaining_claims: Math.max(0, dailyLimit - claimsToday),
          can_claim_more: claimsToday < dailyLimit
        },
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil((count || 0) / limit),
          total_videos: count || 0,
          has_next: offset + limit < (count || 0),
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get available videos error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const getUserClaimHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;
    const offset = (page - 1) * limit;

    const { data: claims, error, count } = await supabaseAdmin
      .from('voxskit_user_claims')
      .select(`
        id, reward_amount, claimed_at,
        voxskit_videos (
          id, skit_title, creator, thumbnail_url
        )
      `, { count: 'exact' })
      .eq('user_id', userId)
      .order('claimed_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    res.status(200).json({
      status: 'success',
      message: 'Claim history retrieved successfully',
      data: {
        claims,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil((count || 0) / limit),
          total_claims: count || 0,
          has_next: offset + limit < (count || 0),
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get user claim history error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// ==================== ADMIN ENDPOINTS ====================

const uploadVideo = async (req, res) => {
  try {
    const { skit_title, creator, external_link } = req.body;
    const adminId = req.user.id;

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'Video file is required'
      });
    }

    // Generate unique filename
    const fileExt = path.extname(req.file.originalname);
    const fileName = `voxskit/${uuidv4()}${fileExt}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin
      .storage
      .from('kashprime')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to upload video'
      });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin
      .storage
      .from('kashprime')
      .getPublicUrl(fileName);

    const videoUrl = urlData.publicUrl;

    // Save video record to database
    const { data: video, error: dbError } = await supabaseAdmin
      .from('voxskit_videos')
      .insert({
        skit_title,
        creator,
        external_link: external_link || null,
        video_url: videoUrl,
        uploaded_by: adminId
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: adminId,
        activity_type: 'voxskit_video_uploaded',
        description: `Uploaded VoxSkit video: ${skit_title}`,
        metadata: { video_id: video.id, title: skit_title, creator }
      });

    res.status(201).json({
      status: 'success',
      message: 'Video uploaded successfully',
      data: { video }
    });

  } catch (error) {
    console.error('Upload video error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const getAllVideos = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      is_active = ''
    } = req.query;

    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('voxskit_videos')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (search) {
      query = query.or(`skit_title.ilike.%${search}%,creator.ilike.%${search}%`);
    }

    if (is_active !== '') {
      query = query.eq('is_active', is_active === true);
    }

    const { data: videos, error, count } = await query;
    if (error) throw error;

    res.status(200).json({
      status: 'success',
      message: 'Videos retrieved successfully',
      data: {
        videos,
        pagination: {
          current_page: parseInt(page),
          total_pages: Math.ceil((count || 0) / limit),
          total_videos: count || 0,
          has_next: offset + limit < (count || 0),
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get all videos error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const getVideoDetails = async (req, res) => {
  try {
    const { videoId } = req.params;

    const { data: video, error: videoError } = await supabaseAdmin
      .from('voxskit_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found'
      });
    }

    // Get users who claimed this video
    const { data: claims } = await supabaseAdmin
      .from('voxskit_user_claims')
      .select(`
        id, reward_amount, claimed_at,
        users (id, username, full_name, user_tier)
      `)
      .eq('video_id', videoId)
      .order('claimed_at', { ascending: false })
      .limit(50);

    res.status(200).json({
      status: 'success',
      message: 'Video details retrieved successfully',
      data: {
        video,
        claims: claims || [],
        statistics: {
          total_claims: video.claims_count,
          total_views: video.views_count
        }
      }
    });

  } catch (error) {
    console.error('Get video details error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const deleteVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    const adminId = req.user.id;

    // Get video details
    const { data: video, error: videoError } = await supabaseAdmin
      .from('voxskit_videos')
      .select('*')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return res.status(404).json({
        status: 'error',
        message: 'Video not found'
      });
    }

    // Delete video file from storage
    if (video.video_url) {
      const urlParts = video.video_url.split('/lumivox/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabaseAdmin
          .storage
          .from('kashprime')
          .remove([filePath]);
      }
    }

    // Delete video record
    const { error: deleteError } = await supabaseAdmin
      .from('voxskit_videos')
      .delete()
      .eq('id', videoId);

    if (deleteError) throw deleteError;

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: adminId,
        activity_type: 'voxskit_video_deleted',
        description: `Deleted VoxSkit video: ${video.skit_title}`,
        metadata: { video_id: videoId, title: video.skit_title }
      });

    res.status(200).json({
      status: 'success',
      message: 'Video deleted successfully'
    });

  } catch (error) {
    console.error('Delete video error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

 

 

module.exports = {
  // User endpoints
  getAvailableVideos,
  claimVideoReward,
  getUserClaimHistory,
  
  // Admin endpoints
  uploadVideo,
  getAllVideos,
  getVideoDetails,
  deleteVideo,
  
};