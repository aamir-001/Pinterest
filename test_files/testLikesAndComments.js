// testLikesAndComments.js
const { likePicture, unlikePicture, addComment, getComments } = require('../services/likesAndCommentsFunctions');

async function testLikesAndComments() {
    console.log('\nTesting likes and comments functionality:');

    const userId = 1;
    const pictureId = 1;
    const pinId = 1;

    // Test liking a picture
    const likeResult = await likePicture(userId, pictureId);
    console.log('Like picture result:', JSON.stringify(likeResult, null, 2));

    // Test unliking a picture
    const unlikeResult = await unlikePicture(userId, pictureId);
    console.log('Unlike picture result:', JSON.stringify(unlikeResult, null, 2));

    // Test adding a comment
    const commentResult = await addComment(userId, pinId, "This is a test comment!");
    console.log('Add comment result:', JSON.stringify(commentResult, null, 2));

    // Test getting comments
    const getCommentsResult = await getComments(pinId);
    console.log('Get comments result:', JSON.stringify(getCommentsResult, null, 2));
}

testLikesAndComments().catch(console.error);