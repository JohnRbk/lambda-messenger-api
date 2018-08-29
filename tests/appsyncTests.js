
const assert = require('assert');
const AWSAppSyncClient = require('aws-appsync').default;
const gql = require('graphql-tag');
const { AUTH_TYPE } = require('aws-appsync/lib/link/auth-link');
const firebase = require('firebase');
const admin = require('firebase-admin');
const utils = require('./testUtils.js');
const config = require('../config/config.json');
const createAndRegisterUsers = require('./appsyncTestUtils.js');

describe('Appsync Tests', () => {

  let client;

  before(() => {
    utils.initializeFirebaseAdminIfNeeded();
    utils.initializeFirebaseIfNeeded();

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

  it('can handle appsync call when not logged in', () => {
    const registerUserWithEmail = gql`
        mutation m{
          registerUserWithEmail(fcmToken: "123456") {
              userId
          }
        }`;
    return client.mutate({ mutation: registerUserWithEmail })
      .catch(error => error)
      .then((thrownError) => {
        assert(firebase.auth().currentUser === null);
        assert.equal(401, thrownError.networkError.response.status);
      });
  });

  it('can call registerUserWithEmail', async () => {

    const auth = firebase.auth();

    const password = 'abc123';
    const u1 = utils.randomTestUser('test1');
    const u2 = utils.randomTestUser('test2');

    try {
      await createAndRegisterUsers(client, [u1, u2]);

      await auth.signInWithEmailAndPassword(u1.email, password);

      assert.equal(auth.currentUser.email, u1.email);

    } catch (error) {
      assert.fail(error.message);
    } finally {
      const d1 = utils.deleteFirebaseUserWithEmail(u1.email);
      const d2 = utils.deleteFirebaseUserWithEmail(u2.email);
      const signOut = auth.signOut();
      await Promise.all([d1, d2, signOut]);
    }
  });

  it('can lookup a user by email', async () => {

    const u1 = utils.randomTestUser('test1');
    const auth = firebase.auth();
    const password = 'abc123';

    try {

      await utils.createFirebaseUserWithEmail(
        u1.email,
        password,
        u1.displayName,
      );

      await auth.signInWithEmailAndPassword(u1.email, password);

      await auth.currentUser.getIdToken(true);

      const registerUserWithEmail = gql`
        mutation m{
          registerUserWithEmail(fcmToken: "123456") {
              userId,
              email,
              displayName
          }
        }`;

      await client.mutate({ mutation: registerUserWithEmail });

      const lookupUserWithEmail = gql`
        query m{
          lookupUserByEmail(email : "${u1.email}") {
              userId,
              email,
              displayName
          }
        }`;
      const result = await client.query({ query: lookupUserWithEmail });

      assert.equal(u1.email, result.data.lookupUserByEmail.email);

    } catch (error) {
      assert.fail(error.message);
    } finally {
      const d1 = utils.deleteFirebaseUserWithEmail(u1.email);
      const signOut = auth.signOut();
      await Promise.all([d1, signOut]);
    }


  });


});
