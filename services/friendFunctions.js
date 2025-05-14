// services/friendFunctions.js
const pool = require('../db');

/**
 * Send a friend request to another user
 * @param {number} requesterId - User ID of the person sending the request
 * @param {number} receiverId - User ID of the person receiving the request
 * @returns {Promise<Object>} - Result of the friend request
 */
async function sendFriendRequest(requesterId, receiverId) {
  try {
    // Prevent sending request to yourself
    if (requesterId === receiverId) {
      return {
        success: false,
        message: 'You cannot send a friend request to yourself'
      };
    }
    
    // Sort the user IDs to ensure consistent storage (smaller ID first)
    const user_id_1 = Math.min(requesterId, receiverId);
    const user_id_2 = Math.max(requesterId, receiverId);
    
    // Check if a friendship already exists
    const checkResult = await pool.query(
      'SELECT status FROM Friendships WHERE user_id_1 = $1 AND user_id_2 = $2',
      [user_id_1, user_id_2]
    );
    
    if (checkResult.rows.length > 0) {
      const status = checkResult.rows[0].status;
      
      if (status === 'accepted') {
        return {
          success: false,
          message: 'You are already friends with this user'
        };
      } else if (status === 'pending') {
        return {
          success: false,
          message: 'A friend request is already pending'
        };
      }
    }
    
    // Create the friendship request
    const result = await pool.query(
      `INSERT INTO Friendships (user_id_1, user_id_2, status, request_date)
       VALUES ($1, $2, 'pending', CURRENT_TIMESTAMP)
       RETURNING friendship_id`,
      [user_id_1, user_id_2]
    );
    
    return {
      success: true,
      friendship_id: result.rows[0].friendship_id,
      message: 'Friend request sent successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to send friend request: ${error.message}`
    };
  }
}

/**
 * Respond to a friend request
 * @param {number} userId - User ID of the person responding to the request
 * @param {number} otherUserId - User ID of the other person in the friendship
 * @param {boolean} accept - Whether to accept or reject the request
 * @returns {Promise<Object>} - Result of the response
 */
async function respondToFriendRequest(userId, otherUserId, accept) {
  try {
    // Sort the user IDs to match how they're stored
    const user_id_1 = Math.min(userId, otherUserId);
    const user_id_2 = Math.max(userId, otherUserId);
    
    if (accept) {
      // Accept the request
      await pool.query(
        `UPDATE Friendships 
         SET status = 'accepted', acceptance_date = CURRENT_TIMESTAMP
         WHERE user_id_1 = $1 AND user_id_2 = $2 AND status = 'pending'`,
        [user_id_1, user_id_2]
      );
      
      return {
        success: true,
        message: 'Friend request accepted'
      };
    } else {
      // Reject by deleting the request
      await pool.query(
        'DELETE FROM Friendships WHERE user_id_1 = $1 AND user_id_2 = $2 AND status = \'pending\'',
        [user_id_1, user_id_2]
      );
      
      return {
        success: true,
        message: 'Friend request rejected'
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to respond to friend request: ${error.message}`
    };
  }
}

/**
 * Get all friends for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Result containing friends array
 */
async function getUserFriends(userId) {
  try {
    // Get all accepted friendships where the user is involved
    const result = await pool.query(
      `SELECT 
        f.friendship_id,
        CASE 
          WHEN f.user_id_1 = $1 THEN f.user_id_2
          ELSE f.user_id_1
        END as user_id,
        u.username,
        p.display_name,
        p.profile_picture_url,
        f.acceptance_date
      FROM Friendships f
      JOIN Users u ON (
        CASE 
          WHEN f.user_id_1 = $1 THEN f.user_id_2
          ELSE f.user_id_1
        END = u.user_id
      )
      LEFT JOIN Profiles p ON u.user_id = p.user_id
      WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1)
        AND f.status = 'accepted'
      ORDER BY u.username ASC`,
      [userId]
    );
    
    return {
      success: true,
      friends: result.rows
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get friends: ${error.message}`
    };
  }
}

/**
 * Get pending friend requests for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Result containing pending requests array
 */
async function getPendingFriendRequests(userId) {
  try {
    // Get all pending friendships where the user is involved
    // We need to determine if the user is the recipient
    const result = await pool.query(
      `SELECT 
        f.friendship_id,
        CASE 
          WHEN f.user_id_1 = $1 THEN f.user_id_2
          ELSE f.user_id_1
        END as user_id,
        u.username,
        p.display_name,
        p.profile_picture_url,
        f.request_date,
        -- Is the logged in user the recipient of this request?
        -- This is true if the user with the smaller ID is the requester and that's not the logged in user,
        -- or if the user with the larger ID is the requester and that is the logged in user
        CASE 
          -- The first clause covers cases where user_id_1 < user_id_2
          -- If user_id_1 != userId, then user_id_1 is the requester and userId is the recipient
          WHEN f.user_id_1 != $1 THEN TRUE
          -- The second clause covers cases where user_id_2 > user_id_1
          -- If user_id_2 = userId, then user_id_2 is the requester and userId is the recipient
          ELSE FALSE
        END as is_recipient
      FROM Friendships f
      JOIN Users u ON (
        CASE 
          WHEN f.user_id_1 = $1 THEN f.user_id_2
          ELSE f.user_id_1
        END = u.user_id
      )
      LEFT JOIN Profiles p ON u.user_id = p.user_id
      WHERE (f.user_id_1 = $1 OR f.user_id_2 = $1)
        AND f.status = 'pending'
      ORDER BY f.request_date DESC`,
      [userId]
    );
    
    // Filter to include only requests where the user is the recipient
    const pendingRequests = result.rows.filter(row => row.is_recipient);
    
    return {
      success: true,
      requests: pendingRequests
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get pending friend requests: ${error.message}`
    };
  }
}

/**
 * Search for users to add as friends
 * @param {number} userId - User ID of the person searching
 * @param {string} searchQuery - Search query (username or display name)
 * @returns {Promise<Object>} - Result containing users array
 */
async function searchUsers(userId, searchQuery) {
  try {
    // Search for users by username or display name
    const result = await pool.query(
      `SELECT 
        u.user_id,
        u.username,
        p.display_name,
        p.profile_picture_url,
        -- Check friendship status
        (SELECT status FROM Friendships 
         WHERE ((user_id_1 = $1 AND user_id_2 = u.user_id) 
                OR (user_id_1 = u.user_id AND user_id_2 = $1))
        ) as friendship_status
      FROM Users u
      LEFT JOIN Profiles p ON u.user_id = p.user_id
      WHERE u.user_id != $1
        AND (u.username ILIKE $2 OR p.display_name ILIKE $2)
      ORDER BY u.username ASC
      LIMIT 20`,
      [userId, `%${searchQuery}%`]
    );
    
    return {
      success: true,
      users: result.rows
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to search users: ${error.message}`
    };
  }
}

module.exports = {
  sendFriendRequest,
  respondToFriendRequest,
  getUserFriends,
  getPendingFriendRequests,
  searchUsers
};