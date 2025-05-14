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

/**
 * Add a board to a stream
 * @param {number} streamId - Stream ID
 * @param {number} boardId - Board ID to add
 * @param {number} userId - User ID (owner of the stream)
 * @returns {Promise<Object>} - Result of adding the board
 */
async function addBoardToStream(streamId, boardId, userId) {
  try {
    // Verify stream ownership
    const streamCheck = await pool.query(
      'SELECT user_id FROM Follow_Streams WHERE stream_id = $1',
      [streamId]
    );
    
    if (streamCheck.rows.length === 0) {
      return {
        success: false,
        message: 'Stream not found'
      };
    }
    
    if (streamCheck.rows[0].user_id !== userId) {
      return {
        success: false,
        message: 'You do not have permission to modify this stream'
      };
    }
    
    // Verify board exists
    const boardCheck = await pool.query(
      'SELECT board_id FROM Boards WHERE board_id = $1',
      [boardId]
    );
    
    if (boardCheck.rows.length === 0) {
      return {
        success: false,
        message: 'Board not found'
      };
    }
    
    // Check if board is already in the stream
    const existingCheck = await pool.query(
      'SELECT * FROM Stream_Contents WHERE stream_id = $1 AND board_id = $2',
      [streamId, boardId]
    );
    
    if (existingCheck.rows.length > 0) {
      return {
        success: false,
        message: 'This board is already in the stream'
      };
    }
    
    // Add board to stream
    await pool.query(
      `INSERT INTO Stream_Contents (stream_id, board_id, addition_date)
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [streamId, boardId]
    );
    
    return {
      success: true,
      message: 'Board added to stream successfully'
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to add board to stream: ${error.message}`
    };
  }
}

/**
 * Get boards that can be added to a stream
 * @param {number} streamId - Stream ID
 * @param {string} searchTerm - Optional search term for board names
 * @returns {Promise<Object>} - List of boards that can be added to the stream
 */
async function getBoardsForStream(streamId, searchTerm = '') {
  try {
    // Get boards already in the stream
    const existingBoardsResult = await pool.query(
      'SELECT board_id FROM Stream_Contents WHERE stream_id = $1',
      [streamId]
    );
    
    const existingBoardIds = existingBoardsResult.rows.map(row => row.board_id);
    
    // Get the stream owner's ID
    const streamOwnerResult = await pool.query(
      'SELECT user_id FROM Follow_Streams WHERE stream_id = $1',
      [streamId]
    );
    
    if (streamOwnerResult.rows.length === 0) {
      return {
        success: false,
        message: 'Stream not found'
      };
    }
    
    const streamOwnerId = streamOwnerResult.rows[0].user_id;
    
    // Construct NOT IN clause for existing boards
    let notInClause = '';
    let params = [streamOwnerId, `%${searchTerm}%`]; // [0]: stream owner ID, [1]: search term
    
    if (existingBoardIds.length > 0) {
      notInClause = `AND b.board_id NOT IN (${existingBoardIds.map((_, idx) => `$${idx + 3}`).join(',')})`;
      params = [...params, ...existingBoardIds];
    }
    
    // Get all boards that aren't already in the stream
    const query = `
      SELECT b.board_id, b.board_name, b.description, 
             u.user_id, u.username,
             (SELECT COUNT(*) FROM Pins WHERE board_id = b.board_id) AS pin_count
      FROM Boards b
      JOIN Users u ON b.user_id = u.user_id
      WHERE b.board_name ILIKE $2
      ${notInClause}
      ORDER BY 
        CASE WHEN b.user_id = $1 THEN 0 ELSE 1 END, -- Owner's boards first
        b.creation_date DESC
    `;
    
    const boardsResult = await pool.query(query, params);
    
    return {
      success: true,
      boards: boardsResult.rows
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get boards for stream: ${error.message}`
    };
  }
}

module.exports = {
  getUserFollowStreams,
  getStreamWithBoards,
  addBoardToStream,
  getBoardsForStream
};