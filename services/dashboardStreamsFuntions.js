const pool = require('../db');

/**
 * Get all follow streams for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Result containing streams array
 */
async function getUserFollowStreams(userId) {
  try {
    const result = await pool.query(
      `SELECT stream_id, stream_name, creation_date
       FROM Follow_Streams
       WHERE user_id = $1
       ORDER BY creation_date DESC`,
      [userId]
    );
    
    return {
      success: true,
      streams: result.rows
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get follow streams: ${error.message}`
    };
  }
}

/**
 * Get stream details with all its boards
 * @param {number} streamId - Stream ID
 * @returns {Promise<Object>} - Result containing stream and boards
 */
async function getStreamWithBoards(streamId) {
  try {
    // Get stream details
    const streamResult = await pool.query(
      `SELECT fs.stream_id, fs.stream_name, fs.creation_date, u.username, u.user_id
       FROM Follow_Streams fs
       JOIN Users u ON fs.user_id = u.user_id
       WHERE fs.stream_id = $1`,
      [streamId]
    );
    
    if (streamResult.rows.length === 0) {
      return {
        success: false,
        message: 'Stream not found'
      };
    }
    
    const stream = streamResult.rows[0];
    
    // Get all boards in the stream
    const boardsResult = await pool.query(
      `SELECT b.board_id, b.board_name, b.description, 
              b.user_id, u.username,
              b.creation_date,
              (SELECT COUNT(*) FROM Pins WHERE board_id = b.board_id) AS pin_count
       FROM Stream_Contents sc
       JOIN Boards b ON sc.board_id = b.board_id
       JOIN Users u ON b.user_id = u.user_id
       WHERE sc.stream_id = $1
       ORDER BY sc.addition_date DESC`,
      [streamId]
    );
    
    return {
      success: true,
      stream: stream,
      boards: boardsResult.rows
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get stream details: ${error.message}`
    };
  }
}

module.exports = {
  getUserFollowStreams,
  getStreamWithBoards
};