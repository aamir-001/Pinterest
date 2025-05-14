// routes/friends.js
const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const { 
  sendFriendRequest, 
  respondToFriendRequest, 
  getUserFriends, 
  getPendingFriendRequests,
  searchUsers
} = require('../services/friendFunctions');
const { getUserBoards } = require('../services/libraryBoardManagementFunctions');

// Get friends list page
router.get('/', ensureAuthenticated, async (req, res) => {
  try {
    // Get user's friends
    const friendsResult = await getUserFriends(req.user.user_id);
    
    // Get pending friend requests
    const pendingRequestsResult = await getPendingFriendRequests(req.user.user_id);
    
    res.render('friends/index', {
      title: 'Friends - Pinboard',
      currentPage: 'friends',
      user: req.user,
      friends: friendsResult.success ? friendsResult.friends : [],
      pendingRequests: pendingRequestsResult.success ? pendingRequestsResult.requests : [],
      error: (!friendsResult.success || !pendingRequestsResult.success) ? 
             (!friendsResult.success ? friendsResult.message : pendingRequestsResult.message) : null
    });
  } catch (error) {
    console.error('Error fetching friends:', error);
    req.flash('error_msg', 'Failed to load friends list');
    res.redirect('/dashboard');
  }
});

// Search for users to add as friends
router.get('/search', ensureAuthenticated, async (req, res) => {
  try {
    const query = req.query.q || '';
    
    if (!query.trim()) {
      return res.render('friends/search', {
        title: 'Find Friends - Pinboard',
        currentPage: 'friends',
        user: req.user,
        results: null,
        query: '',
        error: null
      });
    }
    
    const searchResult = await searchUsers(req.user.user_id, query);
    
    res.render('friends/search', {
      title: 'Find Friends - Pinboard',
      currentPage: 'friends',
      user: req.user,
      results: searchResult.success ? searchResult.users : null,
      query: query,
      error: !searchResult.success ? searchResult.message : null
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.render('friends/search', {
      title: 'Find Friends - Pinboard',
      currentPage: 'friends',
      user: req.user,
      results: null,
      query: req.query.q || '',
      error: 'An error occurred during search'
    });
  }
});

// Send friend request
router.post('/request', ensureAuthenticated, async (req, res) => {
  try {
    const { recipient_id } = req.body;
    
    // Validate recipient_id
    if (!recipient_id) {
      req.flash('error_msg', 'User ID is required');
      return res.redirect('/friends/search');
    }
    
    // Send the friend request
    const result = await sendFriendRequest(req.user.user_id, parseInt(recipient_id));
    
    if (result.success) {
      req.flash('success_msg', result.message);
    } else {
      req.flash('error_msg', result.message);
    }
    
    // Redirect back to the search page or previous page
    res.redirect(req.headers.referer || '/friends/search');
  } catch (error) {
    console.error('Error sending friend request:', error);
    req.flash('error_msg', 'Failed to send friend request');
    res.redirect('/friends/search');
  }
});

// Accept friend request
router.post('/accept', ensureAuthenticated, async (req, res) => {
  try {
    const { user_id } = req.body;
    
    // Accept the friend request
    const result = await respondToFriendRequest(req.user.user_id, parseInt(user_id), true);
    
    if (result.success) {
      req.flash('success_msg', result.message);
    } else {
      req.flash('error_msg', result.message);
    }
    
    res.redirect('/friends');
  } catch (error) {
    console.error('Error accepting friend request:', error);
    req.flash('error_msg', 'Failed to accept friend request');
    res.redirect('/friends');
  }
});

// Reject friend request
router.post('/reject', ensureAuthenticated, async (req, res) => {
  try {
    const { user_id } = req.body;
    
    // Reject the friend request
    const result = await respondToFriendRequest(req.user.user_id, parseInt(user_id), false);
    
    if (result.success) {
      req.flash('success_msg', result.message);
    } else {
      req.flash('error_msg', result.message);
    }
    
    res.redirect('/friends');
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    req.flash('error_msg', 'Failed to reject friend request');
    res.redirect('/friends');
  }
});

// View friend's boards
router.get('/view/:userId', ensureAuthenticated, async (req, res) => {
  try {
    const friendId = req.params.userId;
    
    // Check if the user is actually a friend
    const friendsResult = await getUserFriends(req.user.user_id);
    
    if (!friendsResult.success) {
      req.flash('error_msg', friendsResult.message);
      return res.redirect('/friends');
    }
    
    const isFriend = friendsResult.friends.some(friend => friend.user_id.toString() === friendId);
    
    if (!isFriend) {
      req.flash('error_msg', 'User is not in your friends list');
      return res.redirect('/friends');
    }
    
    // Get friend's details
    const friend = friendsResult.friends.find(friend => friend.user_id.toString() === friendId);
    
    // Get friend's boards
    const boardsResult = await getUserBoards(friendId);
    
    res.render('friends/view', {
      title: `${friend.username}'s Boards - Pinboard`,
      currentPage: 'friends',
      user: req.user,
      friend: friend,
      boards: boardsResult.success ? boardsResult.boards : [],
      error: !boardsResult.success ? boardsResult.message : null
    });
  } catch (error) {
    console.error('Error viewing friend boards:', error);
    req.flash('error_msg', 'Failed to load friend\'s boards');
    res.redirect('/friends');
  }
});

module.exports = router;