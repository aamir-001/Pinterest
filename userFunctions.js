// userFunctions.js
const pool = require('./db');

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} - Newly created user
 */
async function createUser(userData) {
  const { username, email, password_hash } = userData;
  
  const query = `
    INSERT INTO Users (username, email, password_hash)
    VALUES ($1, $2, $3)
    RETURNING user_id
  `;
  
  try {
    const result = await pool.query(query, [username, email, password_hash]);
    return {
      success: true,
      user_id: result.rows[0].user_id,
      message: 'User created successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create user: ${error.message}`
    };
  }
}

/**
 * Create a user profile
 * @param {Object} profileData - Profile data
 * @returns {Promise<Object>} - Result of profile creation
 */
async function createProfile(profileData) {
  const { user_id, display_name, bio, profile_picture_url } = profileData;
  
  const query = `
    INSERT INTO Profiles (user_id, display_name, bio, profile_picture_url)
    VALUES ($1, $2, $3, $4)
    RETURNING profile_id
  `;
  
  try {
    const result = await pool.query(query, [user_id, display_name, bio, profile_picture_url]);
    return {
      success: true,
      profile_id: result.rows[0].profile_id,
      message: 'Profile created successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create profile: ${error.message}`
    };
  }
}

/**
 * Update a user profile
 * @param {Object} profileData - Updated profile data
 * @returns {Promise<Object>} - Result of profile update
 */
async function updateProfile(profileData) {
  const { user_id, display_name, bio, profile_picture_url } = profileData;
  
  const query = `
    UPDATE Profiles
    SET display_name = $2, bio = $3, profile_picture_url = $4
    WHERE user_id = $1
    RETURNING profile_id
  `;
  
  try {
    const result = await pool.query(query, [user_id, display_name, bio, profile_picture_url]);
    
    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'Profile not found'
      };
    }
    
    return {
      success: true,
      profile_id: result.rows[0].profile_id,
      message: 'Profile updated successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update profile: ${error.message}`
    };
  }
}

/**
 * Get user by login credentials
 * @param {string} username - Username or email
 * @param {string} password_hash - Hashed password
 * @returns {Promise<Object>} - User data if found
 */
async function getUserByCredentials(username, password_hash) {
  const query = `
    SELECT u.user_id, u.username, u.email, p.display_name, p.bio, p.profile_picture_url
    FROM Users u
    LEFT JOIN Profiles p ON u.user_id = p.user_id
    WHERE (u.username = $1 OR u.email = $1) AND u.password_hash = $2
  `;
  
  try {
    const result = await pool.query(query, [username, password_hash]);
    
    if (result.rows.length === 0) {
      return {
        success: false,
        message: 'Invalid credentials'
      };
    }
    
    return {
      success: true,
      user: result.rows[0]
    };
  } catch (error) {
    return {
      success: false,
      message: `Login failed: ${error.message}`
    };
  }
}

module.exports = {
  createUser,
  createProfile,
  updateProfile,
  getUserByCredentials
};