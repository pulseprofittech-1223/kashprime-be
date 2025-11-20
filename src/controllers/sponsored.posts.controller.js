const { supabaseAdmin } = require("../services/supabase.service");
const { validationResult } = require("express-validator");
const messages = require("../utils/constants/voxfeed");

// Create new sponsored post (Admin only)
const createPost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: messages.ERROR.VALIDATION_ERROR,
        data: { errors: errors.array() },
      });
    }

    const adminId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from("sponsored_posts")
      .insert([
        {
          admin_id: adminId,
          title: req.body.title,
          content: req.body.content,
          featured_image: req.file ? req.file.path : null,
          link1: req.body.link1 || null,
          link2: req.body.link2 || null,
          status: "published", // Direct publication, no approval needed
          is_published: true,
          published_at: new Date().toISOString(),
        },
      ])
      .select(
        `
        *,
        admin_user:admin_id (
          id, username, full_name, profile_picture
        )
      `
      )
      .single();

    if (error) {
      console.error("Database error:", error);
      return res.status(500).json({
        status: "error",
        message: messages.ERROR.SERVER_ERROR,
      });
    }

    // Log admin activity
    await supabaseAdmin.from("admin_activities").insert([
      {
        admin_id: adminId,
        activity_type: "sponsored_post_create",
        description: `Created sponsored post: ${data.title}`,
        metadata: {
          post_id: data.id,
          title: data.title,
        },
      },
    ]);

    res.status(201).json({
      status: "success",
      message: "Sponsored post created successfully",
      data: { post: data },
    });
  } catch (error) {
    console.error("Create sponsored post error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Get all sponsored posts (Admin management)
const getAllPosts = async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("sponsored_posts")
      .select(
        `
        *,
        admin_user:admin_id (
          id, username, full_name, profile_picture
        )
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    if (search) {
      query = query.or(`title.ilike.%${search}%, content.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;

    if (error) {
      console.error("Database error:", error);
      return res.status(500).json({
        status: "error",
        message: messages.ERROR.SERVER_ERROR,
      });
    }

    res.json({
      status: "success",
      message: "Sponsored posts retrieved successfully",
      data: {
        posts: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          has_more: count > offset + limit,
        },
      },
    });
  } catch (error) {
    console.error("Get all sponsored posts error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Get published sponsored posts (Public access)
const getPublishedPosts = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, sort = "latest" } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("sponsored_posts")
      .select(
        `
        *,
        admin_user:admin_id (
          id, username, full_name, profile_picture
        )
      `,
        { count: "exact" }
      )
      .eq("status", "published")
      .eq("is_published", true);

    // Search functionality
    if (search) {
      query = query.or(`title.ilike.%${search}%, content.ilike.%${search}%`);
    }

    // Sorting
    switch (sort) {
      case "popular":
        query = query.order("view_count", { ascending: false });
        break;
      case "engagement":
        query = query.order("engagement_count", { ascending: false });
        break;
      default:
        query = query.order("published_at", { ascending: false });
    }

    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;

    if (error) {
      console.error("Database error:", error);
      return res.status(500).json({
        status: "error",
        message: messages.ERROR.SERVER_ERROR,
      });
    }

    res.json({
      status: "success",
      message: "Sponsored posts retrieved successfully",
      data: {
        posts: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          has_more: count > offset + limit,
        },
      },
    });
  } catch (error) {
    console.error("Get published sponsored posts error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Get sponsored post by ID
const getPostById = async (req, res) => {
  try {
    const postId = req.params.postId;

    const { data, error } = await supabaseAdmin
      .from("sponsored_posts")
      .select(
        `
        *,
        admin_user:admin_id (
          id, username, full_name, profile_picture
        )
      `
      )
      .eq("id", postId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          status: "error",
          message: "Sponsored post not found",
        });
      }

      console.error("Database error:", error);
      return res.status(500).json({
        status: "error",
        message: messages.ERROR.SERVER_ERROR,
      });
    }

    // Increment view count
    await supabaseAdmin
      .from("sponsored_posts")
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq("id", postId);

    res.json({
      status: "success",
      message: "Sponsored post retrieved successfully",
      data: {
        post: { ...data, view_count: (data.view_count || 0) + 1 },
      },
    });
  } catch (error) {
    console.error("Get sponsored post by ID error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Update sponsored post (Admin only)
const updatePost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: messages.ERROR.VALIDATION_ERROR,
        data: { errors: errors.array() },
      });
    }

    const { id } = req.params;
    const adminId = req.user.id;

    // Remove undefined values
    const cleanData = Object.fromEntries(
      Object.entries(req.body).filter(([_, v]) => v !== undefined)
    );

    // Add featured image if uploaded
    if (req.file) {
      cleanData.featured_image = req.file.path;
    }

    // Add updated timestamp
    cleanData.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("sponsored_posts")
      .update(cleanData)
      .eq("id", id)
      .select(
        `
        *,
        admin_user:admin_id (
          id, username, full_name, profile_picture
        )
      `
      )
      .single();

    if (error || !data) {
      return res.status(404).json({
        status: "error",
        message: "Sponsored post not found",
      });
    }

    // Log admin activity
    await supabaseAdmin.from("admin_activities").insert([
      {
        admin_id: adminId,
        activity_type: "sponsored_post_update",
        description: `Updated sponsored post: ${data.title}`,
        metadata: {
          post_id: id,
          changes: cleanData,
        },
      },
    ]);

    res.json({
      status: "success",
      message: "Sponsored post updated successfully",
      data: { post: data },
    });
  } catch (error) {
    console.error("Update sponsored post error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Delete sponsored post (Admin only)
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    // Get post to delete associated image from Supabase Storage
    const { data: post } = await supabaseAdmin
      .from("sponsored_posts")
      .select("featured_image, title")
      .eq("id", id)
      .single();

    const { data, error } = await supabaseAdmin
      .from("sponsored_posts")
      .delete()
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      return res.status(404).json({
        status: "error",
        message: "Sponsored post not found",
      });
    }

    // Delete image from Supabase Storage if exists
    if (post?.featured_image && post.featured_image.includes("supabase")) {
      const imagePath = post.featured_image.split("/").pop();
      await supabaseAdmin.storage
        .from("lumivox")
        .remove([`sponsored/${imagePath}`]);
    }

    // Log admin activity
    await supabaseAdmin.from("admin_activities").insert([
      {
        admin_id: adminId,
        activity_type: "sponsored_post_delete",
        description: `Deleted sponsored post: ${post?.title || "Unknown"}`,
        metadata: {
          post_id: id,
          title: post?.title,
        },
      },
    ]);

    res.json({
      status: "success",
      message: "Sponsored post deleted successfully",
    });
  } catch (error) {
    console.error("Delete sponsored post error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

 // Engage with sponsored post (reward coins)
const engagePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check if sponsored posts enabled
    const { data: enabledSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'sponsored_enabled')
      .single();

    if (enabledSetting?.setting_value === 'false') {
      return res.status(403).json({
        status: 'error',
        message: 'Sponsored Posts feature is currently disabled'
      });
    }

    // Check if sponsored post exists and is published
    const { data: post, error: postError } = await supabaseAdmin
      .from('sponsored_posts')
      .select('id, admin_id, title')
      .eq('id', postId)
      .eq('status', 'published')
      .eq('is_published', true)
      .single();

    if (postError || !post) {
      return res.status(404).json({
        status: 'error',
        message: 'Sponsored post not found or not published'
      });
    }

    // Check if user already engaged with this specific post
    const { data: existingEngagement } = await supabaseAdmin
      .from('sponsored_engagements')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .single();

    if (existingEngagement) {
      return res.status(409).json({
        status: 'error',
        message: 'You have already earned from this sponsored post'
      });
    }

    // Check if user has earned today (from ANY post)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data: todayEngagement } = await supabaseAdmin
      .from('sponsored_engagements')
      .select('id, post_id, created_at')
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString())
      .single();

    if (todayEngagement) {
      // User already earned today from a different post
      return res.status(429).json({
        status: 'error',
        message: 'You have already earned from a sponsored post today. Come back tomorrow!',
        data: {
          earned_today: true,
          next_earning_time: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
        }
      });
    }

    // Get user tier
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('user_tier')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('User fetch error:', userError);
      return res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }

    // Get reward amounts from platform settings
    const isPaidUser = ['Amateur', 'Pro'].includes(user.user_tier);
    const rewardKey = isPaidUser ? 'sponsored_reward_paid' : 'sponsored_reward_free';

    const { data: rewardSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', rewardKey)
      .single();

    const rewardAmount = parseFloat(rewardSetting?.setting_value || (isPaidUser ? 1000 : 500));

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

    if (walletError) {
      console.error('Wallet update error:', walletError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update wallet balance'
      });
    }

    // Record engagement
    const { data: engagement, error: engagementError } = await supabaseAdmin
      .from('sponsored_engagements')
      .insert([
        {
          user_id: userId,
          post_id: postId,
          reward_amount: rewardAmount
        }
      ])
      .select()
      .single();

    if (engagementError) {
      console.error('Engagement record error:', engagementError);
      // Rollback wallet update
      await supabaseAdmin
        .from('wallets')
        .update({ coins_balance: parseFloat(wallet?.coins_balance || 0) })
        .eq('user_id', userId);
      
      return res.status(500).json({
        status: 'error',
        message: 'Failed to record engagement'
      });
    }

    // Update engagement count
    await supabaseAdmin.rpc('increment_sponsored_engagement_count', {
      post_id: postId
    });

    // Log transaction
    await supabaseAdmin.from('transactions').insert([
      {
        user_id: userId,
        transaction_type: 'sponsored_post_reward',
        balance_type: 'coins_balance',
        amount: rewardAmount,
        status: 'completed',
        description: `Coins reward - ${post.title}`,
        reference: `SPONSORED-${Date.now()}-${userId.slice(-4).toUpperCase()}`,
        metadata: {
          post_id: postId,
          post_title: post.title
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      message: `Congratulations! You earned ₦${rewardAmount.toLocaleString()} coins`,
      data: {
        reward_amount: rewardAmount,
        new_coins_balance: newBalance,
        engagement: {
          id: engagement.id,
          post_id: postId,
          claimed_at: engagement.created_at
        },
        daily_limit_reached: true,
        next_earning_time: new Date(new Date().setHours(24, 0, 0, 0)).toISOString()
      }
    });
  } catch (error) {
    console.error('Engage sponsored post error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  createPost,
  getAllPosts,
  getPublishedPosts,
  getPostById,
  updatePost,
  deletePost,
 
  engagePost,
};