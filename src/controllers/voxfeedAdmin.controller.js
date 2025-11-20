 
const { supabaseAdmin } = require('../services/supabase.service');
const { validationResult } = require('express-validator');
const messages = require('../utils/constants/voxfeed');

// Get all posts for admin review
const getAllPosts = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, userId, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('voxfeed_posts')
      .select(`
        *,
        users:user_id (
          id, username, full_name, profile_picture
        ),
        reviewed_by_user:reviewed_by (
          id, username, full_name
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%, content.ilike.%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        status: 'error',
        message: messages.ERROR.SERVER_ERROR
      });
    }

    res.json({
      status: 'success',
      message: messages.SUCCESS.POSTS_RETRIEVED,
      data: {
        posts: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          has_more: count > offset + limit
        }
      }
    });
  } catch (error) {
    console.error('Admin get all posts error:', error);
    res.status(500).json({
      status: 'error',
      message: messages.ERROR.SERVER_ERROR
    });
  }
};

// Review post (approve/reject)
const reviewPost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: messages.ERROR.VALIDATION_ERROR,
        data: { errors: errors.array() }
      });
    }

    const { postId } = req.params;
    const adminId = req.user.id;
    const { status,   } = req.body;

    console.log(postId, 'postId');
    console.log(adminId, 'adminId');

    
    
    const updateData = {
      status,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString()
    };

    if (status === 'approved') {
      updateData.is_published = true;
      updateData.published_at = new Date().toISOString();
    }
 

    const { data, error } = await supabaseAdmin
      .from('voxfeed_posts')
      .update(updateData)
      .eq('id', postId)
      .select(`
        *,
        users:user_id (
          id, username, full_name, profile_picture
        ),
        reviewed_by_user:reviewed_by (
          id, username, full_name
        )
      `)
      .single();

      console.log(error);
      

    if (error || !data) {
      return res.status(404).json({
        status: 'error',
        message: messages.ERROR.POST_NOT_FOUND
      });
    }

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert([{
        admin_id: adminId,
        activity_type: 'voxfeed_post_review',
        description: `${status === 'approved' ? 'Approved' : 'Rejected'} blog post: ${data.title}`,
        metadata: {
          post_id: postId,
          status,
      
        }
      }]);

    res.json({
      status: 'success',
      message: messages.SUCCESS.POST_REVIEWED,
      data: { post: data }
    });
  } catch (error) {
    console.error('Admin review post error:', error);
    res.status(500).json({
      status: 'error',
      message: messages.ERROR.SERVER_ERROR
    });
  }
};

// Delete any post
const deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const adminId = req.user.id;
    
    // Get post details for logging
    const { data: post } = await supabaseAdmin
      .from('voxfeed_posts')
      .select('title, user_id')
      .eq('id', postId)
      .single();

    const { data, error } = await supabaseAdmin
      .from('voxfeed_posts')
      .delete()
      .eq('id', postId)
      .select('id')
      .single();

    if (error || !data) {
      return res.status(404).json({
        status: 'error',
        message: messages.ERROR.POST_NOT_FOUND
      });
    }

    // Log admin activity
    if (post) {
      await supabaseAdmin
        .from('admin_activities')
        .insert([{
          admin_id: adminId,
          activity_type: 'voxfeed_post_delete',
          description: `Deleted blog post: ${post.title}`,
          metadata: {
            post_id: postId,
            original_author: post.user_id
          }
        }]);
    }

    res.json({
      status: 'success',
      message: messages.SUCCESS.POST_DELETED
    });
  } catch (error) {
    console.error('Admin delete post error:', error);
    res.status(500).json({
      status: 'error',
      message: messages.ERROR.SERVER_ERROR
    });
  }
};

// Get all comments for moderation
const getAllComments = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, postId } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('voxfeed_comments')
      .select(`
        *,
        users:user_id (
          id, username, full_name, profile_picture
        ),
        voxfeed_posts:post_id (
          id, title 
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (postId) {
      query = query.eq('post_id', postId);
    }

    query = query.range(offset, offset + limit - 1);
    const { data, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        status: 'error',
        message: messages.ERROR.SERVER_ERROR
      });
    }

    res.json({
      status: 'success',
      message: messages.SUCCESS.COMMENTS_RETRIEVED,
      data: {
        comments: data,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          has_more: count > offset + limit
        }
      }
    });
  } catch (error) {
    console.error('Admin get all comments error:', error);
    res.status(500).json({
      status: 'error',
      message: messages.ERROR.SERVER_ERROR
    });
  }
};

