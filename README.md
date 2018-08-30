# Lambda Messenger API
<img src="docs/images/lamb-launchscreen.png" alt="lamb" width="100"/>

LambdaMessenger is a prototype for a serverless chat app using AWS AppSync, Node.js Lambda Functions, and DynamoDB. It was developed in an effort to evaluate [AWS AppSync](https://aws.amazon.com/appsync/).

Check out the [LambdaMessenger iOS app](https://github.com/JohnRbk/lambda-messenger-ios) which uses these APIs.

Here is how the API works:

Register a user with the [Firebase Authentication](https://firebase.google.com/docs/auth/) API:

```javascript
const auth = firebase.auth();
auth.createUserWithEmailAndPassword(email, password)
auth.signInWithEmailAndPassword(email, password)
```

Save the user in DynamoDB:

```javascript
const john = await api.registerUserWithEmail(userId, email, displayName);
const anthony = await api.registerUserWithEmail(userId, email, displayName);
```

Start up a conversation with other users:

```javascript
const conversationId = await api.initiateConversation(john.userId, [anthony.userId])
```

Send a message to other users. By default, this will also send an push notification to the users in the conversation if they have a device token saved in their profile:

```javascript
await api.postMessage(conversationId, john.userId, 'Hello')
```

Using [GraphQL Subscriptions](https://docs.aws.amazon.com/appsync/latest/devguide/real-time-data.html), messages can be retrieved realtime. See [this unit test](https://github.com/JohnRbk/lambda-messenger-api/blob/master/tests/appsyncSubscriptionTests.js) for an example of how to set up subscriptions.

## Getting Started

LambdaMessenger is fully serverless, so a number of configuration steps are needed for AWS and Firebase to host the APIs.

### Prerequisities

* You'll need both a Firebase account and an AWS account in order to test and run this project. Firebase is used for its user authentication API (it integrates with AWS Appsync).
* Make sure you're running Node.js v8.10 or higher
* Install and configure the [AWS CLI](https://aws.amazon.com/cli/)

### Config.json

The main settings for this project need to be specified in the `config/config.json` file. Use the `api/config.sample.json` as a baseline and rename it. You'll need to update this with your specific AWS and Firebase
 settings.

```json
{
  "LAMBDA_IAM_ROLE": "arn:aws:iam::XXXXXX:role/XXXXXXXXX",
  "CLOUDFORMATION_LAMBDA_STACK_NAME": "lambda-messenger-apis",
  "LAMBDA_PACKAGE_S3_BUCKET": "lambda-messenger",
  "APPSYNC_API_ID": "XXXXXXXXXXXXX",
  "APPSYNC_ENDPOINT_URL": "https://XXXXXXXXXXXX.appsync-api.XXXXXXXXX.amazonaws.com/graphql"
}
```

### Configuring Firebase & AWS
1. [Configure Firebase](docs/FIREBASE.md)
2. [Create an AWS IAM Role](docs/AWS-IAM.md)
3. [Create the AWS DynamoDB Tables](docs/AWS-DYNAMODB.md)
4. [Deploy AWS Lambda Functions](docs/AWS-LAMBDA.md)
5. [Configure AWS AppSync](docs/AWS-APPSYNC.md)

## Testing & Deployment

After Firebase and AWS are configured, the AppSync APIs can be tested using:

```bash
npx runjs test tests/apiTests.js # run local tests
npx runjs all && npm install && npm rebuild # Deploys everything
npx runjs tests # runs all tests, including integration tests
```

⚠️ After runnning `npx runjs all`, you'll need to re-run `npm install` since the packaging process removes dev dependencies from node_modules

## Built With

* [AWS AppSync](https://docs.aws.amazon.com/appsync)
* [AWS Lambda](https://aws.amazon.com/documentation/lambda/)
* [AWS DynamoDB](https://aws.amazon.com/documentation/dynamodb/)
* [Firebase](https://firebase.google.com/)

## Authors

* John Robokos

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE) file for details
