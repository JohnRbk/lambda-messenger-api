
const assert = require('assert');
const AWSAppSyncClient = require('aws-appsync').default;
const gql = require('graphql-tag');
const { AUTH_TYPE } = require('aws-appsync/lib/link/auth-link');
const firebase = require('firebase');
const admin = require('firebase-admin');
const mlog = require('mocha-logger');
const utils = require('./testUtils.js');
const config = require('../config/config.json');
require('./subscriptionHack.js');
const createAndRegisterUsers = require('./appsyncTestUtils.js');


describe('Appsync Tests', () => {

  let client;

  before(() => {
    utils.initializeFirebaseAdminIfNeeded();
    utils.initializeFirebaseIfNeeded();

    mlog.log('Initializing client');
    client = new AWSAppSyncClient({
      url: config.APPSYNC_ENDPOINT_URL,
      region: 'us-east-1',
      disableOffline: true,
      auth: {
        type: AUTH_TYPE.OPENID_CONNECT,
        jwtToken: async() => {
          const user = firebase.auth().currentUser;
          if (!user) {
            return new Error('User is not logged in');
          }

          return user.getIdToken(false).then(token => token);
        },
      },
    });

  });

  beforeEach(() => {
    if (firebase.auth()) {
      firebase.auth().signOut();
    }
  });

  after(() => {
    admin.app().delete();
  });

  it('can call subscribe to messages', async () => {

    const auth = firebase.auth();

    const password = 'abc123';
    const u1 = utils.randomTestUser('test1');
    const u2 = utils.randomTestUser('test2');

    mlog.log('Creating test users');
    await createAndRegisterUsers(client, [u1, u2]);

    await auth.signInWithEmailAndPassword(u1.email, password);

    const initiateConversation = gql`
      mutation m{
        initiateConversation(others: ["${u2.userId}"], message: "hello"){
          message,sender,timestamp,conversationId
        }
      }`;

    mlog.log('Initiating a conversation');
    const initiateConversationResult = await client.mutate({ mutation: initiateConversation });
    const msg = initiateConversationResult.data.initiateConversation;
    /* eslint-disable-next-line */
    const conversationId = msg.conversationId;

    const subscription = gql`
      subscription newMessage{
        newMessage(conversationId: "${conversationId}") {
          message,sender,timestamp,conversationId
        }
      }`;

    mlog.log('Started subscription');
    const observable = await client.subscribe({ query: subscription });

    let subscriptionReceived = false;

    /* eslint-disable-next-line no-unused-vars */
    const realtimeResults = function realtimeResults(result) {
      mlog.log('Received a notification');
      subscriptionReceived = true;
      return Promise.resolve();
    };

    /* eslint-disable no-unused-vars */
    const handle = observable.subscribe({
      next: realtimeResults,
      complete: (data) => { },
      error: (data) => { assert.fail(data); },
    });

    const postMessage = gql`
      mutation m{
        postMessage(conversationId: "${conversationId}", message: "hi"){
          message,sender,timestamp,conversationId
        }
      }`;

    mlog.log('Posted a message');
    await client.mutate({ mutation: postMessage });

    await utils.timeout(1000);

    mlog.log('Unsubscribing');
    handle.unsubscribe();

    assert(subscriptionReceived === true);

  });

});
