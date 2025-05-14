const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const { 
    getUserFollowStreams,
    getStreamWithBoards,
    addBoardToStream,
    getBoardsForStream } = require('../services/dashboardStreamsFuntions');
const pool = require('../db');


// Update the existing POST /create route to ensure stream name handling
router.post('/create', ensureAuthenticated, async (req, res) => {
    try {
        const { stream_name, description } = req.body;
        
        if (!stream_name || stream_name.trim() === '') {
            req.flash('error_msg', 'Stream name is required');
            return res.redirect('/dashboard');
        }
        
        // Insert the new stream
        const result = await pool.query(
            `INSERT INTO Follow_Streams (user_id, stream_name, creation_date)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             RETURNING stream_id`,
            [req.user.user_id, stream_name]
        );
        
        req.flash('success_msg', `Stream "${stream_name}" created successfully!`);
        res.redirect(`/streams/${result.rows[0].stream_id}`);
    } catch (error) {
        console.error('Error creating stream:', error);
        req.flash('error_msg', 'Failed to create stream');
        res.redirect('/dashboard');
    }
});



// GET /streams/:streamId - View a specific stream
router.get('/:streamId', ensureAuthenticated, async (req, res) => {
    const streamId = req.params.streamId;
    
    try {
        const result = await getStreamWithBoards(streamId);
        
        if (!result.success) {
            req.flash('error_msg', result.message);
            return res.redirect('/dashboard');
        }
        
        res.render('streams/view', {
            title: result.stream.stream_name + ' - Pinboard',
            currentPage: 'dashboard',
            user: req.user,
            stream: result.stream,
            boards: result.boards
        });
    } catch (error) {
        console.error('Error viewing stream:', error);
        req.flash('error_msg', 'Failed to load stream');
        res.redirect('/dashboard');
    }
});

// GET /streams/:streamId/add-board - Page to search and add boards to stream
router.get('/:streamId/add-board', ensureAuthenticated, async (req, res) => {
    const streamId = req.params.streamId;
    const searchTerm = req.query.q || '';
    
    try {
        // Get stream details
        const streamResult = await getStreamWithBoards(streamId);
        
        if (!streamResult.success) {
            req.flash('error_msg', streamResult.message);
            return res.redirect('/dashboard');
        }
        
        // Verify stream ownership
        if (streamResult.stream.user_id !== req.user.user_id) {
            req.flash('error_msg', 'You do not have permission to modify this stream');
            return res.redirect('/dashboard');
        }
        
        // Get boards that can be added to the stream
        const boardsResult = await getBoardsForStream(streamId, searchTerm);
        
        res.render('streams/add-board', {
            title: 'Add Board to Stream - Pinboard',
            currentPage: 'dashboard',
            user: req.user,
            stream: streamResult.stream,
            boards: boardsResult.success ? boardsResult.boards : [],
            searchTerm: searchTerm,
            error: boardsResult.success ? null : boardsResult.message
        });
    } catch (error) {
        console.error('Error getting add board page:', error);
        req.flash('error_msg', 'Failed to load add board page');
        res.redirect(`/streams/${streamId}`);
    }
});

// POST /streams/:streamId/add-board - Add a board to a stream
router.post('/:streamId/add-board', ensureAuthenticated, async (req, res) => {
    const streamId = req.params.streamId;
    const { board_id } = req.body;
    
    try {
        const result = await addBoardToStream(streamId, board_id, req.user.user_id);
        
        if (result.success) {
            req.flash('success_msg', result.message);
        } else {
            req.flash('error_msg', result.message);
        }
        
        res.redirect(`/streams/${streamId}`);
    } catch (error) {
        console.error('Error adding board to stream:', error);
        req.flash('error_msg', 'Failed to add board to stream');
        res.redirect(`/streams/${streamId}`);
    }
});

// POST /streams/:streamId/remove-board - Remove a board from a stream
router.post('/:streamId/remove-board', ensureAuthenticated, async (req, res) => {
    const streamId = req.params.streamId;
    const { board_id } = req.body;
    
    try {
        // Verify stream ownership
        const streamCheck = await pool.query(
            'SELECT user_id FROM Follow_Streams WHERE stream_id = $1',
            [streamId]
        );
        
        if (streamCheck.rows.length === 0) {
            req.flash('error_msg', 'Stream not found');
            return res.redirect('/dashboard');
        }
        
        if (streamCheck.rows[0].user_id !== req.user.user_id) {
            req.flash('error_msg', 'You do not have permission to modify this stream');
            return res.redirect('/dashboard');
        }
        
        // Remove board from stream
        await pool.query(
            'DELETE FROM Stream_Contents WHERE stream_id = $1 AND board_id = $2',
            [streamId, board_id]
        );
        
        req.flash('success_msg', 'Board removed from stream successfully');
        res.redirect(`/streams/${streamId}`);
    } catch (error) {
        console.error('Error removing board from stream:', error);
        req.flash('error_msg', 'Failed to remove board from stream');
        res.redirect(`/streams/${streamId}`);
    }
});

module.exports = router;