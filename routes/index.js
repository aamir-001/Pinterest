const express = require('express');
const router = express.Router();
const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');
const { getUserFollowStreams } = require('../services/dashboardStreamsFuntions');


// Home page (redirect if authenticated)
router.get('/', forwardAuthenticated, (req, res) => {
  res.render('index', { 
    title: 'Welcome - Pinterest Clone',
    layout: false  
  });
});

// Dashboard page (only for authenticated users)
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const streamResult = await getUserFollowStreams(req.user.user_id);
    
    res.render('dashboard', { 
      user: req.user,
      title: 'Dashboard',
      currentPage: 'dashboard',
      streams: streamResult.success ? streamResult.streams : [],
      streamError: !streamResult.success ? streamResult.message : null
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('dashboard', { 
      user: req.user,
      title: 'Dashboard',
      currentPage: 'dashboard',
      streams: [],
      streamError: 'Failed to load follow streams'
    });
  }
});

// Library page - placeholder for now
router.get('/library', ensureAuthenticated, (req, res) => {
  res.render('library', {
    user: req.user,
    title: 'Library',
    currentPage: 'library'
  });
});

// Profile page - placeholder for now
router.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', {
    user: req.user,
    title: 'Profile',
    currentPage: 'profile'
  });
});

module.exports = router;