const assert = require('assert');
const AWS = require('aws-sdk');
const mlog = require('mocha-logger');
const utils = require('./testUtils.js');

AWS.config.update({
  region: 'us-east-1',
});

describe('Lambda tests', () => {

  it('handles lambda errors', async () => {
    const lambda = new AWS.Lambda();

    const initiateConversationParams = {
      FunctionName: 'initiateConversation',
      Payload: JSON.stringify({
        user: {
          userId: 'fake userid',
        },
        arguments: {
          others: ['fake userid'],
          message: 'hello',
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
      }),
    };

    const r1 = lambda.invoke(registerUser1Params).promise();
    const r2 = lambda.invoke(registerUser2Params).promise();

    mlog.log('Regisering users');
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
          message: 'hello',
        },
      }),
    };

    mlog.log('Initiating conversation');
    const initiateData = await lambda.invoke(initiateConversationParams).promise();
    assert.equal(200, initiateData.StatusCode);
    const msg = JSON.parse(initiateData.Payload);
    /* eslint-disable-next-line prefer-destructuring */
    const conversationId = msg.conversationId;
    assert(conversationId !== undefined);

    const postMessageParams = {
      FunctionName: 'postMessage',
      Payload: JSON.stringify({
        user: {
          userId: u1.userId,
        },
        arguments: {
          conversationId,
          message: 'hello again',
        },
      }),
    };

    mlog.log('Posting a message');
    const postData = await lambda.invoke(postMessageParams).promise();
    const postedMessage = JSON.parse(postData.Payload);

    assert.equal('hello again', postedMessage.message);

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
    assert.equal(2, conversation.messages.length);
    assert.equal('hello', conversation.messages[0].message);
    assert.equal('hello again', conversation.messages[1].message);

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

    assert.equal(200, updateUserData.StatusCode);
    const updatedUser = JSON.parse(updateUserData.Payload);
    assert.equal('Superman', updatedUser.displayName);

  });
});
