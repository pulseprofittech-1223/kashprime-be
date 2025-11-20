const multer = require('multer');
const path = require('path');
const { supabaseAdmin } = require('../services/supabase.service');

// Configure multer for memory storage (we'll upload to Supabase)
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'), false);
  }
  
  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (!allowedExtensions.includes(fileExtension)) {
    return cb(new Error('Invalid file extension'), false);
  }
  
  cb(null, true);
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1 // Single file upload
  },
  fileFilter: fileFilter
});

// Upload to Supabase Storage (for sponsored posts)
const uploadToSupabase = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    // Use 'sponsored' folder for sponsored posts instead of 'voxfeed'
    const fileName = `sponsored/${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(req.file.originalname)}`;
    
    const { data, error } = await supabaseAdmin.storage
      .from('kashprime')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({
        status: 'error',
        message: 'Failed to upload image'
      });
    }

    // Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('kashprime')
      .getPublicUrl(fileName);

    // Add the file path to request for controller use
    req.file.path = publicUrlData.publicUrl;
    req.file.supabasePath = fileName;

    next();
  } catch (error) {
    console.error('Upload processing error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process upload'
    });
  }
};

// Error handling middleware
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'error',
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        status: 'error',
        message: 'Too many files. Only one file allowed.'
      });
    }
  }
  
  if (error.message === 'Only image files are allowed' || 
      error.message === 'Invalid file extension') {
    return res.status(400).json({
      status: 'error',
      message: error.message
    });
  }
  
  next(error);
};

module.exports = {
  single: (fieldName) => {
    return [
      upload.single(fieldName), 
      handleUploadError, 
      uploadToSupabase
    ];
  },
  handleUploadError
};