const pool = require('../db');

/**
 * Search for pictures by keywords in tags
 * @param {string} keywords - Space-separated keywords to search for
 * @param {string} sortBy - Sorting method ('time', 'relevance', or 'likes')
 * @param {number} limit - Maximum number of results to return
 * @param {number} offset - Offset for pagination
 * @returns {Promise<Object>} - Search results
 */
async function searchPicturesByTags(keywords, sortBy = 'relevance', limit = 20, offset = 0) {
    try {
      // Split keywords into an array
      const keywordArray = keywords.toLowerCase().split(/\s+/).filter(k => k.length > 0);
      
      if (keywordArray.length === 0) {
        return {
          success: false,
          message: 'Please provide at least one keyword for search'
        };
      }
      
      // Construct the query
      let query = `
        WITH matching_pictures AS (
          SELECT 
            pic.picture_id,
            COUNT(DISTINCT t.tag_id) AS matching_tags_count
          FROM Pictures pic
          JOIN Picture_Tags pt ON pic.picture_id = pt.picture_id
          JOIN Tags t ON pt.tag_id = t.tag_id
          WHERE 
      `;
      
      // Add conditions for each keyword
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      keywordArray.forEach(keyword => {
        conditions.push(`t.tag_name ILIKE $${paramIndex}`);
        params.push(`%${keyword}%`);
        paramIndex++;
      });
      
      query += conditions.join(' OR ');
      query += ' GROUP BY pic.picture_id)';
      
      // Main query to get all details
      query += `
        SELECT 
          p.pin_id,
          p.description,
          p.pin_date,
          pic.picture_id,
          pic.system_url,
          pic.original_url,
          b.board_id,
          b.board_name,
          u.user_id,
          u.username,
          mp.matching_tags_count,
          (SELECT COUNT(*) FROM Likes WHERE picture_id = pic.picture_id) AS like_count,
          (
            SELECT string_agg(t.tag_name, ', ')
            FROM Picture_Tags pt
            JOIN Tags t ON pt.tag_id = t.tag_id
            WHERE pt.picture_id = pic.picture_id
          ) AS tags
        FROM matching_pictures mp
        JOIN Pictures pic ON mp.picture_id = pic.picture_id
        JOIN Pins p ON pic.picture_id = p.picture_id
        JOIN Boards b ON p.board_id = b.board_id
        JOIN Users u ON p.user_id = u.user_id
        WHERE p.original_pin_id IS NULL  -- Get only original pins, not repins
      `;
      
      // Add sorting
      switch (sortBy.toLowerCase()) {
        case 'time':
          query += ' ORDER BY p.pin_date DESC';
          break;
        case 'likes':
          query += ' ORDER BY like_count DESC, p.pin_date DESC';
          break;
        case 'relevance':
        default:
          query += ' ORDER BY mp.matching_tags_count DESC, like_count DESC, p.pin_date DESC';
          break;
      }
      
      // Add pagination
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);
      
      const result = await pool.query(query, params);
      
      return {
        success: true,
        pictures: result.rows,
        total: result.rows.length,
        keywords: keywordArray
      };
    } catch (error) {
      return {
        success: false,
        message: `Search failed: ${error.message}`
      };
    }
  }

  module.exports = {
    searchPicturesByTags
  };