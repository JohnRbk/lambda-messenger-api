const assert = require('assert');
const firebase = require('firebase');
const admin = require('firebase-admin');
const utils = require('./testUtils.js');

describe('Firebase Unit Tests', () => {

  before(() => {
    utils.initializeFirebaseAdminIfNeeded();
    utils.initializeFirebaseIfNeeded();
  });

  after(() => {
    admin.app().delete();
  });

  it('can generate a firebase user token with the correct claims', () => {

    const email = utils.randomEmail();

    const auth = firebase.auth();

    // Firebase requires that a token be refreshed after updating a profile
    return auth.createUserWithEmailAndPassword(email, 'abc123')
      .then(() => auth.signInWithEmailAndPassword(email, 'abc123'))
      .then(() => auth.currentUser.updateProfile({ displayName: 'Test User' }))
      .then(() => auth.currentUser.getIdTokenResult(false))
      .then((tokenResult) => {
        // tokenResult.claims are passed into Appsync resolver using the
        // grapgh resolver: $context.identity.claims.phone_number
        assert(!tokenResult.claims.name);
      })
      .then(() => auth.currentUser.getIdTokenResult(true))
      .then((tokenResult) => {
        assert.equal('Test User', tokenResult.claims.name);
      })
      .finally(() => {
        return utils.deleteFirebaseUserWithEmail(email);
      });

  });

  it('can error gracefully when deleting an email that does not exist', () => {
    return utils.deleteFirebaseUserWithEmail('fake@example.com').then(() => {
      assert.fail('should not enter this condition');
    }).catch((error) => {
      assert.equal('auth/user-not-found', error.code);
    });
  });

  it('can delete a firebase user', () => {

    const u1 = utils.randomTestUser('test1');

    const newFirebaseUser = utils.createFirebaseUserWithEmail(
      u1.email,
      'abc123',
      u1.displayName,
    );

    return newFirebaseUser
      .then(user => admin.auth().getUser(user.uid))
      .then((user) => {
        assert(user.uid !== undefined);

        return utils.deleteFirebaseUserWithEmail(u1.email)
          .then(() => admin.auth().getUser(user.uid))
          .catch(error => error)
          .then((thrownError) => {
            assert.equal('auth/user-not-found', thrownError.code);
          });

      });
  });

  it('can set displayName for a firebase user', () => {

    const password = 'abc123';
    const u1 = utils.randomTestUser('test1');
    const u2 = utils.randomTestUser('test2');
    const auth = firebase.auth();

    const p1 = utils.createFirebaseUserWithEmail(u1.email,
      password,
      u1.displayName);
    const p2 = utils.createFirebaseUserWithEmail(u2.email,
      password,
      u2.displayName);

    return Promise.all([p1, p2]).then(() => {
      return auth.signInWithEmailAndPassword(u1.email, password);
    }).then(() => {
      assert.equal(auth.currentUser.email, u1.email);
      assert.equal(auth.currentUser.displayName, u1.displayName);
    }).finally(() => {
      const d1 = utils.deleteFirebaseUserWithEmail(u1.email);
      const d2 = utils.deleteFirebaseUserWithEmail(u2.email);
      return Promise.all([d1, d2]);
    });

  });

});
