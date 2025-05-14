const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { ensureAuthenticated } = require('../config/auth');
const { pinPicture } = require('../services/pinboardService');
const pool = require('../db');
const { likePicture, unlikePicture, addComment, getComments } = require('../services/likesAndCommentsFunctions');


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


// Get pin details including like status
// Get pin details including like status
router.get('/:pinId/details', ensureAuthenticated, async (req, res) => {
    try {
        const pinId = req.params.pinId;
        const userId = req.user.user_id;
        
        // Validate pinId is a valid integer
        if (!pinId || isNaN(parseInt(pinId))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pin ID'
            });
        }
        
        // Get pin and picture details
        const result = await pool.query(`
            SELECT 
                p.pin_id, 
                p.description, 
                p.pin_date,
                pic.picture_id, 
                pic.system_url, 
                pic.original_url,
                (SELECT COUNT(*) FROM Likes WHERE picture_id = pic.picture_id) AS like_count,
                EXISTS(SELECT 1 FROM Likes WHERE picture_id = pic.picture_id AND user_id = $1) AS user_liked,
                (SELECT COUNT(*) FROM Comments WHERE pin_id = p.pin_id) AS comment_count
            FROM Pins p
            JOIN Pictures pic ON p.picture_id = pic.picture_id
            WHERE p.pin_id = $2
        `, [userId, parseInt(pinId)]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pin not found'
            });
        }
        
        res.json({
            success: true,
            pin: result.rows[0]
        });
    } catch (error) {
        console.error('Error getting pin details:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get pin details'
        });
    }
});

// Like or unlike a pin
router.post('/like', ensureAuthenticated, async (req, res) => {
    try {
        const { pin_id } = req.body;
        
        // First get the picture_id from the pin
        const pinResult = await pool.query(
            'SELECT picture_id FROM Pins WHERE pin_id = $1',
            [pin_id]
        );
        
        if (pinResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pin not found'
            });
        }
        
        const pictureId = pinResult.rows[0].picture_id;
        
        // Check if user already liked this picture
        const likeCheck = await pool.query(
            'SELECT * FROM Likes WHERE user_id = $1 AND picture_id = $2',
            [req.user.user_id, pictureId]
        );
        
        let result;
        let liked = false;
        
        if (likeCheck.rows.length > 0) {
            // Unlike if already liked
            result = await unlikePicture(req.user.user_id, pictureId);
            liked = false;
        } else {
            // Like if not already liked
            result = await likePicture(req.user.user_id, pictureId);
            liked = true;
        }
        
        res.json({
            success: result.success,
            message: result.message,
            likeCount: result.likeCount,
            liked: liked
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to like/unlike pin'
        });
    }
});

// Get comments for a pin
router.get('/:pinId/comments', ensureAuthenticated, async (req, res) => {
    try {
        const pinId = req.params.pinId;
        
        if (!pinId || isNaN(parseInt(pinId))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pin ID'
            });
        }
        
        const result = await getComments(parseInt(pinId));
        
        res.json(result);
    } catch (error) {
        console.error('Error getting comments:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get comments'
        });
    }
});

// Add a comment to a pin
router.post('/comment', ensureAuthenticated, async (req, res) => {
    try {
        const { pin_id, content } = req.body;
        
        if (!pin_id || isNaN(parseInt(pin_id))) {
            return res.status(400).json({
                success: false,
                message: 'Invalid pin ID'
            });
        }
        
        if (!content || !content.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Comment content is required'
            });
        }
        
        const result = await addComment(req.user.user_id, parseInt(pin_id), content);
        
        res.json(result);
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add comment'
        });
    }
});
module.exports = router;