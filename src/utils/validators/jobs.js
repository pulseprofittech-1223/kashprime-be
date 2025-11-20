const { body, param, query } = require('express-validator');

const jobValidators = {
  createJob: [
    body('job_title')
      .trim()
      .isLength({ min: 3, max: 255 })
      .withMessage('Job title must be between 3 and 255 characters')
      .notEmpty()
      .withMessage('Job title is required'),

    body('hiring_company')
      .trim()
      .isLength({ min: 2, max: 255 })
      .withMessage('Company name must be between 2 and 255 characters')
      .notEmpty()
      .withMessage('Hiring company is required'),

    body('company_logo')
      .optional()
      .isURL()
      .withMessage('Company logo must be a valid URL'),

    body('job_type')
      .isIn(['remote', 'on-site', 'hybrid', 'part-time', 'full-time', 'contract', 'freelance'])
      .withMessage('Invalid job type'),

    body('application_link')
      .isURL()
      .withMessage('Application link must be a valid URL')
      .notEmpty()
      .withMessage('Application link is required'),

    body('job_description')
      .trim()
      .isLength({ min: 50, max: 5000 })
      .withMessage('Job description must be between 50 and 5000 characters')
      .notEmpty()
      .withMessage('Job description is required'),

    body('location')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Location must not exceed 255 characters'),

    body('salary_range')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Salary range must not exceed 100 characters'),

    body('experience_level')
      .optional()
      .trim()
      .isIn(['Entry', 'Mid', 'Senior', 'Lead', 'Executive', 'Intern'])
      .withMessage('Invalid experience level')
  ],

  updateJob: [
    param('id')
      .isUUID()
      .withMessage('Invalid job ID'),

    body('job_title')
      .optional()
      .trim()
      .isLength({ min: 3, max: 255 })
      .withMessage('Job title must be between 3 and 255 characters'),

    body('hiring_company')
      .optional()
      .trim()
      .isLength({ min: 2, max: 255 })
      .withMessage('Company name must be between 2 and 255 characters'),

    body('company_logo')
      .optional()
      .isURL()
      .withMessage('Company logo must be a valid URL'),

    body('job_type')
      .optional()
      .isIn(['remote', 'on-site', 'hybrid', 'part-time', 'full-time', 'contract', 'freelance'])
      .withMessage('Invalid job type'),

    body('application_link')
      .optional()
      .isURL()
      .withMessage('Application link must be a valid URL'),

    body('job_description')
      .optional()
      .trim()
      .isLength({ min: 50, max: 5000 })
      .withMessage('Job description must be between 50 and 5000 characters'),

    body('location')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Location must not exceed 255 characters'),

    body('salary_range')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Salary range must not exceed 100 characters'),

    body('experience_level')
      .optional()
      .trim()
      .isIn(['Entry', 'Mid', 'Senior', 'Lead', 'Executive', 'Intern'])
      .withMessage('Invalid experience level'),

    body('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active must be a boolean value')
  ],

  getJobById: [
    param('id')
      .isUUID()
      .withMessage('Invalid job ID')
  ],

  trackApplication: [
    param('id')
      .isUUID()
      .withMessage('Invalid job ID')
  ],

  // Query parameter validation for filtering and pagination
  jobQueryParams: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),

    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100'),

    query('job_type')
      .optional()
      .isIn(['remote', 'on-site', 'hybrid', 'part-time', 'full-time', 'contract', 'freelance'])
      .withMessage('Invalid job type'),

    query('location')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Location filter too long'),

    query('company')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Company filter too long'),

    query('search')
      .optional()
      .trim()
      .isLength({ max: 255 })
      .withMessage('Search term too long'),

    query('sort_by')
      .optional()
      .isIn(['created_at', 'job_title', 'hiring_company', 'views_count', 'applications_count'])
      .withMessage('Invalid sort field'),

    query('sort_order')
      .optional()
      .isIn(['asc', 'desc'])
      .withMessage('Sort order must be either asc or desc'),

    query('is_active')
      .optional()
      .isBoolean()
      .withMessage('is_active must be a boolean value')
  ]
};

module.exports = { jobValidators };