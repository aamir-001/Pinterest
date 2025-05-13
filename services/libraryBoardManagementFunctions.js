const pool = require('../db');

/**
 * Get all boards for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - Result containing boards
 */
async function getUserBoards(userId) {
  try {
    const result = await pool.query(
      `SELECT b.board_id, b.board_name, b.description, b.creation_date, 
              b.friends_only_comments,
              (SELECT COUNT(*) FROM Pins WHERE board_id = b.board_id) AS pin_count
       FROM Boards b
       WHERE b.user_id = $1
       ORDER BY b.creation_date DESC`,
      [userId]
    );
    
    return {
      success: true,
      boards: result.rows
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get boards: ${error.message}`
    };
  }
}

/**
 * Delete a board
 * @param {number} boardId - Board ID to delete
 * @param {number} userId - User ID (for verification)
 * @returns {Promise<Object>} - Result of deletion
 */
async function deleteBoard(boardId, userId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Verify board ownership
    const boardCheck = await client.query(
      'SELECT user_id FROM Boards WHERE board_id = $1',
      [boardId]
    );
    
    if (boardCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'Board not found'
      };
    }
    
    if (boardCheck.rows[0].user_id !== userId) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: 'You do not have permission to delete this board'
      };
    }
    
    // Delete pins on this board
    await client.query('DELETE FROM Pins WHERE board_id = $1', [boardId]);
    
    // Delete board from any streams
    await client.query('DELETE FROM Stream_Contents WHERE board_id = $1', [boardId]);
    
    // Delete the board
    await client.query('DELETE FROM Boards WHERE board_id = $1', [boardId]);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Board deleted successfully'
    };
  } catch (error) {
    await client.query('ROLLBACK');
    return {
      success: false,
      message: `Failed to delete board: ${error.message}`
    };
  } finally {
    client.release();
  }
}

/**
 * Update board details
 * @param {number} boardId - Board ID
 * @param {number} userId - User ID (for verification)
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Result of update
 */
async function updateBoard(boardId, userId, updateData) {
  try {
    // Verify board ownership
    const boardCheck = await pool.query(
      'SELECT user_id FROM Boards WHERE board_id = $1',
      [boardId]
    );
    
    if (boardCheck.rows.length === 0) {
      return {
        success: false,
        message: 'Board not found'
      };
    }
    
    if (boardCheck.rows[0].user_id !== userId) {
      return {
        success: false,
        message: 'You do not have permission to update this board'
      };
    }
    
    // Update board
    const { board_name, description, friends_only_comments } = updateData;
    
    await pool.query(
      `UPDATE Boards
       SET board_name = $1, description = $2, friends_only_comments = $3
       WHERE board_id = $4 AND user_id = $5`,
      [board_name, description, friends_only_comments, boardId, userId]
    );
    
    return {
      success: true,
      message: 'Board updated successfully',
      boardId: boardId
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to update board: ${error.message}`
    };
  }
}

module.exports = {
  getUserBoards,
  deleteBoard,
  updateBoard
};