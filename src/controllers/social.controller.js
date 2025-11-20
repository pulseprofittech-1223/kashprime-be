const {supabaseAdmin} = require('../services/supabase.service');
const { validationResult } = require('express-validator');
const SOCIAL_BOOST_MESSAGES = require('../utils/constants/social');

/**
 * Submit a social media boost application
 * POST /api/social/apply
 */
const submitBoostApplication = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.VALIDATION_ERROR,
        data: { errors: errors.array() }
      });
    }

    const { platform, username, phoneNumber, currentFollowers, desiredFollowers } = req.body;
    const userId = req.user.id;

    // Check if user already has a pending application for this platform
    const { data: existingApplication, error: checkError } = await supabaseAdmin
      .from('social_media_boosts')
      .select('id, status, created_at')
      .eq('user_id', userId)
      .eq('platform', platform.toLowerCase())
      .in('status', ['pending', 'approved'])
      .single();
  
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing application:', checkError);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.DATABASE_ERROR
      });
    }

    if (existingApplication) {
      const statusMessage = existingApplication.status === 'pending' 
        ? SOCIAL_BOOST_MESSAGES.ERROR.DUPLICATE_APPLICATION_PENDING
        : SOCIAL_BOOST_MESSAGES.ERROR.DUPLICATE_APPLICATION_APPROVED;
      return res.status(400).json({
        status: 'error',
        message: statusMessage
      });
    }

    // Create new boost application
    const { data: newApplication, error: insertError } = await supabaseAdmin
      .from('social_media_boosts')
      .insert({
        user_id: userId,
        platform: platform.toLowerCase(),
        username: username,
        phone_number: phoneNumber,
        current_followers: parseInt(currentFollowers),
        desired_followers: parseInt(desiredFollowers),
        status: 'pending'
      })
      .select(`
        id,
        platform,
        username,
        phone_number,
        current_followers,
        desired_followers,
        status,
        created_at
      `)
      .single();

    if (insertError) {
      console.error('Error creating boost application:', insertError);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_SUBMIT
      });
    }

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: userId,
        activity_type: 'boost_application_submitted',
        description: `User submitted ${platform} boost application`,
        metadata: {
          application_id: newApplication.id,
          platform: platform,
          desired_followers: desiredFollowers
        }
      });

    return res.status(201).json({
      status: 'success',
      message: SOCIAL_BOOST_MESSAGES.SUCCESS.APPLICATION_SUBMITTED,
      data: newApplication
    });

  } catch (error) {
    console.error('Error in submitBoostApplication:', error);
    return res.status(500).json({
      status: 'error',
      message: SOCIAL_BOOST_MESSAGES.ERROR.SERVER_ERROR
    });
  }
};

/**
 * Get user's boost applications
 * GET /api/social/my-applications
 */
