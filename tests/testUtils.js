const uuidv1 = require('uuid/v1');
const firebase = require('firebase');
const admin = require('firebase-admin');
const firebaseConfig = require('../config/firebase-config');
const config = require('../config/config.json');
const serviceAccount = require('../config/serviceAccountKey.json');

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomIntFromInterval(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomEmail(name = undefined) {
  return name !== undefined ? `${name}-${uuidv1()}@example.com`
    : `${uuidv1()}@example.com`;
}

function randomTestUser(name) {
  const randomPhoneNumber = `${randomIntFromInterval(200, 999)}${randomIntFromInterval(1000, 9999)}`;
  return {
    userId: uuidv1(),
    phoneNumber: `+1212${randomPhoneNumber}`,
    displayName: name === undefined ? uuidv1() : name,
    email: randomEmail(name),
  };
}

// Note that an update to a displayName require the JWT token
// to be retreived again or the claims will be incorrect
function createFirebaseUserWithEmail(email, password, displayName) {
  if (firebase.apps.length === 0) {
    return Promise.reject(Error('Firebase needs to be initialized'));
  }

  const auth = firebase.auth();

  return new Promise((resolve, reject) => {
    return auth.createUserWithEmailAndPassword(email, password)
      .then(() => auth.signInWithEmailAndPassword(email, password))
      .then(() => auth.currentUser.updateProfile({ displayName }))
      .then(() => auth.currentUser.getIdToken(true))
      .then(() => resolve(auth.currentUser))
      .catch((error) => {
        console.log(error);
        reject(error);
      });
  });

}

function deleteFirebaseUserWithEmail(email) {
  if (admin.apps.length === 0) {
    return Promise.reject(Error('Firebase Admin needs to be initialized'));
  }

  return admin.auth().getUserByEmail(email).then((user) => {
    return admin.auth().deleteUser(user.uid);
  }).catch((error) => {
    return Promise.reject(error);
  });
}

function initializeFirebaseAdminIfNeeded() {
  // https://stackoverflow.com/questions/37652328/how-to-check-if-a-firebase-app-is-already-initialized-on-android
  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: config.FIREBASE_DATABASE_URL,
    });
  }
}

function initializeFirebaseIfNeeded() {
  // https://stackoverflow.com/questions/37652328/how-to-check-if-a-firebase-app-is-already-initialized-on-android
  if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
  }
}

module.exports = {
  timeout,
  randomEmail,
  initializeFirebaseIfNeeded,
  randomTestUser,
  createFirebaseUserWithEmail,
  deleteFirebaseUserWithEmail,
  initializeFirebaseAdminIfNeeded,
};
