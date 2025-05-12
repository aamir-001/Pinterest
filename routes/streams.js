const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const { getStreamWithBoards } = require('../services/dashboardStreamsFuntions');

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