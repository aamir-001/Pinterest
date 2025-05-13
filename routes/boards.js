const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const pool = require('../db');

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

// View a specific board
router.get('/:boardId', ensureAuthenticated, async (req, res) => {
    try {
        const boardId = req.params.boardId;
        
        // Get board details
        const boardResult = await pool.query(
            `SELECT b.*, u.username
             FROM Boards b
             JOIN Users u ON b.user_id = u.user_id
             WHERE b.board_id = $1`,
            [boardId]
        );
        
        if (boardResult.rows.length === 0) {
            req.flash('error_msg', 'Board not found');
            return res.redirect('/library');
        }
        
        const board = boardResult.rows[0];
        
        // Get pins in this board
        const pinsResult = await pool.query(
            `SELECT p.pin_id, p.description, p.pin_date,
                    pic.picture_id, pic.system_url, pic.original_url,
                    (SELECT COUNT(*) FROM Likes WHERE picture_id = pic.picture_id) AS like_count,
                    (SELECT COUNT(*) FROM Comments WHERE pin_id = p.pin_id) AS comment_count
             FROM Pins p
             JOIN Pictures pic ON p.picture_id = pic.picture_id
             WHERE p.board_id = $1
             ORDER BY p.pin_date DESC`,
            [boardId]
        );
        
        res.render('boards/view', {
            title: board.board_name,
            currentPage: 'library',
            user: req.user,
            board: board,
            pins: pinsResult.rows
        });
    } catch (error) {
        console.error('Error viewing board:', error);
        req.flash('error_msg', 'Failed to load board');
        res.redirect('/library');
    }
});

module.exports = router;