 

const { supabaseAdmin } = require('../services/supabase.service');
const messages = require('../utils/constants/voxfeed');

// Middleware to check if user can create posts
const checkPostCreationLimits = async (req, res, next) => {  
  try {
    const userId = req.user.id;
    const userTier = req.user.user_tier;
    
    // Get user's posts count for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count, error } = await supabaseAdmin
      .from('voxfeed_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());
    
    if (error) {
      console.error('Error checking post limits:', error);
      return next(); // Continue even if check fails
    }

    // Set limits based on user tier
    let dailyLimit;
    switch (userTier) {
      case 'Pro':
        dailyLimit = 5;
        break;
      case 'Amateur':
        dailyLimit = 3;
        break;
      default: // Free users
        dailyLimit = 1;
    }
    
    if (count >= dailyLimit) {
      return res.status(429).json({
        status: 'error',
        message: `Daily post limit reached. ${userTier} users can create ${dailyLimit} posts per day.`,
        data: {
          limit: dailyLimit,
          used: count,
          tier: userTier
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Check post creation limits error:', error);
    next(); // Continue even if check fails
  }
};

// Middleware to check if user can comment
const checkCommentLimits = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userTier = req.user.user_tier;
    
    // Get user's comments count for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const { count, error } = await supabaseAdmin
      .from('voxfeed_comments')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', today.toISOString());
    
    if (error) {
      console.error('Error checking comment limits:', error);
      return next(); // Continue even if check fails
    }

    // Set limits based on user tier
    let dailyLimit;
    switch (userTier) {
      case 'Pro':
        dailyLimit = 50;
        break;
      case 'Amateur':
        dailyLimit = 20;
        break;
      default: // Free users
        dailyLimit = 10;
    }
    
    if (count >= dailyLimit) {
      return res.status(429).json({
        status: 'error',
        message: `Daily comment limit reached. ${userTier} users can create ${dailyLimit} comments per day.`,
        data: {
          limit: dailyLimit,
          used: count,
          tier: userTier
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('Check comment limits error:', error);
    next(); // Continue even if check fails
  }
};

// Middleware to validate post ownership
const validatePostOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const { data: post, error } = await supabaseAdmin
      .from('voxfeed_posts')
      .select('user_id')
      .eq('id', id)
      .single();
    
    if (error || !post) {
      return res.status(404).json({
        status: 'error',
        message: messages.ERROR.POST_NOT_FOUND
      });
    }
    
    if (post.user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: messages.ERROR.FORBIDDEN
      });
    }
    
    next();
  } catch (error) {
    console.error('Validate post ownership error:', error);
    res.status(500).json({
      status: 'error',
      message: messages.ERROR.SERVER_ERROR
    });
  }
};

// Middleware to validate comment ownership
const validateCommentOwnership = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;
    
    const { data: comment, error } = await supabaseAdmin
      .from('voxfeed_comments')
      .select('user_id')
      .eq('id', commentId)
      .single();
    
    if (error || !comment) {
      return res.status(404).json({
        status: 'error',
        message: messages.ERROR.COMMENT_NOT_FOUND
      });
    }
    
    if (comment.user_id !== userId) {
      return res.status(403).json({
        status: 'error',
        message: messages.ERROR.FORBIDDEN
      });
    }
    
    next();
  } catch (error) {
    console.error('Validate comment ownership error:', error);
    res.status(500).json({
      status: 'error',
      message: messages.ERROR.SERVER_ERROR
    });
  }
};

// Middleware to check if post exists and is published
const validatePublishedPost = async (req, res, next) => {
  try {
    const { slug, postId } = req.params;
    const identifier = slug || postId;
    const field = slug ? 'slug' : 'id';
    
    const { data: post, error } = await supabaseAdmin
      .from('voxfeed_posts')
      .select('id, status, is_published')
      .eq(field, identifier)
      .single();
    
    if (error || !post) {
      return res.status(404).json({
        status: 'error',
        message: messages.ERROR.POST_NOT_FOUND
      });
    }
    
    if (post.status !== 'approved' || !post.is_published) {
      return res.status(404).json({
        status: 'error',
        message: messages.ERROR.POST_NOT_FOUND
      });
    }
    
    req.postId = post.id;
    next();
  } catch (error) {
    console.error('Validate published post error:', error);
    res.status(500).json({
      status: 'error',
      message: messages.ERROR.SERVER_ERROR
    });
  }
};

// Middleware to sanitize HTML content
const sanitizeContent = (req, res, next) => {
    
  if (req.body.content) {
    // Enhanced HTML sanitization
    req.body.content = req.body.content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/<iframe\b[^>]*>/gi, '')
      .replace(/<object\b[^>]*>/gi, '')
      .replace(/<embed\b[^>]*>/gi, '')
      .replace(/<link\b[^>]*>/gi, '')
      .replace(/<meta\b[^>]*>/gi, '');
  }
  
  // Sanitize comment content
  if (req.body.comment) {
    req.body.comment = req.body.comment
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  }
  
  next();
};

// Middleware to validate file upload before processing
const validateImageUpload = (req, res, next) => {
  if (!req.file) {
    return next();
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid file type. Only images (JPEG, PNG, GIF, WebP) are allowed.'
    });
  }

  if (req.file.size > maxSize) {
    return res.status(400).json({
      status: 'error',
      message: 'File too large. Maximum size is 5MB.'
    });
  }

  next();
};

 

 

module.exports = {
  checkPostCreationLimits,
  checkCommentLimits,
  validatePostOwnership,
  validateCommentOwnership,
  validatePublishedPost,
  sanitizeContent,
  validateImageUpload,
};