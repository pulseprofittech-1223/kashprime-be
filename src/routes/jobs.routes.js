const express = require('express');
const router = express.Router();
const jobsController = require('../controllers/jobs.controller');
const { authMiddleware, requireAdmin } = require('../middleware/auth.middleware');
const { jobValidators } = require('../utils/validators/jobs');
const rateLimit = require('express-rate-limit');

// Rate limiting  
const createJobLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  
  max: 10, 
  message: {
    status: 'error',
    message: 'Too many job creation attempts, please try again later.'
  }
});

 

// Public routes  
router.get('/', jobsController.getAllJobs);
router.get('/:id', jobsController.getJobById);
router.get('/f/filters', jobsController.getJobFilters);


// Admin routes (admin    )
router.post('/admin', authMiddleware, requireAdmin, createJobLimiter, jobValidators.createJob, jobsController.createJob);
router.get('/admin/jobs/all', authMiddleware, requireAdmin, jobsController.getAdminJobs);
router.put('/admin/:id', authMiddleware, requireAdmin, jobValidators.updateJob, jobsController.updateJob);
router.delete('/admin/:id', authMiddleware, requireAdmin, jobsController.deleteJob);
 

module.exports = router;