// Delete comment
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const adminId = req.user.id;
    
    // Get comment details for logging
    const { data: comment } = await supabaseAdmin
      .from('voxfeed_comments')
      .select('content, user_id, post_id')
      .eq('id', commentId)
      .single();

    const { data, error } = await supabaseAdmin
      .from('voxfeed_comments')
      .delete()
      .eq('id', commentId)
      .select('id')
      .single();

    if (error || !data) {
      return res.status(404).json({
        status: 'error',
        message: messages.ERROR.COMMENT_NOT_FOUND
      });
    }

    // Log admin activity
    if (comment) {
      await supabaseAdmin
        .from('admin_activities')
        .insert([{
          admin_id: adminId,
          activity_type: 'voxfeed_comment_delete',
          description: `Deleted comment: ${comment.content.substring(0, 50)}...`,
          metadata: {
            comment_id: commentId,
            post_id: comment.post_id,
            original_author: comment.user_id
          }
        }]);
    }

    res.json({
      status: 'success',
      message: messages.SUCCESS.COMMENT_DELETED
    });
  } catch (error) {
    console.error('Admin delete comment error:', error);
    res.status(500).json({
      status: 'error',
      message: messages.ERROR.SERVER_ERROR
    });
  }
};

// VOXFeed statistics
const getStatistics = async (req, res) => {
  try {
    // Get post statistics
    const { data: allPosts } = await supabaseAdmin
      .from('voxfeed_posts')
      .select('status, category, created_at');

    const postStats = allPosts?.reduce((acc, post) => {
      acc[post.status] = (acc[post.status] || 0) + 1;
      return acc;
    }, {}) || {};

    // Get total comments
    const { count: totalComments } = await supabaseAdmin
      .from('voxfeed_comments')
      .select('*', { count: 'exact', head: true });

    // Get recent activity (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { count: recentPosts } = await supabaseAdmin
      .from('voxfeed_posts')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    const { count: recentComments } = await supabaseAdmin
      .from('voxfeed_comments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());

    // Get category statistics
    const { data: publishedPosts } = await supabaseAdmin
      .from('voxfeed_posts')
      .select('category')
      .eq('status', 'approved')
      .eq('is_published', true);

    const categoryStats = publishedPosts?.reduce((acc, post) => {
      acc[post.category] = (acc[post.category] || 0) + 1;
      return acc;
    }, {}) || {};

    const statistics = {
      posts: {
        total: allPosts?.length || 0,
        pending: postStats.pending || 0,
        approved: postStats.approved || 0,
        rejected: postStats.rejected || 0,
        draft: postStats.draft || 0,
        recent_week: recentPosts || 0
      },
      comments: {
        total: totalComments || 0,
        recent_week: recentComments || 0
      },
      categories: categoryStats,
      engagement: {
        total_views: 0 // Could be calculated from post view counts
      }
    };

    res.json({
      status: 'success',
      message: messages.SUCCESS.STATISTICS_RETRIEVED,
      data: { statistics }
    });
  } catch (error) {
    console.error('Admin get statistics error:', error);
    res.status(500).json({
      status: 'error',
      message: messages.ERROR.SERVER_ERROR
    });
  }
};

// Bulk operations
const bulkDeletePosts = async (req, res) => {
  try {
    const { postIds } = req.body;
    const adminId = req.user.id;
    
    if (!Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: messages.ERROR.INVALID_POST_IDS
      });
    }

    const { data, error } = await supabaseAdmin
      .from('voxfeed_posts')
      .delete()
      .in('id', postIds)
      .select('id, title');

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        status: 'error',
        message: messages.ERROR.SERVER_ERROR
      });
    }

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert([{
        admin_id: adminId,
        activity_type: 'voxfeed_bulk_delete',
        description: `Bulk deleted ${data.length} blog posts`,
        metadata: {
          deleted_posts: data.map(p => ({ id: p.id, title: p.title })),
          count: data.length
        }
      }]);

    res.json({
      status: 'success',
      message: messages.SUCCESS.BULK_DELETE_COMPLETED,
      data: {
        deleted_count: data.length,
        deleted_posts: data
      }
    });
  } catch (error) {
    console.error('Admin bulk delete posts error:', error);
    res.status(500).json({
      status: 'error',
      message: messages.ERROR.SERVER_ERROR
    });
  }
};

module.exports = {
  getAllPosts,
  reviewPost,
  deletePost,
  getAllComments,
  deleteComment,
  getStatistics,
  bulkDeletePosts
};