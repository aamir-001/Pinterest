// pinboardService.js
const pool = require('../db');

/**
 * Create a new pinboard
 * @param {number} userId - User ID of the board owner
 * @param {string} boardName - Name of the board
 * @param {string} description - Description of the board
 * @param {boolean} friendsOnlyComments - Whether only friends can comment
 * @returns {Promise<Object>} - Newly created board
 */
async function createPinboard(userId, boardName, description, friendsOnlyComments = false) {
  try {
    const result = await pool.query(
      `INSERT INTO Boards (user_id, board_name, description, friends_only_comments)
       VALUES ($1, $2, $3, $4)
       RETURNING board_id, creation_date`,
      [userId, boardName, description, friendsOnlyComments]
    );
    
    return {
      success: true,
      message: 'Pinboard created successfully',
      boardId: result.rows[0].board_id,
      creationDate: result.rows[0].creation_date
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create pinboard: ${error.message}`
    };
  }
}

/**
 * Pin a picture to a board (original pin)
 * @param {number} userId - User ID of the person pinning
 * @param {number} boardId - Board ID to pin to
 * @param {Buffer} imageData - Binary image data
 * @param {string} originalUrl - Original URL of the image
 * @param {string} sourcePageUrl - URL of the page where the image was found
 * @param {string} description - Pin description
 * @param {Array<string>} tags - Tags to associate with the picture
 * @returns {Promise<Object>} - Newly created pin
 */
async function pinPicture(userId, boardId, imageData, originalUrl, sourcePageUrl, description, tags = []) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Store image data
    const imageResult = await client.query(
      'INSERT INTO Image_Storage (image_data) VALUES ($1) RETURNING image_id',
      [imageData]
    );
    
    const imageId = imageResult.rows[0].image_id;
    
    // Generate a system URL
    const systemUrl = `/uploads/image_${imageId}.jpg`;
    
    // Store picture metadata
    const pictureResult = await client.query(
      `INSERT INTO Pictures (image_id, original_url, source_page_url, system_url)
       VALUES ($1, $2, $3, $4)
       RETURNING picture_id`,
      [imageId, originalUrl, sourcePageUrl, systemUrl]
    );
    
    const pictureId = pictureResult.rows[0].picture_id;
    
    // Create pin
    const pinResult = await client.query(
      `INSERT INTO Pins (board_id, picture_id, user_id, description)
       VALUES ($1, $2, $3, $4)
       RETURNING pin_id, pin_date`,
      [boardId, pictureId, userId, description]
    );
    
    const pinId = pinResult.rows[0].pin_id;
    
    // Add tags
    for (const tagName of tags) {
      // Insert tag if it doesn't exist
      await client.query(
        'INSERT INTO Tags (tag_name) VALUES ($1) ON CONFLICT (tag_name) DO NOTHING',
        [tagName.toLowerCase().trim()]
      );
      
      // Get tag id
      const tagResult = await client.query(
        'SELECT tag_id FROM Tags WHERE tag_name = $1',
        [tagName.toLowerCase().trim()]
      );
      
      const tagId = tagResult.rows[0].tag_id;
      
      // Link tag to picture
      await client.query(
        'INSERT INTO Picture_Tags (picture_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [pictureId, tagId]
      );
    }
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Picture pinned successfully',
      pinId: pinId,
      pictureId: pictureId,
      systemUrl: systemUrl,
      pinDate: pinResult.rows[0].pin_date
    };
  } catch (error) {
    await client.query('ROLLBACK');
    return {
      success: false,
      message: `Failed to pin picture: ${error.message}`
    };
  } finally {
    client.release();
  }
}

/**
 * Repin a picture to another board
 * @param {number} userId - User ID of person repinning
 * @param {number} pinId - Pin ID being repinned
 * @param {number} boardId - Target board ID 
 * @param {string} description - New description for repin
 * @returns {Promise<Object>} - Result of repin operation
 */
async function repinPicture(userId, pinId, boardId, description) {
    try {
      // Get pin information - check if it's an original pin or already a repin
      const pinResult = await pool.query(
        'SELECT picture_id, original_pin_id FROM Pins WHERE pin_id = $1',
        [pinId]
      );
      
      if (pinResult.rows.length === 0) {
        return {
          success: false,
          message: 'Pin not found'
        };
      }
      
      const pictureId = pinResult.rows[0].picture_id;
      
      // If the pin being repinned is already a repin, use its original_pin_id
      // Otherwise, this is an original pin, so use its own pin_id
      const originalPinId = pinResult.rows[0].original_pin_id || pinId;
      
      // Create the repin
      const repinResult = await pool.query(
        `INSERT INTO Pins (board_id, picture_id, user_id, original_pin_id, description, pin_date)
         VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
         RETURNING pin_id, pin_date`,
        [boardId, pictureId, userId, originalPinId, description]
      );
      
      return {
        success: true,
        message: 'Picture repinned successfully',
        pinId: repinResult.rows[0].pin_id,
        pinDate: repinResult.rows[0].pin_date
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to repin picture: ${error.message}`
      };
    }
  }

/**
 * Delete a pinned picture
 * @param {number} pinId - Pin ID to delete
 * @param {number} userId - User ID attempting to delete
 * @returns {Promise<Object>} - Result of deletion
 */
