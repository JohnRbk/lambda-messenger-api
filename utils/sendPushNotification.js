// const firebase = require('firebase');
const admin = require('firebase-admin');
const { argv } = require('yargs');
const AWS = require('aws-sdk');
const firebaseConfig = require('../config/firebase-config');
const config = require('../config/config.json');
const serviceAccount = require('../config/serviceAccountKey.json');

AWS.config.update({
  region: 'us-east-1',
});

async function sendUsingFirebaseAdmin() {

  const pushNotification = {
    apns: {
      headers: {
        'apns-priority': '10',
      },
      payload: {
        data: {
          conversationId: 'bar',
          user: { name: 'john' },
        },
        aps: {
          badge: 0,
          alert: {
            title: 'Received message from user',
            /* subtitle: 'this is a subtitle', */
            body: 'this is the body',
          },
          sound: 'default',
          // 'content-available': 1,
        },
      },
    },
    token: argv.fcmToken,
  };

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: config.FIREBASE_DATABASE_URL,
      projectId: firebaseConfig.projectId,
    });
  }

  // Send a message to the device corresponding to the provided
  // registration token.
  try {
    const response = await admin.messaging().send(pushNotification, false);
    return response;
  } catch (error) {
    return Promise.reject(error);
  } finally {
    admin.app().delete();
  }

}

async function sendUsingLambdaFunction() {
  const lambda = new AWS.Lambda();

  const sendPushNotificationParams = {
    InvocationType: 'Event',
    FunctionName: 'sendPushNotifications',
    Payload: JSON.stringify({
      arguments: {
        sender: argv.userId,
        conversationId: argv.conversationId,
        dryRun: false,
        message: 'test message',
      },
    }),
  };
  console.log(sendPushNotificationParams);
  await lambda.invoke(sendPushNotificationParams).promise();
}

// ///////////////////////////////////////////////////////////////////////

if (argv.useLambda && argv.userId && argv.conversationId) {
  sendUsingLambdaFunction();
} else if (argv.fcmToken) {
  sendUsingFirebaseAdmin();
} else {
  console.log('node utils/sendPushNotification.js --use-lambda --user-id "5AlUcdNvTkWKdGLYb3wYXuSrSYH3" --conversation-id "x12345"');
  console.log('node utils/sendPushNotification.js --fcm-token "token"');
}
