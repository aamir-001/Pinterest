const pool = require('../db');


const { searchPicturesByTags } = require('../services/searchPictures');

async function testSearch() {
  // Test with a single keyword
  const result1 = await searchPicturesByTags('beach');
  console.log('Search Results for "beach":', JSON.stringify(result1, null, 2));
  
  // Test with multiple keywords
  const result2 = await searchPicturesByTags('beach vacation');
  console.log('Search Results for "beach vacation":', JSON.stringify(result2, null, 2));
  
  // Test with different sorting
  const result3 = await searchPicturesByTags('art', 'likes');
  console.log('Search Results for "art" sorted by likes:', JSON.stringify(result3, null, 2));
}

testSearch().catch(console.error);