const getUserBoostApplications = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, platform, status } = req.query;
    
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('social_media_boosts')
      .select(`
        id,
        platform,
        username,
        phone_number,
        current_followers,
        desired_followers,
        status,
        admin_notes,
        reviewed_at,
        created_at,
        updated_at
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters if provided
    if (platform) {
      query = query.eq('platform', platform.toLowerCase());
    }
    if (status) {
      query = query.eq('status', status.toLowerCase());
    }

    const { data: applications, error } = await query;

    if (error) {
      console.error('Error fetching user applications:', error);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_FETCH
      });
    }

    // Get total count for pagination
    let countQuery = supabaseAdmin
      .from('social_media_boosts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (platform) countQuery = countQuery.eq('platform', platform.toLowerCase());
    if (status) countQuery = countQuery.eq('status', status.toLowerCase());

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting applications:', countError);
    }

    const hasMore = offset + limit < (count || 0);

    return res.status(200).json({
      status: 'success',
      message: SOCIAL_BOOST_MESSAGES.SUCCESS.APPLICATIONS_RETRIEVED,
      data: {
        applications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          has_more: hasMore
        }
      }
    });

  } catch (error) {
    console.error('Error in getUserBoostApplications:', error);
    return res.status(500).json({
      status: 'error',
      message: SOCIAL_BOOST_MESSAGES.ERROR.SERVER_ERROR
    });
  }
};

/**
 * Get single boost application details
 * GET /api/social/application/:id
 */
const getBoostApplicationDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(id);
    

    const { data: application, error } = await supabaseAdmin
      .from('social_media_boosts')
      .select(`
        id,
        platform,
        username,
        phone_number,
        current_followers,
        desired_followers,
        status,
        admin_notes,
        reviewed_at,
        created_at,
        updated_at,
        reviewed_by,
        users!reviewed_by(username, full_name)
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          status: 'error',
          message: SOCIAL_BOOST_MESSAGES.ERROR.APPLICATION_NOT_FOUND
        });
      }
      console.error('Error fetching application details:', error);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_FETCH_DETAILS
      });
    }

    return res.status(200).json({
      status: 'success',
      message: SOCIAL_BOOST_MESSAGES.SUCCESS.APPLICATION_DETAILS_RETRIEVED,
      data: application
    });

  } catch (error) {
    console.error('Error in getBoostApplicationDetails:', error);
    return res.status(500).json({
      status: 'error',
      message: SOCIAL_BOOST_MESSAGES.ERROR.SERVER_ERROR
    });
  }
};

/**
 * Get all boost applications (Admin only)
 * GET /api/social/admin/applications
 */
