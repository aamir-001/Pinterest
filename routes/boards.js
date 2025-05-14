const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const pool = require('../db');
const { getBoardPins } = require('../services/pinboardService');
const { getUserBoards } = require('../services/libraryBoardManagementFunctions');

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

module.exports = router;