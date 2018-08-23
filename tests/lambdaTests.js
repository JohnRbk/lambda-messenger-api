const assert = require('assert');
const AWS = require('aws-sdk');
const utils = require('./testUtils.js');

AWS.config.update({
  region: 'us-east-1',
});

describe('Lambda tests', () => {

  it('handles lambda errors', () => {
    const lambda = new AWS.Lambda();

    const initiateConversationParams = {
      FunctionName: 'initiateConversation',
      Payload: JSON.stringify({
        user: {
          userId: 'fake userid',
        },
        arguments: {
          others: ['fake userid'],
        },
      }),
    };

    return lambda.invoke(initiateConversationParams).promise()
      .then((data) => {
        const response = JSON.parse(data.Payload);
        assert(response.errorMessage !== undefined);
        assert.equal('UserIds not valid', response.errorMessage);
      });
  });

  it('invokes lambda functions', () => {
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

    return Promise.all([r1, r2])
      .then((regsitrationResults) => {
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

        return lambda.invoke(initiateConversationParams).promise()
          .then((data) => {
            assert.equal(200, data.StatusCode);
            const conversationId = JSON.parse(data.Payload);
            assert(conversationId !== undefined);
            return conversationId;
          })
          .then((conversationId) => {
            const postMessageParams = {
              FunctionName: 'postMessage',
              Payload: JSON.stringify({
                user: {
                  userId: u1.userId,
                },
                arguments: {
                  conversationId,
                  message: 'hi',
                },
              }),
            };

            return lambda.invoke(postMessageParams).promise()
              .then((data) => {
                const postedMessage = JSON.parse(data.Payload);
                assert.equal('hi', postedMessage.message);

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

                return lambda.invoke(getConversationParams).promise();
              })
              .then((data) => {
                assert.equal(200, data.StatusCode);
                const conversation = JSON.parse(data.Payload);
                assert.equal(1, conversation.messages.length);
                assert.equal('hi', conversation.messages[0].message);
              });
          });
      });
  });
});
