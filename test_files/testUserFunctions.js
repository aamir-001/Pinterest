// testUserFunctions.js
const {
    createUser,
    createProfile,
    updateProfile,
    getUserByCredentials
} = require('../services/userFunctions');

async function testUserFunctions() {
    console.log('\nTesting user functionality:');

    // Test user creation
    const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password_hash: 'hashedpassword123'
    };

    const createUserResult = await createUser(userData);
    console.log('Create user result:', JSON.stringify(createUserResult, null, 2));

    // Test profile creation
    const profileData = {
        user_id: createUserResult.user_id,
        display_name: 'Test User',
        bio: 'This is a test bio',
        profile_picture_url: 'http://example.com/profile.jpg'
    };

    const createProfileResult = await createProfile(profileData);
    console.log('Create profile result:', JSON.stringify(createProfileResult, null, 2));

    // Test profile update
    const updatedProfileData = {
        ...profileData,
        bio: 'Updated test bio'
    };

    // Test user login
    const loginResult1 = await getUserByCredentials('testuser', 'hashedpassword123');
    console.log('Login result:', JSON.stringify(loginResult1, null, 2));

    const updateProfileResult = await updateProfile(updatedProfileData);
    console.log('Update profile result:', JSON.stringify(updateProfileResult, null, 2));

    // Test user login
    const loginResult2 = await getUserByCredentials('testuser', 'hashedpassword123');
    console.log('Login result:', JSON.stringify(loginResult2, null, 2));
}

testUserFunctions().catch(console.error);