const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const passport = require('passport');
const { createUser } = require('../services/userFunctions');
const pool = require('../db');

// handle user registration
router.post('/register', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    req.flash('registerError', 'Passwords do not match');
    return res.redirect('/');
  }

  try {
    // Check if email already exists
    const emailCheck = await pool.query(
      'SELECT email FROM Users WHERE email = $1',
      [email]
    );

    if (emailCheck.rows.length > 0) {
      req.flash('registerError', 'Email is already registered');
      return res.redirect('/');
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const result = await createUser({
      username,
      email,
      password_hash
    });

    if (result.success) {
      // Log the user in automatically
      req.login({ user_id: result.user_id }, (err) => {
        if (err) {
          console.error(err);
          req.flash('error_msg', 'Error logging in');
          return res.redirect('/');
        }
        // Redirect to profile creation page
        res.redirect('/profile/create');
      });
    } else {
      req.flash('registerError', result.message);
      res.redirect('/');
    }
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('registerError', 'An error occurred during registration');
    res.redirect('/');
  }
});

// Handle user login with Passport
router.post('/login', passport.authenticate('local', {
  successRedirect: '/dashboard',
  failureRedirect: '/',
  failureFlash: true
}));

// Handle logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error(err);
    }
    req.flash('success_msg', 'You are logged out');
    res.redirect('/');
  });
});

module.exports = router;