const assert = require('assert');
const AWS = require('aws-sdk');
const mlog = require('mocha-logger');
const utils = require('./testUtils.js');

AWS.config.update({
  region: 'us-east-1',
});

describe('Lambda tests', () => {

  // Note that this API is called as a lambda async event within
  // the updateUser lambda. When called as in the test case below
  // it has no effect since the user has not been updated.
  it('invokes updateUserInAllMessages function', async () => {
    const lambda = new AWS.Lambda();

    const u = utils.randomTestUser();

    const registerUserParams = {
      FunctionName: 'registerUserWithPhoneNumber',
      Payload: JSON.stringify({
        user: {
          userId: u.userId,
          phoneNumber: u.phoneNumber,
          displayName: u.displayName,
        },
        arguments: {
          fcmCode: '12345',
        },
      }),
    };

    await lambda.invoke(registerUserParams).promise();

    const updateUserInAllMessagesParams = {
      FunctionName: 'updateUserInAllMessages',
      Payload: JSON.stringify({
        user: {
          userId: u.userId,
        },
      }),
    };

    const response = await lambda.invoke(updateUserInAllMessagesParams).promise();

  });


  // Its expected this will fail in a test environment since the
  // fcmToken is not an actual device token.
  it('can invoke the pushNotification lambda', async() => {
    const lambda = new AWS.Lambda();

    const u = utils.randomTestUser();

    const registerUserParams = {
      FunctionName: 'registerUserWithPhoneNumber',
      Payload: JSON.stringify({
        user: {
          userId: u.userId,
          phoneNumber: u.phoneNumber,
          displayName: u.displayName,
        },
        arguments: {
          fcmToken: u.fcmToken,
        },
      }),
    };

    await lambda.invoke(registerUserParams).promise();

    const sendPushNotificationParams = {
      InvocationType: 'Event',
      FunctionName: 'sendPushNotifications',
      Payload: JSON.stringify({
        arguments: {
          sender: u.userId,
          conversationId: '123456',
          dryRun: true,
          message: 'this request will fail since the fcmToken is a test token',
        },
      }),
    };

    const data = await lambda.invoke(sendPushNotificationParams).promise();
    assert.equal(202, data.StatusCode);

  });


  it('handles lambda errors', async () => {
    const lambda = new AWS.Lambda();

    const initiateConversationParams = {
      FunctionName: 'initiateConversation',
      Payload: JSON.stringify({
        user: {
          userId: 'fake userid',
        },
        arguments: {
          others: ['other fake userid'],
        },
      }),
    };

    const data = await lambda.invoke(initiateConversationParams).promise();
    const response = JSON.parse(data.Payload);

    assert(response.errorMessage !== undefined);
    assert.equal('UserIds not valid', response.errorMessage);

  });

  it('invokes lambda functions', async () => {
    const lambda = new AWS.Lambda();

    const u1 = utils.randomTestUser();
    const u2 = utils.randomTestUser();

    const registerUser1Params = {
      FunctionName: 'registerUserWithPhoneNumber',
      Payload: JSON.stringify({
        user: {
          userId: u1.userId,
          phoneNumber: u1.phoneNumber,
          displayName: u1.displayName,
        },
        arguments: {
          fcmCode: '12345',
        },
      }),
    };

    const registerUser2Params = {
      FunctionName: 'registerUserWithPhoneNumber',
      Payload: JSON.stringify({
        user: {
          userId: u2.userId,
          phoneNumber: u2.phoneNumber,
          displayName: u2.displayName,
        },
        arguments: {
          fcmCode: '12345',
        },
      }),
    };

    const r1 = lambda.invoke(registerUser1Params).promise();
    const r2 = lambda.invoke(registerUser2Params).promise();

    mlog.log('Registering users');
    const regsitrationResults = await Promise.all([r1, r2]);
    const results1 = JSON.parse(regsitrationResults[0].Payload);
    const results2 = JSON.parse(regsitrationResults[1].Payload);
    assert(results1.userId !== undefined);
    assert(results2.userId !== undefined);

    const initiateConversationParams = {
      FunctionName: 'initiateConversation',
      Payload: JSON.stringify({
        user: {
          userId: u1.userId,
        },
        arguments: {
          others: [u2.userId],
        },
      }),
    };

    mlog.log('Initiating conversation');
    const initiateData = await lambda.invoke(initiateConversationParams).promise();
    assert.equal(200, initiateData.StatusCode);
    const conversationId = JSON.parse(initiateData.Payload);

    assert(conversationId !== undefined);

    const postMessageParams = {
      FunctionName: 'postMessage',
      Payload: JSON.stringify({
        user: {
          userId: u1.userId,
        },
        arguments: {
          conversationId,
          message: 'hello',
        },
      }),
    };

    mlog.log('Posting a message');
    const postData = await lambda.invoke(postMessageParams).promise();
    const postedMessage = JSON.parse(postData.Payload);

    assert.equal('hello', postedMessage.message);
    assert.equal(u1.userId, postedMessage.sender.userId);
    assert.equal(u1.displayName, postedMessage.sender.displayName);

    const getConversationParams = {
      FunctionName: 'getConversation',
      Payload: JSON.stringify({
        user: {
          userId: u1.userId,
        },
        arguments: {
          conversationId,
          since: new Date(),
        },
      }),
    };

    mlog.log('Getting messages');
    const getConversationData = await lambda.invoke(getConversationParams).promise();

    assert.equal(200, getConversationData.StatusCode);
    const conversation = JSON.parse(getConversationData.Payload);
    assert.equal(1, conversation.messages.length);
    assert.equal('hello', conversation.messages[0].message);
    assert.equal(u1.userId, conversation.messages[0].sender.userId);
    assert.equal(u1.phoneNumber, conversation.messages[0].sender.phoneNumber);

    const updateUserParams = {
      FunctionName: 'updateUser',
      Payload: JSON.stringify({
        user: {
          userId: u1.userId,
        },
        arguments: {
          displayName: 'Superman',
        },
      }),
    };

    mlog.log('Updating the user displayName');
    const updateUserData = await lambda.invoke(updateUserParams).promise();
    console.log(updateUserData);
    assert.equal(200, updateUserData.StatusCode);
    const updatedUser = JSON.parse(updateUserData.Payload);
    assert.equal('Superman', updatedUser.displayName);

  });


});
