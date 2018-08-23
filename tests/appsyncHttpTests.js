const assert = require('assert');
const axios = require('axios');
const firebase = require('firebase');
const admin = require('firebase-admin');
const utils = require('./testUtils.js');
const config = require('../config/config.json');

describe('Appsync HTTP Tests', () => {

  before(() => {
    utils.initializeFirebaseAdminIfNeeded();
    utils.initializeFirebaseIfNeeded();
  });

  after(() => {
    admin.app().delete();
  });

  beforeEach(() => {
    if (firebase.auth()) {
      firebase.auth().signOut();
    }
  });

  it('makes an appsync request using plain old http calls', () => {

    const auth = firebase.auth();
    const password = 'abc123';
    const u1 = utils.randomTestUser('plan-http-test');

    const registerUserMessage = `mutation m {
        registerUserWithEmail {
          userId,
          email
        }
      }`;

    return utils.createFirebaseUserWithEmail(
      u1.email,
      password,
      u1.displayName,
    )
      .then(() => auth.signInWithEmailAndPassword(u1.email, password))
      .then(() => auth.currentUser.getIdToken(false))
      .then((token) => {
        const instance = axios.create({
          baseURL: config.APPSYNC_ENDPOINT_URL,
          timeout: 2000,
          headers: {
          // 'x-api-key': config.APPSYNC_API_ID,
            Authorization: token,
          },
        });

        return instance.post('/', { query: registerUserMessage });
      })
      .then((response) => {
        assert.equal(200, response.status);
        assert.equal(u1.email, response.data.data.registerUserWithEmail.email);
      })
      .finally(() => utils.deleteFirebaseUserWithEmail(u1.email));

  });

});
