// testFriendFunctions.js
const { sendFriendRequest, respondToFriendRequest } = require('../services/friendFunctions');

async function testFriendFunctions() {
    // Test sending friend request
    console.log('\nTesting friend request functionality:');

    const requesterId = 1;
    const receiverId = 2;

    // Test sending friend request
    const sendResult = await sendFriendRequest(requesterId, receiverId);
    console.log('Send friend request result:', JSON.stringify(sendResult, null, 2));

    // Test accepting friend request
    const acceptResult = await respondToFriendRequest(receiverId, requesterId, true);
    console.log('Accept friend request result:', JSON.stringify(acceptResult, null, 2));

    // Test rejecting friend request (with different users)
    const rejectResult = await respondToFriendRequest(3, 4, false);
    console.log('Reject friend request result:', JSON.stringify(rejectResult, null, 2));
}

testFriendFunctions().catch(console.error);