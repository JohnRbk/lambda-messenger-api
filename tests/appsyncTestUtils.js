const assert = require('assert');
const gql = require('graphql-tag');
const firebase = require('firebase');
const utils = require('./testUtils.js');

module.exports = async function createAndRegisterUsers(client, users) {

  const auth = firebase.auth();
  const password = 'abc123';
  /* eslint-disable no-await-in-loop, no-restricted-syntax */
  for (const user of users) {

    const firebaseUser = await utils.createFirebaseUserWithEmail(
      user.email,
      password,
      user.displayName,
    );

    user.userId = firebaseUser.uid;

    await auth.signInWithEmailAndPassword(user.email, password);

    assert.equal(auth.currentUser.email, user.email);

    const registerUserWithEmail = gql`
      mutation m{
        registerUserWithEmail {
            userId,
            email,
            displayName
        }
      }`;

    const result = await client.mutate({ mutation: registerUserWithEmail });
    assert.equal(auth.currentUser.uid, result.data.registerUserWithEmail.userId);
    assert.equal(auth.currentUser.email, result.data.registerUserWithEmail.email);
    assert.equal(auth.currentUser.displayName, result.data.registerUserWithEmail.displayName);

    await auth.signOut();

  }
};
