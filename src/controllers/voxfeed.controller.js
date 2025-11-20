const { supabaseAdmin } = require("../services/supabase.service");
const { validationResult } = require("express-validator");
const messages = require("../utils/constants/voxfeed");

// Create new blog post
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

    const userId = req.user.id;

    const { data, error } = await supabaseAdmin
      .from("voxfeed_posts")
      .insert([
        {
          user_id: userId,
          title: req.body.title,
          content: req.body.content,
          featured_image: req.file ? req.file.path : null,
          category: req.body.category || "general",
          status: "pending",
        },
      ])
      .select(
        `
        *,
        users:user_id (
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

    res.status(201).json({
      status: "success",
      message: messages.SUCCESS.POST_CREATED,
      data: { post: data },
    });
  } catch (error) {
    console.error("Create post error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Get user's posts
const getUserPosts = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("voxfeed_posts")
      .select(
        `
        *,
        users:user_id (
          id, username, full_name, profile_picture
        )
      `,
        { count: "exact" }
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

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
      message: messages.SUCCESS.POSTS_RETRIEVED,
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
    console.error("Get user posts error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Get published posts (public feed)
const getPublishedPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      search,
      sort = "latest",
    } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("voxfeed_posts")
      .select(
        `
        *,
        users:user_id (
          id, username, full_name, profile_picture
        )
      `,
        { count: "exact" }
      )
      .eq("status", "approved")
      .eq("is_published", true);

    // Category filter
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // Search functionality
    if (search) {
      query = query.or(`title.ilike.%${search}%, content.ilike.%${search}%`);
    }

    // Sorting
    switch (sort) {
      case "popular":
        query = query.order("view_count", { ascending: false });
        break;
      case "commented":
        query = query.order("comment_count", { ascending: false });
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
      message: messages.SUCCESS.POSTS_RETRIEVED,
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
    console.error("Get published posts error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Get post by ID
const getPostById = async (req, res) => {
  try {
    const postId = req.params.postId;

    const { data, error } = await supabaseAdmin
      .from("voxfeed_posts")
      .select(
        `
        *,
        user:user_id (
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
          message: "Post not found",
        });
      }

      console.error("Database error:", error);
      return res.status(500).json({
        status: "error",
        message: messages.ERROR.SERVER_ERROR,
      });
    }

    res.json({
      status: "success",
      message: "Post retrieved successfully",
      data: {
        post: data,
      },
    });
  } catch (error) {
    console.error("Get post by ID error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Update post
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
    const userId = req.user.id;

    // Remove undefined values
    const cleanData = Object.fromEntries(
      Object.entries(req.body).filter(([_, v]) => v !== undefined)
    );

    // Add featured image if uploaded
    if (req.file) {
      cleanData.featured_image = req.file.path;
    }

    // Reset status to pending if content changed
    if (cleanData.content || cleanData.title) {
      cleanData.status = "pending";
      cleanData.reviewed_by = null;
      cleanData.reviewed_at = null;
    }

    const { data, error } = await supabaseAdmin
      .from("voxfeed_posts")
      .update(cleanData)
      .eq("id", id)
      .eq("user_id", userId)
      .select(
        `
        *,
        users:user_id (
          id, username, full_name, profile_picture
        )
      `
      )
      .single();

    if (error || !data) {
      return res.status(404).json({
        status: "error",
        message: messages.ERROR.POST_NOT_FOUND,
      });
    }

    res.json({
      status: "success",
      message: messages.SUCCESS.POST_UPDATED,
      data: { post: data },
    });
  } catch (error) {
    console.error("Update post error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Delete post
const deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get post to delete associated image from Supabase Storage
    const { data: post } = await supabaseAdmin
      .from("voxfeed_posts")
      .select("featured_image")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    const { data, error } = await supabaseAdmin
      .from("voxfeed_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", userId)
      .select("id")
      .single();

    if (error || !data) {
      return res.status(404).json({
        status: "error",
        message: messages.ERROR.POST_NOT_FOUND,
      });
    }

    // Delete image from Supabase Storage if exists
    if (post?.featured_image && post.featured_image.includes("supabase")) {
      const imagePath = post.featured_image.split("/").pop();
      await supabaseAdmin.storage
        .from("uploads")
        .remove([`voxfeed/${imagePath}`]);
    }

    res.json({
      status: "success",
      message: messages.SUCCESS.POST_DELETED,
    });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Add comment to post
const addComment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: "error",
        message: messages.ERROR.VALIDATION_ERROR,
        data: { errors: errors.array() },
      });
    }

    const { postId } = req.params;
    const userId = req.user.id;
    const { content, parentId } = req.body;

    const { data, error } = await supabaseAdmin
      .from("voxfeed_comments")
      .insert([
        {
          post_id: postId,
          user_id: userId,
          content,
          parent_id: parentId || null,
        },
      ])
      .select(
        `
        *,
        users:user_id (
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

    res.status(201).json({
      status: "success",
      message: messages.SUCCESS.COMMENT_ADDED,
      data: { comment: data },
    });
  } catch (error) {
    console.error("Add comment error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Get post comments
const getPostComments = async (req, res) => {
  try {
    const { postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from("voxfeed_comments")
      .select(
        `
        *,
        users:user_id (
          id, username, full_name, profile_picture
        )
      `,
        { count: "exact" }
      )
      .eq("post_id", postId)
      .eq("status", "approved")
      .eq("is_deleted", false)
      .is("parent_id", null) // Only top-level comments
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Database error:", error);
      return res.status(500).json({
        status: "error",
        message: messages.ERROR.SERVER_ERROR,
      });
    }

    // Get replies for each comment
    for (let comment of data) {
      const { data: replies } = await supabaseAdmin
        .from("voxfeed_comments")
        .select(
          `
          *,
          users:user_id (
            id, username, full_name, profile_picture
          )
        `
        )
        .eq("parent_id", comment.id)
        .eq("status", "approved")
        .eq("is_deleted", false)
        .order("created_at", { ascending: true });

      comment.replies = replies || [];
    }

    res.json({
      status: "success",
      message: messages.SUCCESS.COMMENTS_RETRIEVED,
      data: {
        comments: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          has_more: count > offset + limit,
        },
      },
    });
  } catch (error) {
    console.error("Get comments error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};

// Get available categories
const getCategories = async (req, res) => {
  try {
    // Get distinct categories from posts
    const { data, error } = await supabaseAdmin
      .from("voxfeed_posts")
      .select("*")
      .eq("status", "approved")
      .eq("is_published", true);

    console.log(data, error);

    if (error) {
      console.log("Database error:", error);
      return res.status(500).json({
        status: "error",
        message: messages.ERROR.SERVER_ERROR,
      });
    }

    // Get unique categories and add default ones
    const usedCategories = [...new Set(data.map((post) => post.category))];
    const defaultCategories = [
      "general",
      "technology",
      "business",
      "lifestyle",
      "health",
      "finance",
      "education",
      "entertainment",
      "sports",
      "travel",
      "food",
    ];

    // Combine and remove duplicates
    const allCategories = [
      ...new Set([...defaultCategories, ...usedCategories]),
    ];

    const categories = allCategories.map((category) => ({
      value: category,
      label: category.charAt(0).toUpperCase() + category.slice(1),
      count: data.filter((post) => post.category === category).length,
    }));

    res.json({
      status: "success",
      message: messages.SUCCESS.CATEGORIES_RETRIEVED,
      data: { categories },
    });
  } catch (error) {
    console.error("Get categories error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};


// Engage with post (reward VOXcoin)
const engagePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user.id;

    // Check if post exists and is published
    const { data: post, error: postError } = await supabaseAdmin
      .from("voxfeed_posts")
      .select("id, user_id")
      .eq("id", postId)
      .eq("status", "approved")
      .eq("is_published", true)
      .single();

    if (postError || !post) {
      return res.status(404).json({
        status: "error",
        message: "Post not found or not published",
      });
    }

    // Check if user already engaged with this post today
    const { data: existingEngagement } = await supabaseAdmin
      .from("voxfeed_engagements")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .eq("engagement_date", new Date().toISOString().split('T')[0])
      .single();

    if (existingEngagement) {
      return res.status(409).json({
        status: "error",
        message: "You have already engaged with this post today",
      });
    }

    // Get user tier and fetch reward amount from platform settings
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("user_tier")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("User fetch error:", userError);
      return res.status(500).json({
        status: "error",
        message: messages.ERROR.SERVER_ERROR,
      });
    }

    // Get reward amounts from platform settings
    const { data: settings, error: settingsError } = await supabaseAdmin
      .from("platform_settings")
      .select("setting_value")
      .in("setting_key", [
        "voxfeed_engage_reward_amateur",
        "voxfeed_engage_reward_pro",
      ]);

    if (settingsError) {
      console.error("Settings fetch error:", settingsError);
      return res.status(500).json({
        status: "error",
        message: messages.ERROR.SERVER_ERROR,
      });
    }

    // Parse reward amounts
    const amateurReward =
      parseFloat(
        settings.find((s) => s.setting_key === "voxfeed_engage_reward_amateur")
          ?.setting_value
      ) || 400;
    const proReward =
      parseFloat(
        settings.find((s) => s.setting_key === "voxfeed_engage_reward_pro")
          ?.setting_value
      ) || 800;

    const rewardAmount = user.user_tier === "Pro" ? proReward : amateurReward;

    // Update user's VOXcoin balance
    const { error: walletError } = await supabaseAdmin.rpc(
      "increment_voxcoin_balance",
      {
        p_user_id: userId,
        p_amount: rewardAmount,
      }
    );

    if (walletError) {
      console.error("Wallet update error:", walletError);
      return res.status(500).json({
        status: "error",
        message: "Failed to update wallet balance",
      });
    }

    // Record engagement
    const { data: engagement, error: engagementError } = await supabaseAdmin
      .from("voxfeed_engagements")
      .insert([
        {
          user_id: userId,
          post_id: postId,
          reward_amount: rewardAmount,
        },
      ])
      .select()
      .single();

    if (engagementError) {
      console.error("Engagement record error:", engagementError);
      // Don't return error here since wallet was already updated
    }

    // Log transaction
    await supabaseAdmin.from("transactions").insert([
      {
        user_id: userId,
        transaction_type: "reward",
        earning_type: "voxfeed_engagement",
        amount: rewardAmount,
        status: "completed",
        description: `VOXcoin reward for engaging with post`,
        reference: `VOXFEED-${Date.now()}`,
      },
    ]);

    // Get updated wallet balance
    const { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("voxcoin_balance")
      .eq("user_id", userId)
      .single();

    res.status(200).json({
      status: "success",
      message: `Congratulations! You earned ₦${rewardAmount.toLocaleString()} VOXcoin`,
      data: {
        reward_amount: rewardAmount,
        new_voxcoin_balance: wallet?.voxcoin_balance || 0,
        engagement: engagement,
      },
    });
  } catch (error) {
    console.error("Engage post error:", error);
    res.status(500).json({
      status: "error",
      message: messages.ERROR.SERVER_ERROR,
    });
  }
};


module.exports = {
  createPost,
  getUserPosts,
  getPublishedPosts,
  updatePost,
  deletePost,
  addComment,
  getPostComments,
  getCategories,
  getPostById,engagePost
};
