// testPinboard.js
const {
    createPinboard,
    pinPicture,
    repinPicture,
    deletePinnedPicture,
    getUserBoards,
    getBoardPins
} = require('../services/pinboardService');

async function testPinboard() {
    console.log('\nTesting pinboard functionality:');

    const userId = 1;

    // Test creating a new pinboard
    const boardResult = await createPinboard(
        userId,
        "Test Board",
        "A test pinboard",
        false
    );
    console.log('Create board result:', JSON.stringify(boardResult, null, 2));

    // Test getting user's boards
    const userBoardsResult = await getUserBoards(userId);
    console.log('Get user boards result:', JSON.stringify(userBoardsResult, null, 2));

    // Mock image data for testing
    const imageData = Buffer.from('test image data');

    // Test pinning a picture
    const pinResult = await pinPicture(
        userId,
        boardResult.boardId,
        imageData,
        'http://example.com/original.jpg',
        'http://example.com',
        'Test pin description',
        ['test', 'demo']
    );
    console.log('Pin picture result:', JSON.stringify(pinResult, null, 2));

    // Test getting board pins
    const boardPinsResult = await getBoardPins(boardResult.boardId);
    console.log('Get board pins result:', JSON.stringify(boardPinsResult, null, 2));

    // Test repinning
    const repinResult = await repinPicture(
        userId,
        pinResult.pinId,
        boardResult.boardId,
        'Repinned description'
    );
    console.log('Repin result:', JSON.stringify(repinResult, null, 2));

    // Test deleting a pin
    const deleteResult = await deletePinnedPicture(repinResult.pinId, userId);
    console.log('Delete pin result:', JSON.stringify(deleteResult, null, 2));
}

testPinboard().catch(console.error);