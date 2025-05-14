const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { ensureAuthenticated } = require('../config/auth');
const { pinPicture } = require('../services/pinboardService');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadsDir = path.join(__dirname, '../public/uploads');
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'pin-' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB file size limit
    fileFilter: (req, file, cb) => {
        // Accept only image files
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Handle pin creation from uploaded file
router.post('/create', ensureAuthenticated, upload.single('image_file'), async (req, res) => {
    try {
        const boardId = req.body.board_id;
        const description = req.body.description || '';
        const tags = req.body.tags || '';
        
        // Check if file was uploaded
        if (!req.file) {
            req.flash('error_msg', 'Please upload an image file');
            return res.redirect(`/boards/${boardId}`);
        }
        
        // Read the file from disk
        const imagePath = req.file.path;
        const imageData = fs.readFileSync(imagePath);
        
        // Generate system URL based on the actual saved file path
        const systemUrl = `/uploads/${req.file.filename}`;
        
        // Process tags into array
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        
        // Use the pinPicture service with the actual system URL
        const result = await pinPicture(
            req.user.user_id,
            boardId,
            imageData,
            systemUrl, // Use the actual URL where the file was saved
            systemUrl, // Use the same URL as the original URL
            description,
            tagArray
        );
        
        if (result.success) {
            req.flash('success_msg', 'Pin created successfully!');
        } else {
            req.flash('error_msg', result.message || 'Failed to create pin');
        }
        
        res.redirect(`/boards/${boardId}`);
    } catch (error) {
        console.error('Error creating pin:', error);
        req.flash('error_msg', 'An error occurred while creating the pin');
        res.redirect(`/boards/${req.body.board_id || ''}`);
    }
});
module.exports = router;