const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const { getStreamWithBoards } = require('../services/dashboardStreamsFuntions');
const pool = require('../db');



// Create a new follow stream (POST)
router.post('/create', ensureAuthenticated, async (req, res) => {
    try {
        const { stream_name, description } = req.body;
        
        // Insert the new stream
        const result = await pool.query(
            `INSERT INTO Follow_Streams (user_id, stream_name, creation_date)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             RETURNING stream_id`,
            [req.user.user_id, stream_name]
        );
        
        req.flash('success_msg', `Stream "${stream_name}" created successfully!`);
        res.redirect('/dashboard');
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

module.exports = router;