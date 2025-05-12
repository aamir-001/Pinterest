const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt');
const pool = require('../db');

module.exports = function(passport) {
  passport.use(new LocalStrategy(
    { usernameField: 'email' },
    async (email, password, done) => {
      try {
        // Find user by email
        const result = await pool.query(
          'SELECT * FROM Users WHERE email = $1',
          [email]
        );

        if (result.rows.length === 0) {
          return done(null, false, { message: 'User not found' });
        }

        const user = result.rows[0];

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (isMatch) {
          return done(null, user);
        } else {
          return done(null, false, { message: 'Incorrect password' });
        }
      } catch (err) {
        return done(err);
      }
    }
  ));

  passport.serializeUser((user, done) => {
    done(null, user.user_id);
  });

  passport.deserializeUser(async (user_id, done) => {
    try {
      const result = await pool.query(
        `SELECT u.user_id, u.username, u.email, p.display_name, p.bio, p.profile_picture_url
         FROM Users u
         LEFT JOIN Profiles p ON u.user_id = p.user_id
         WHERE u.user_id = $1`,
        [user_id]
      );
      
      if (result.rows.length === 0) {
        return done(null, false);
      }
      
      done(null, result.rows[0]);
    } catch (err) {
      done(err);
    }
  });
};