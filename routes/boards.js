const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const pool = require('../db');
const { getBoardPins } = require('../services/pinboardService');
const { getUserBoards, deleteBoard, updateBoard } = require('../services/libraryBoardManagementFunctions'); // Added deleteBoard and updateBoard

// Create a new board (POST)
router.post('/create', ensureAuthenticated, async (req, res) => {
    try {
        const { board_name, description, friends_only_comments } = req.body;
        
        // Convert checkbox value to boolean
        const friendsOnly = friends_only_comments === 'true';
        // Insert the new board
        const result = await pool.query(
            `INSERT INTO Boards (user_id, board_name, description, friends_only_comments, creation_date)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
             RETURNING board_id`,
            [req.user.user_id, board_name, description, friendsOnly]
        );
        
        req.flash('success_msg', `Board "${board_name}" created successfully!`);
        res.redirect(`/boards/${result.rows[0].board_id}`);
    } catch (error) {
        console.error('Error creating board:', error);
        req.flash('error_msg', 'Failed to create board');
        res.redirect('/library');
    }
});

// API endpoint to get user's boards for repin functionality
router.get('/user-boards', ensureAuthenticated, async (req, res) => {
    try {
        console.log('User boards API called. User ID:', req.user.user_id);

        // Use the existing getUserBoards function
        const result = await getUserBoards(req.user.user_id);

        console.log('Found boards:', result.boards ? result.boards.length : 0);

        // Set the content type explicitly
        res.setHeader('Content-Type', 'application/json');

        return res.json({
            success: result.success,
            boards: result.success ? result.boards : [],
            message: result.success ? null : result.message
        });
    } catch (error) {
        console.error('Error fetching user boards:', error);

        // Set the content type explicitly
        res.setHeader('Content-Type', 'application/json');

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch boards: ' + error.message
        });
    }
});

// View a specific board
router.get('/:boardId', ensureAuthenticated, async (req, res) => {
    try {
        const boardId = req.params.boardId;
        
        // Use the service function to get board details and pins
        const result = await getBoardPins(boardId);
        
        if (!result.success) {
            req.flash('error_msg', result.message);
            return res.redirect('/library');
        }
        
        res.render('boards/view', {
            title: result.board.board_name,
            currentPage: 'library',
            user: req.user,
            board: result.board,
            pins: result.pins
        });
    } catch (error) {
        console.error('Error viewing board:', error);
        req.flash('error_msg', 'Failed to load board');
        res.redirect('/library');
    }
});

// Add board details endpoint for editing
router.get('/:boardId/details', ensureAuthenticated, async (req, res) => {
    try {
        const boardId = req.params.boardId;
        
        // Query the database for board details
        const result = await pool.query(
            `SELECT board_id, board_name, description, friends_only_comments
             FROM Boards
             WHERE board_id = $1 AND user_id = $2`,
            [boardId, req.user.user_id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Board not found or you do not have permission'
            });
        }
        
        return res.json({
            success: true,
            board: result.rows[0]
        });
    } catch (error) {
        console.error('Error fetching board details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch board details'
        });
    }
});

// Add update board endpoint
router.post('/:boardId/update', ensureAuthenticated, async (req, res) => {
    try {
        const boardId = req.params.boardId;
        const { board_name, description, friends_only_comments } = req.body;
        
        // Convert checkbox value to boolean
        const friendsOnly = friends_only_comments === 'true';
        
        // Use the updateBoard service function
        const updateData = {
            board_name,
            description,
            friends_only_comments: friendsOnly
        };
        
        const result = await updateBoard(boardId, req.user.user_id, updateData);
        
        if (result.success) {
            req.flash('success_msg', result.message);
            res.redirect(`/boards/${boardId}`);
        } else {
            req.flash('error_msg', result.message);
            res.redirect(`/boards/${boardId}`);
        }
    } catch (error) {
        console.error('Error updating board:', error);
        req.flash('error_msg', 'Failed to update board');
        res.redirect('/library');
    }
});

// Delete board endpoint
router.post('/:boardId/delete', ensureAuthenticated, async (req, res) => {
    try {
        const boardId = req.params.boardId;
        const userId = req.user.user_id;
        
        // Use the existing deleteBoard function from the service
        const result = await deleteBoard(boardId, userId);
        
        if (result.success) {
            req.flash('success_msg', result.message);
            res.redirect('/library'); // Redirect to library after successful deletion
        } else {
            req.flash('error_msg', result.message);
            res.redirect(`/boards/${boardId}`); // Redirect back to board if deletion fails
        }
    } catch (error) {
        console.error('Error deleting board:', error);
        req.flash('error_msg', 'Failed to delete board');
        res.redirect(`/boards/${boardId}`);
    }
});

// For API/AJAX requests for board deletion
router.delete('/:boardId', ensureAuthenticated, async (req, res) => {
    try {
        const boardId = req.params.boardId;
        const userId = req.user.user_id;
        
        // Use the existing deleteBoard function from the service
        const result = await deleteBoard(boardId, userId);
        
        return res.json(result);
    } catch (error) {
        console.error('Error deleting board:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete board'
        });
    }
});

module.exports = router;