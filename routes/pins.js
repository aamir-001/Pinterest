const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { ensureAuthenticated } = require('../config/auth');
const { pinPicture, repinPicture } = require('../services/pinboardService');
const pool = require('../db');
const { likePicture, unlikePicture, addComment, getComments } = require('../services/likesAndCommentsFunctions');
// const fetch = require('node-fetch');

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
// Handle pin creation (from file upload or URL)
router.post('/create', ensureAuthenticated, upload.single('image_file'), async (req, res) => {
    try {
        const boardId = req.body.board_id;
        const description = req.body.description || '';
        const tags = req.body.tags || '';
        const imageUrl = req.body.image_url || '';
        const sourceUrl = req.body.source_url || '';
        
        let imageData = null;
        let originalUrl = null;
        
        // Check which method was used (file upload or URL)
        if (req.file) {
            // Method 1: File upload
            const imagePath = req.file.path;
            imageData = fs.readFileSync(imagePath);
            originalUrl = `/uploads/${req.file.filename}`;
            systemUrl = originalUrl;
        } else if (imageUrl) {
            // Method 2: URL
            try {
                // Fetch the image from the provided URL
                const response = await fetch(imageUrl);
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch image: ${response.statusText}`);
                }
                
                const buffer = await response.arrayBuffer();
                imageData = Buffer.from(buffer);
                
                // Generate a unique filename for the image
                const filename = `url-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(imageUrl) || '.jpg'}`;
                
                // Save the image to disk
                const uploadDir = path.join(__dirname, '../public/uploads');
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }
                
                const filePath = path.join(uploadDir, filename);
                fs.writeFileSync(filePath, imageData);
                
                // Set URLs
                originalUrl = imageUrl;
                systemUrl = `/uploads/${filename}`;
            } catch (error) {
                console.error('Error fetching image from URL:', error);
                req.flash('error_msg', `Failed to fetch image from URL: ${error.message}`);
                return res.redirect(`/boards/${boardId}`);
            }
        } else {
            req.flash('error_msg', 'Please provide either an image file or image URL');
            return res.redirect(`/boards/${boardId}`);
        }
        
        // Process tags
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        
        // Use pinboardService to create the pin
        const result = await pinPicture(
            req.user.user_id,
            boardId,
            imageData,
            systemUrl,
            sourceUrl || originalUrl,
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

// Handle repin requests
router.post('/repin', ensureAuthenticated, async (req, res) => {
    try {
        const { pin_id, board_id, description } = req.body;

        if (!pin_id || !board_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required pin_id or board_id'
            });
        }

        // Check if board belongs to the current user
        const boardResult = await pool.query(
            'SELECT user_id FROM Boards WHERE board_id = $1',
            [board_id]
        );

        if (boardResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Board not found'
            });
        }

        if (boardResult.rows[0].user_id !== req.user.user_id) {
            return res.status(403).json({
                success: false,
                message: 'You can only repin to your own boards'
            });
        }

        // Call the repinPicture service
        const result = await repinPicture(
            req.user.user_id,
            pin_id,
            board_id,
            description || ''
        );

        if (result.success) {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                // If it's an AJAX request, return JSON
                return res.json(result);
            } else {
                // If it's a regular form submission, redirect
                req.flash('success_msg', 'Pin repinned successfully!');
                return res.redirect(`/boards/${board_id}`);
            }
        } else {
            if (req.xhr || req.headers.accept.indexOf('json') > -1) {
                return res.status(400).json(result);
            } else {
                req.flash('error_msg', result.message);
                return res.redirect('back');
            }
        }
    } catch (error) {
        console.error('Error repinning picture:', error);
        if (req.xhr || req.headers.accept.indexOf('json') > -1) {
            return res.status(500).json({
                success: false,
                message: 'Failed to repin picture'
            });
        } else {
            req.flash('error_msg', 'Failed to repin picture');
            return res.redirect('back');
        }
    }
});
module.exports = router;