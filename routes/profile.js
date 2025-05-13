// routes/profile.js - Create profile route

const express = require('express');
const router = express.Router();
const { ensureAuthenticated } = require('../config/auth');
const { createProfile, updateProfile } = require('../services/userFunctions');

// Show profile creation form
router.get('/create', ensureAuthenticated, (req, res) => {
  res.render('profile/create', { user: req.user });
});

// Handle profile creation
router.post('/create', ensureAuthenticated, async (req, res) => {
  const { display_name, bio } = req.body;
  
  try {
    const result = await createProfile({
      user_id: req.user.user_id,
      display_name,
      bio,
      profile_picture_url: null // Can add image upload later
    });

    if (result.success) {
      req.flash('success_msg', 'Profile created successfully!');
      res.redirect('/dashboard');
    } else {
      req.flash('error_msg', result.message);
      res.redirect('/profile/create');
    }
  } catch (error) {
    console.error('Profile creation error:', error);
    req.flash('error_msg', 'Error creating profile');
    res.redirect('/profile/create');
  }
});

// Show profile edit form
router.get('/edit', ensureAuthenticated, (req, res) => {
  res.render('profile/edit', { user: req.user });
});


// Handle profile updates
router.post('/edit', ensureAuthenticated, async (req, res) => {
  const { display_name, bio } = req.body;

  try {
    // You'll need to create an updateProfile function in your userFunctions service
    const result = await updateProfile({
      user_id: req.user.user_id,
      display_name,
      bio,
      profile_picture_url: req.user.profile_picture_url
    });

    if (result.success) {
      req.flash('success_msg', 'Profile updated successfully!');
      res.redirect('/profile');
    } else {
      req.flash('error_msg', result.message);
      res.redirect('/profile/edit');
    }
  } catch (error) {
    console.error('Profile update error:', error);
    req.flash('error_msg', 'Error updating profile');
    res.redirect('/profile/edit');
  }
});


module.exports = router;