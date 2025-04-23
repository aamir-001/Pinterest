const pool = require('../db');

/**
 * Add a like to a picture
 * @param {number} userId - User ID of the person liking the picture
 * @param {number} pictureId - ID of the picture being liked
 * @returns {Promise<Object>} - Result of the like operation
 */
async function likePicture(userId, pictureId) {
  try {
    // Insert a like record
    await pool.query(
      `INSERT INTO Likes (user_id, picture_id) 
       VALUES ($1, $2)
       ON CONFLICT (user_id, picture_id) DO UPDATE 
       SET like_date = CURRENT_TIMESTAMP`,
      [userId, pictureId]
    );
    
    // Get the updated like count for the picture
    const likeCountResult = await pool.query(
      'SELECT COUNT(*) as like_count FROM Likes WHERE picture_id = $1',
      [pictureId]
    );
    
    return {
      success: true,
      message: 'Picture liked successfully',
      likeCount: likeCountResult.rows[0].like_count
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to like picture: ${error.message}`
    };
  }
}

/**
 * Remove a like from a picture
 * @param {number} userId - User ID of the person unliking the picture
 * @param {number} pictureId - ID of the picture being unliked
 * @returns {Promise<Object>} - Result of the unlike operation
 */
async function unlikePicture(userId, pictureId) {
  try {
    // Remove the like record
    await pool.query(
      'DELETE FROM Likes WHERE user_id = $1 AND picture_id = $2',
      [userId, pictureId]
    );
    
    // Get the updated like count for the picture
    const likeCountResult = await pool.query(
      'SELECT COUNT(*) as like_count FROM Likes WHERE picture_id = $1',
      [pictureId]
    );
    
    return {
      success: true,
      message: 'Picture unliked successfully',
      likeCount: likeCountResult.rows[0].like_count
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to unlike picture: ${error.message}`
    };
  }
}

/**
 * Add a comment to a pin
 * @param {number} userId - User ID of the commenter
 * @param {number} pinId - ID of the pin being commented on
 * @param {string} content - Comment text
 * @returns {Promise<Object>} - Result of the comment operation
 */
async function addComment(userId, pinId, content) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if user is allowed to comment
    // This checks:
    // 1. If pin belongs to a board where friends_only_comments is true
    // 2. If so, checks if user is friends with the board owner
    const permissionCheck = await client.query(
      `SELECT CASE
         WHEN b.friends_only_comments = FALSE THEN TRUE
         WHEN b.user_id = $1 THEN TRUE
         WHEN EXISTS (
           SELECT 1 FROM Friendships 
           WHERE ((user_id_1 = b.user_id AND user_id_2 = $1) OR (user_id_1 = $1 AND user_id_2 = b.user_id))
           AND status = 'accepted'
         ) THEN TRUE
         ELSE FALSE
       END AS can_comment
       FROM Pins p
       JOIN Boards b ON p.board_id = b.board_id
       WHERE p.pin_id = $2`,
      [userId, pinId]
    );
    
    if (permissionCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'Pin not found'
      };
    }
    
    if (!permissionCheck.rows[0].can_comment) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'You are not allowed to comment on this pin'
      };
    }
    
    // Add the comment
    const commentResult = await client.query(
      `INSERT INTO Comments (pin_id, user_id, content)
       VALUES ($1, $2, $3)
       RETURNING comment_id, comment_date`,
      [pinId, userId, content]
    );
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Comment added successfully',
      commentId: commentResult.rows[0].comment_id,
      commentDate: commentResult.rows[0].comment_date
    };
  } catch (error) {
    await client.query('ROLLBACK');
    return {
      success: false,
      message: `Failed to add comment: ${error.message}`
    };
  } finally {
    client.release();
  }
}

/**
 * Get comments for a pin
 * @param {number} pinId - ID of the pin
 * @returns {Promise<Object>} - Comments for the pin
 */
async function getComments(pinId) {
  try {
    const result = await pool.query(
      `SELECT c.comment_id, c.content, c.comment_date, 
              c.user_id, u.username, p.display_name, p.profile_picture_url
       FROM Comments c
       JOIN Users u ON c.user_id = u.user_id
       LEFT JOIN Profiles p ON u.user_id = p.user_id
       WHERE c.pin_id = $1
       ORDER BY c.comment_date DESC`,
      [pinId]
    );
    
    return {
      success: true,
      comments: result.rows
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get comments: ${error.message}`
    };
  }
}

module.exports = {
  likePicture,
  unlikePicture,
  addComment,
  getComments
};