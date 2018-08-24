// const firebase = require('firebase');
const admin = require('firebase-admin');
const utils = require('../tests/testUtils.js');
const api = require('../src/api.js');

utils.initializeFirebaseIfNeeded();
utils.initializeFirebaseAdminIfNeeded();

admin.auth().listUsers().then(async(listResult) => {

  const allUsers = listResult.users;
  const firebaseDeletions = [];
  const dynamoDeletions = [];

  // allUsers.filter(u => u.email && u.email.endsWith('@example.com'))
  allUsers
    .forEach((user) => {

      const delayedDeletePromise = () => new Promise((resolve, reject) => {

      // Firebase throttles requests, so we delay this a little bit
        setTimeout(() => {
          admin.auth().deleteUser(user.uid)
            .then(() => {
              console.log(`deleted user ${user.uid} ${user.email || user.phoneNumber}`);
              resolve();
            })
            .catch(error => reject(error));
        }, 100);

      });
      firebaseDeletions.push(delayedDeletePromise);
      dynamoDeletions.push(api.deleteUser(user.uid));
    });

  for (let i = 0; i < firebaseDeletions.length; i += 1) {
    const d = firebaseDeletions[i];
    // eslint-disable-next-line no-await-in-loop
    await d();
  }

  await Promise.all(dynamoDeletions);

}).finally(() => admin.app().delete());
