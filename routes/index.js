const express = require('express');
const router = express.Router();
const { ensureAuthenticated, forwardAuthenticated } = require('../config/auth');
const { getUserFollowStreams } = require('../services/dashboardStreamsFuntions');
const { getUserBoards } = require('../services/libraryBoardManagementFunctions');
const { searchPicturesByTags } = require('../services/searchPictures'); // Update path as needed


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

// Library page
router.get('/library', ensureAuthenticated, async (req, res) => {
  try {

    // Get user's boards
    const boardsResult = await getUserBoards(req.user.user_id);
    
    res.render('library', {
      user: req.user,
      title: 'Your Library',
      currentPage: 'library',
      boards: boardsResult.success ? boardsResult.boards : [],
      error: !boardsResult.success ? boardsResult.message : null
    });
  } catch (error) {
    console.error('Library error:', error);
    req.flash('error_msg', 'Failed to load library');
    res.redirect('/dashboard');
  }
});

// Profile page - placeholder for now
router.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', {
    user: req.user,
    title: 'Profile',
    currentPage: 'profile'
  });
});


router.get('/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const sortBy = req.query.sort || 'relevance'; // Default to relevance sort
    
    if (!query.trim()) {
      return res.render('search', {
        title: 'Search - Pinterest Clone',
        currentPage: '',
        user: req.user,
        results: null,
        query: '',
        sortBy: sortBy,
        error: 'Please enter a search term'
      });
    }
    
    const searchResults = await searchPicturesByTags(query, sortBy, 50, 0);
    
    // Get related tags based on the search results
    let relatedTags = [];
    if (searchResults.success && searchResults.pictures.length > 0) {
      const tagMap = new Map();
      
      // Count tag occurrences
      searchResults.pictures.forEach(pic => {
        if (pic.tags) {
          pic.tags.split(', ').forEach(tag => {
            tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
          });
        }
      });
      
      // Convert to array and sort by occurrence count
      relatedTags = Array.from(tagMap.entries())
        .map(([tag, count]) => ({ tag_name: tag, pin_count: count }))
        .sort((a, b) => b.pin_count - a.pin_count)
        .slice(0, 10); // Get top 10 tags
    }
    
    res.render('search', {
      title: `${query} - Search Results`,
      currentPage: '',
      user: req.user,
      results: searchResults.success ? {
        pins: searchResults.pictures,
        relatedTags: relatedTags,
        query: query
      } : null,
      query: query,
      sortBy: sortBy,
      error: searchResults.success ? null : searchResults.message
    });
  } catch (error) {
    console.error('Search error:', error);
    res.render('search', {
      title: 'Search - Pinterest Clone',
      currentPage: '',
      user: req.user,
      results: null,
      query: req.query.q || '',
      sortBy: req.query.sort || 'relevance',
      error: 'An error occurred during search'
    });
  }
});


// Dashboard page (only for authenticated users)
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const streamResult = await getUserFollowStreams(req.user.user_id);
    const pendingRequestsResult = await getPendingFriendRequests(req.user.user_id);
    
    res.render('dashboard', { 
      user: req.user,
      title: 'Dashboard',
      currentPage: 'dashboard',
      streams: streamResult.success ? streamResult.streams : [],
      streamError: !streamResult.success ? streamResult.message : null,
      pendingRequests: pendingRequestsResult.success ? pendingRequestsResult.requests : []
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('dashboard', { 
      user: req.user,
      title: 'Dashboard',
      currentPage: 'dashboard',
      streams: [],
      streamError: 'Failed to load follow streams',
      pendingRequests: []
    });
  }
});


module.exports = router;