async function deletePinnedPicture(pinId, userId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if the user owns the pin
      const pinCheck = await client.query(
        'SELECT picture_id, original_pin_id FROM Pins WHERE pin_id = $1 AND user_id = $2',
        [pinId, userId]
      );
      
      if (pinCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Pin not found or you do not have permission to delete it'
        };
      }
      
      const pictureId = pinCheck.rows[0].picture_id;
      const isOriginalPin = pinCheck.rows[0].original_pin_id === null;
      
      if (isOriginalPin) {
        // This is the original pin
        
        // Count repins for reporting
        const repinCount = await client.query(
          'SELECT COUNT(*) as count FROM Pins WHERE original_pin_id = $1',
          [pinId]
        );
        
        // Delete comments on all repins
        await client.query(
          'DELETE FROM Comments WHERE pin_id IN (SELECT pin_id FROM Pins WHERE original_pin_id = $1)',
          [pinId]
        );
        
        // Delete all repins of this original pin
        await client.query(
          'DELETE FROM Pins WHERE original_pin_id = $1',
          [pinId]
        );
        
        // Delete comments on the original pin
        await client.query(
          'DELETE FROM Comments WHERE pin_id = $1',
          [pinId]
        );
        
        // Delete the original pin
        await client.query(
          'DELETE FROM Pins WHERE pin_id = $1',
          [pinId]
        );
        
        // Delete the picture since original pin is being deleted
        // First delete likes (which are on the picture, not the pin)
        await client.query(
          'DELETE FROM Likes WHERE picture_id = $1',
          [pictureId]
        );
        
        // Delete picture tags
        await client.query(
          'DELETE FROM Picture_Tags WHERE picture_id = $1',
          [pictureId]
        );
        
        // Get the image_id before deleting the picture
        const imageResult = await client.query(
          'SELECT image_id FROM Pictures WHERE picture_id = $1',
          [pictureId]
        );
        
        const imageId = imageResult.rows[0].image_id;
        
        // Delete the picture
        await client.query(
          'DELETE FROM Pictures WHERE picture_id = $1',
          [pictureId]
        );
        
        // Delete the image data
        await client.query(
          'DELETE FROM Image_Storage WHERE image_id = $1',
          [imageId]
        );
        
        await client.query('COMMIT');
        
        return {
          success: true,
          message: `Pin deleted successfully along with ${repinCount.rows[0].count} repins and the associated picture`
        };
      } else {
        // This is a repin, just delete this single pin and its comments
        
        // Delete comments on this pin
        await client.query(
          'DELETE FROM Comments WHERE pin_id = $1',
          [pinId]
        );
        
        // Delete the pin itself
        await client.query(
          'DELETE FROM Pins WHERE pin_id = $1',
          [pinId]
        );
        
        await client.query('COMMIT');
        
        return {
          success: true,
          message: 'Pin deleted successfully'
        };
      }
    } catch (error) {
      await client.query('ROLLBACK');
      return {
        success: false,
        message: `Failed to delete pin: ${error.message}`
      };
    } finally {
      client.release();
    }
  }

  
/**
 * Get all boards for a user
 * @param {number} userId - User ID
 * @returns {Promise<Object>} - User's boards
 */
async function getUserBoards(userId) {
  try {
    const result = await pool.query(
      `SELECT b.board_id, b.board_name, b.description, b.creation_date, 
              b.friends_only_comments, COUNT(p.pin_id) AS pin_count
       FROM Boards b
       LEFT JOIN Pins p ON b.board_id = p.board_id
       WHERE b.user_id = $1
       GROUP BY b.board_id
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
      message: `Failed to get user boards: ${error.message}`
    };
  }
}

/**
 * Get all pins for a board
 * @param {number} boardId - Board ID
 * @returns {Promise<Object>} - Pins on the board
 */
async function getBoardPins(boardId) {
  try {
    const result = await pool.query(
      `SELECT p.pin_id, p.description, p.pin_date, 
              pic.picture_id, pic.system_url, pic.original_url,
              u.user_id, u.username,
              (SELECT COUNT(*) FROM Likes WHERE picture_id = pic.picture_id) AS like_count,
              (SELECT COUNT(*) FROM Comments WHERE pin_id = p.pin_id) AS comment_count
       FROM Pins p
       JOIN Pictures pic ON p.picture_id = pic.picture_id
       JOIN Users u ON p.user_id = u.user_id
       WHERE p.board_id = $1
       ORDER BY p.pin_date DESC`,
      [boardId]
    );
    
    // Get the board details
    const boardResult = await pool.query(
      `SELECT b.board_id, b.board_name, b.description, b.creation_date, 
              b.friends_only_comments, u.user_id, u.username
       FROM Boards b
       JOIN Users u ON b.user_id = u.user_id
       WHERE b.board_id = $1`,
      [boardId]
    );
    
    if (boardResult.rows.length === 0) {
      return {
        success: false,
        message: 'Board not found'
      };
    }
    
    return {
      success: true,
      board: boardResult.rows[0],
      pins: result.rows
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to get board pins: ${error.message}`
    };
  }
}

module.exports = {
  createPinboard,
  pinPicture,
  repinPicture,
  deletePinnedPicture,
  getUserBoards,
  getBoardPins
};