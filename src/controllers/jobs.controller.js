const { supabaseAdmin } = require('../services/supabase.service');
const { validationResult } = require('express-validator');

// Get all jobs 
const getAllJobs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      job_type,
      location,
      company,
      search,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = supabaseAdmin
      .from('jobs')
      .select(`
      *
      `, { count: 'exact' })
      .eq('is_active', true);

    // Apply filters
    if (job_type) {
      query = query.eq('job_type', job_type);
    }

    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    if (company) {
      query = query.ilike('hiring_company', `%${company}%`);
    }

    if (search) {
      query = query.or(`job_title.ilike.%${search}%,hiring_company.ilike.%${search}%,job_description.ilike.%${search}%`);
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: jobs, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch jobs'
      });
    }

    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      status: 'success',
      message: 'Jobs retrieved successfully',
      data: {
        jobs,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_jobs: count,
          has_next: page < totalPages,
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get all jobs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get single job by ID (public endpoint)
const getJobById = async (req, res) => {
  try {
    const { id } = req.params;

 

    // Get job details
    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .select(`
        *,
        posted_by_user:posted_by(username, full_name)
      `)
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !job) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Job retrieved successfully',
      data: { job }
    });
  } catch (error) {
    console.error('Get job by ID error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Create new job (admin )
const createJob = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        data: { errors: errors.array() }
      });
    }

    const {
      job_title,
      hiring_company,
      company_logo,
      job_type,
      application_link,
      job_description,
      location,
      salary_range,
      experience_level
    } = req.body;

    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .insert([{
        job_title,
        hiring_company,
        company_logo,
        job_type,
        application_link,
        job_description,
        location,
        salary_range,
        experience_level,
        posted_by: req.user.id,
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to create job'
      });
    }

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert([{
        admin_id: req.user.id,
        activity_type: 'job_created',
        description: `Created job: ${job_title} at ${hiring_company}`,
        metadata: { job_id: job.id, job_title, hiring_company }
      }]);

    res.status(201).json({
      status: 'success',
      message: 'Job created successfully',
      data: { job }
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Update job (admin  )
const updateJob = async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: 'error',
        message: 'Validation error',
        data: { errors: errors.array() }
      });
    }

    const { id } = req.params;
    const updateData = req.body;

    // Check if job exists
    const { data: existingJob, error: fetchError } = await supabaseAdmin
      .from('jobs')
      .select('id, job_title, hiring_company')
      .eq('id', id)
      .single();

    if (fetchError || !existingJob) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found'
      });
    }

    // Update job
    const { data: job, error } = await supabaseAdmin
      .from('jobs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to update job'
      });
    }

    // Log admin activity
    await supabaseAdmin
      .from('admin_activities')
      .insert([{
        admin_id: req.user.id,
        activity_type: 'job_updated',
        description: `Updated job: ${existingJob.job_title} at ${existingJob.hiring_company}`,
        metadata: { job_id: id, updated_fields: Object.keys(updateData) }
      }]);

    res.status(200).json({
      status: 'success',
      message: 'Job updated successfully',
      data: { job }
    });
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Delete job (admin  )
const deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    // Confirm the job exists 
    const { data: existingJob, error: fetchError } = await supabaseAdmin
      .from('jobs')
      .select('id, job_title, hiring_company')
      .eq('id', id)
      .single();

    if (fetchError || !existingJob) {
      return res.status(404).json({
        status: 'error',
        message: 'Job not found'
      });
    }

    // Delete
    const { error: deleteError } = await supabaseAdmin
      .from('jobs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Database error:', deleteError);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to delete job'
      });
    }

    // Log admin activity  
    await supabaseAdmin
      .from('admin_activities')
      .insert([{
        admin_id: req.user.id,
        activity_type: 'job_deleted',
        description: `Deleted job: ${existingJob.job_title} at ${existingJob.hiring_company}`,
        metadata: { job_id: id }
      }]);

    return res.status(200).json({
      status: 'success',
      message: 'Job deleted permanently'
    });
  } catch (err) {
    console.error('Delete job error:', err);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};


// Get all jobs for admin  
const getAdminJobs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      job_type,
      location,
      company,
      search,
      is_active,
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Build query
    let query = supabaseAdmin
      .from('jobs')
      .select(`
        *,
        posted_by_user:posted_by(username, full_name)
      `, { count: 'exact' });

    // Apply filters
    if (job_type) {
      query = query.eq('job_type', job_type);
    }

    if (location) {
      query = query.ilike('location', `%${location}%`);
    }

    if (company) {
      query = query.ilike('hiring_company', `%${company}%`);
    }

    if (search) {
      query = query.or(`job_title.ilike.%${search}%,hiring_company.ilike.%${search}%,job_description.ilike.%${search}%`);
    }

    if (is_active !== undefined) {
      query = query.eq('is_active', is_active === true);
    }

    // Apply sorting
    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    // Apply pagination
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: jobs, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to fetch jobs'
      });
    }

    const totalPages = Math.ceil(count / parseInt(limit));

    res.status(200).json({
      status: 'success',
      message: 'Admin jobs retrieved successfully',
      data: {
        jobs,
        pagination: {
          current_page: parseInt(page),
          total_pages: totalPages,
          total_jobs: count,
          has_next: page < totalPages,
          has_prev: page > 1,
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get admin jobs error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

 

 

// Get available job types and locations (for filters)
const getJobFilters = async (req, res) => {
  try {
    // Get unique job types
    const { data: jobTypes } = await supabaseAdmin
      .from('jobs')
      .select('job_type')
      .eq('is_active', true)
      .neq('job_type', null);

    // Get unique locations
    const { data: locations } = await supabaseAdmin
      .from('jobs')
      .select('location')
      .eq('is_active', true)
      .neq('location', null);

    // Get unique companies
    const { data: companies } = await supabaseAdmin
      .from('jobs')
      .select('hiring_company')
      .eq('is_active', true);

    const uniqueJobTypes = [...new Set(jobTypes?.map(item => item.job_type) || [])];
    const uniqueLocations = [...new Set(locations?.map(item => item.location) || [])];
    const uniqueCompanies = [...new Set(companies?.map(item => item.hiring_company) || [])];

    res.status(200).json({
      status: 'success',
      message: 'Job filters retrieved successfully',
      data: {
        job_types: uniqueJobTypes,
        locations: uniqueLocations,
        companies: uniqueCompanies
      }
    });
  } catch (error) {
    console.error('Get job filters error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getAdminJobs,
   
  getJobFilters
};