const getAllBoostApplications = async (req, res) => {
  try {
    const { page = 1, limit = 20, platform, status, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('social_media_boosts')
      .select(`
        id,
        platform,
        username,
        phone_number,
        current_followers,
        desired_followers,
        status,
        admin_notes,
        reviewed_at,
        created_at,
        updated_at,
        users!user_id(
          id,
          username,
          full_name,
          email,
          user_tier
        ),
        reviewer:users!reviewed_by(
          username,
          full_name
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (platform) {
      query = query.eq('platform', platform.toLowerCase());
    }
    if (status) {
      query = query.eq('status', status.toLowerCase());
    }

    const { data: applications, error } = await query;

    if (error) {
      console.error('Error fetching all applications:', error);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_FETCH
      });
    }

    // Filter by search term if provided
    let filteredApplications = applications;
    if (search) {
      const searchTerm = search.toLowerCase();
      filteredApplications = applications.filter(app => 
        app.username.toLowerCase().includes(searchTerm) ||
        app.users?.username?.toLowerCase().includes(searchTerm) ||
        app.users?.full_name?.toLowerCase().includes(searchTerm) ||
        app.users?.email?.toLowerCase().includes(searchTerm)
      );
    }

    // Get total count for pagination
    let countQuery = supabaseAdmin
      .from('social_media_boosts')
      .select('id', { count: 'exact', head: true });

    if (platform) countQuery = countQuery.eq('platform', platform.toLowerCase());
    if (status) countQuery = countQuery.eq('status', status.toLowerCase());

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error counting applications:', countError);
    }

    const hasMore = offset + limit < (count || 0);

    return res.status(200).json({
      status: 'success',
      message: SOCIAL_BOOST_MESSAGES.SUCCESS.APPLICATIONS_RETRIEVED,
      data: {
        applications: filteredApplications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count || 0,
          has_more: hasMore
        }
      }
    });

  } catch (error) {
    console.error('Error in getAllBoostApplications:', error);
    return res.status(500).json({
      status: 'error',
      message: SOCIAL_BOOST_MESSAGES.ERROR.SERVER_ERROR
    });
  }
};

/**
 * Review boost application (Admin only)
 * PUT /api/social/admin/review/:id
 */
const reviewBoostApplication = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.VALIDATION_ERROR,
        data: { errors: errors.array() }
      });
    }

    const { id } = req.params;
    const { status, adminNotes } = req.body;
    const adminId = req.user.id;

    // Verify application exists and is in pending status
    const { data: existingApp, error: fetchError } = await supabaseAdmin
      .from('social_media_boosts')
      .select('id, status, user_id, platform, desired_followers')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          status: 'error',
          message: SOCIAL_BOOST_MESSAGES.ERROR.APPLICATION_NOT_FOUND
        });
      }
      console.error('Error fetching application:', fetchError);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_FETCH
      });
    }

    if (existingApp.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.APPLICATION_ALREADY_REVIEWED
      });
    }

    // Update application status
    const { data: updatedApp, error: updateError } = await supabaseAdmin
      .from('social_media_boosts')
      .update({
        status: status,
        admin_notes: adminNotes || null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', id)
      .select(`
        id,
        platform,
        username,
        current_followers,
        desired_followers,
        status,
        admin_notes,
        reviewed_at,
        users!user_id(username, full_name, email)
      `)
      .single();

    if (updateError) {
      console.error('Error updating application:', updateError);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_UPDATE
      });
    }

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: adminId,
        activity_type: 'boost_application_reviewed',
        description: `Admin reviewed ${existingApp.platform} boost application`,
        metadata: {
          application_id: id,
          status: status,
          platform: existingApp.platform,
          user_id: existingApp.user_id
        }
      });

    // Get status-specific success message
    let successMessage = SOCIAL_BOOST_MESSAGES.SUCCESS.APPLICATION_REVIEWED;
    if (status === 'approved') {
      successMessage = SOCIAL_BOOST_MESSAGES.SUCCESS.APPLICATION_APPROVED;
    } else if (status === 'declined') {
      successMessage = SOCIAL_BOOST_MESSAGES.SUCCESS.APPLICATION_DECLINED;
    } else if (status === 'completed') {
      successMessage = SOCIAL_BOOST_MESSAGES.SUCCESS.APPLICATION_COMPLETED;
    }

    return res.status(200).json({
      status: 'success',
      message: successMessage,
      data: updatedApp
    });

  } catch (error) {
    console.error('Error in reviewBoostApplication:', error);
    return res.status(500).json({
      status: 'error',
      message: SOCIAL_BOOST_MESSAGES.ERROR.SERVER_ERROR
    });
  }
};

/**
 * Get boost statistics (Admin only)
 * GET /api/social/admin/statistics
 */
const getBoostStatistics = async (req, res) => {
  try {
    // Get overall statistics
    const { data: stats, error: statsError } = await supabaseAdmin
      .from('social_media_boosts')
      .select('platform, status')
      .order('created_at', { ascending: false });

    if (statsError) {
      console.error('Error fetching boost statistics:', statsError);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_FETCH_STATISTICS
      });
    }

    // Process statistics
    const platformStats = {};
    const statusStats = { pending: 0, approved: 0, declined: 0, completed: 0 };
    let totalApplications = 0;

    stats.forEach(app => {
      totalApplications++;
      
      // Count by platform
      if (!platformStats[app.platform]) {
        platformStats[app.platform] = { total: 0, pending: 0, approved: 0, declined: 0, completed: 0 };
      }
      platformStats[app.platform].total++;
      platformStats[app.platform][app.status]++;
      
      // Count by status
      statusStats[app.status]++;
    });

    // Get recent applications (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentStats, error: recentError } = await supabaseAdmin
      .from('social_media_boosts')
      .select('id')
      .gte('created_at', sevenDaysAgo.toISOString());

    if (recentError) {
      console.error('Error fetching recent statistics:', recentError);
    }

    return res.status(200).json({
      status: 'success',
      message: SOCIAL_BOOST_MESSAGES.SUCCESS.STATISTICS_RETRIEVED,
      data: {
        total_applications: totalApplications,
        status_breakdown: statusStats,
        platform_breakdown: platformStats,
        recent_applications_7_days: recentStats?.length || 0
      }
    });

  } catch (error) {
    console.error('Error in getBoostStatistics:', error);
    return res.status(500).json({
      status: 'error',
      message: SOCIAL_BOOST_MESSAGES.ERROR.SERVER_ERROR
    });
  }
};

/**
 * Delete boost application (User can delete pending applications)
 * DELETE /api/social/application/:id
 */
const deleteBoostApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if application exists and belongs to user
    const { data: application, error: fetchError } = await supabaseAdmin
      .from('social_media_boosts')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({
          status: 'error',
          message: SOCIAL_BOOST_MESSAGES.ERROR.APPLICATION_NOT_FOUND
        });
      }
      console.error('Error fetching application:', fetchError);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_FETCH
      });
    }

    // Only allow deletion of pending applications
    if (application.status !== 'pending') {
      return res.status(400).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.ONLY_PENDING_CAN_DELETE
      });
    }

    // Delete the application
    const { error: deleteError } = await supabaseAdmin
      .from('social_media_boosts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting application:', deleteError);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_DELETE
      });
    }

    return res.status(200).json({
      status: 'success',
      message: SOCIAL_BOOST_MESSAGES.SUCCESS.APPLICATION_DELETED
    });

  } catch (error) {
    console.error('Error in deleteBoostApplication:', error);
    return res.status(500).json({
      status: 'error',
      message: SOCIAL_BOOST_MESSAGES.ERROR.SERVER_ERROR
    });
  }
};

/**
 * Bulk delete applications (Admin only)
 * DELETE /api/social/admin/bulk-delete
 */
const bulkDeleteApplications = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.VALIDATION_ERROR,
        data: { errors: errors.array() }
      });
    }

    const { applicationIds } = req.body;
    const adminId = req.user.id;

    // Verify all applications exist and are eligible for deletion
    const { data: applications, error: fetchError } = await supabaseAdmin
      .from('social_media_boosts')
      .select('id, status, platform, user_id')
      .in('id', applicationIds);

    if (fetchError) {
      console.error('Error fetching applications for bulk delete:', fetchError);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_FETCH
      });
    }

    if (applications.length !== applicationIds.length) {
      return res.status(404).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.SOME_APPLICATIONS_NOT_FOUND
      });
    }

    // Check if any applications are not in deletable status
    const nonDeletableApps = applications.filter(app => 
      app.status === 'completed' || app.status === 'approved'
    );

    if (nonDeletableApps.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: `${SOCIAL_BOOST_MESSAGES.ERROR.CANNOT_DELETE_APPROVED_COMPLETED}. Found ${nonDeletableApps.length} non-deletable applications.`
      });
    }

    // Perform bulk delete
    const { error: deleteError } = await supabaseAdmin
      .from('social_media_boosts')
      .delete()
      .in('id', applicationIds);

    if (deleteError) {
      console.error('Error bulk deleting applications:', deleteError);
      return res.status(500).json({
        status: 'error',
        message: SOCIAL_BOOST_MESSAGES.ERROR.FAILED_TO_DELETE
      });
    }

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert({
        admin_id: adminId,
        activity_type: 'bulk_delete_boost_applications',
        description: `Admin bulk deleted ${applicationIds.length} boost applications`,
        metadata: {
          deleted_count: applicationIds.length,
          application_ids: applicationIds
        }
      });

    return res.status(200).json({
      status: 'success',
      message: `${SOCIAL_BOOST_MESSAGES.SUCCESS.BULK_DELETE_SUCCESS} (${applicationIds.length} applications)`
    });

  } catch (error) {
    console.error('Error in bulkDeleteApplications:', error);
    return res.status(500).json({
      status: 'error',
      message: SOCIAL_BOOST_MESSAGES.ERROR.SERVER_ERROR
    });
  }
};

 

module.exports = {
  submitBoostApplication,
  getUserBoostApplications,
  getBoostApplicationDetails,
  getAllBoostApplications,
  reviewBoostApplication,
  getBoostStatistics,
  deleteBoostApplication,
  bulkDeleteApplications,
 
};