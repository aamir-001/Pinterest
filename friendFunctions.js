// friendFunctions.js
const pool = require('./db');

/**
 * Send a friend request to another user
 * @param {number} requesterId - User ID of the person sending the request
 * @param {number} receiverId - User ID of the person receiving the request
 * @returns {Promise<Object>} - Result of the friend request
 */
async function sendFriendRequest(requesterId, receiverId) {
  try {
    // Sort the user IDs to ensure consistent storage (smaller ID first)
    const user_id_1 = Math.min(requesterId, receiverId);
    const user_id_2 = Math.max(requesterId, receiverId);
    
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

module.exports = {
  sendFriendRequest,
  respondToFriendRequest
};