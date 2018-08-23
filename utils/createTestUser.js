const firebase = require('firebase');
const { argv } = require('yargs');
const utils = require('../tests/testUtils.js');
const api = require('../api.js');

utils.initializeFirebaseIfNeeded();

async function main() {

  const password = 'abc123';
  const auth = firebase.auth();

  if (argv.newUser) {
    const email = utils.randomEmail('test-user');
    await auth.createUserWithEmailAndPassword(email, password)
      .catch((error) => {
        if (error.code !== 'auth/email-already-in-use') {
          throw new Error('Error making new user');
        }
      });

    await auth.signInWithEmailAndPassword(email, password);
    await auth.currentUser.updateProfile({ displayName: 'Test User' });
    await auth.currentUser.getIdToken(true);
    await api.registerUserWithEmail(
      auth.currentUser.uid,
      auth.currentUser.email,
      auth.currentUser.displayName,
    );

  } else if (argv.user) {
    const email = argv.user;
    await auth.signInWithEmailAndPassword(email, password);

  } else {
    console.log('Usage:');
    console.log('node utils/createFirebaseTestUser.js --new-user');
    console.log('node utils/createFirebaseTestUser.js --user bob@example.com');
    process.exit();
  }

  const tokenResult = await await auth.currentUser.getIdTokenResult(false);

  console.log(tokenResult);

}

main();
