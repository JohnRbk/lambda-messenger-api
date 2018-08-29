const AWS = require('aws-sdk');

AWS.config.update({
  region: 'us-east-1',
});

function createTables() {
  return Promise.all([
    createMesssagesTable(),
    createConversationsTable(),
    createUsersTable(),
  ]);
}

function createMesssagesTable() {

  const dynamodb = new AWS.DynamoDB();

  const params = {
    TableName: 'messages',
    KeySchema: [{
      AttributeName: 'conversationId',
      KeyType: 'HASH',
    }, // Partition key
    {
      AttributeName: 'timestamp',
      KeyType: 'RANGE',
    }, // Sort key
    ],
    AttributeDefinitions: [{
      AttributeName: 'conversationId',
      AttributeType: 'S',
    }, {
      AttributeName: 'timestamp',
      AttributeType: 'S',
    }],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1,
    },
    StreamSpecification: {
      StreamEnabled: true,
      StreamViewType: 'KEYS_ONLY',
    },


  };

  return dynamodb.createTable(params).promise();

}


function createUsersTable() {

  const dynamodb = new AWS.DynamoDB();

  const params = {
    TableName: 'users',
    KeySchema: [{
      AttributeName: 'userId',
      KeyType: 'HASH',
    }],
    AttributeDefinitions: [{
      AttributeName: 'userId',
      AttributeType: 'S',
    }, {
      AttributeName: 'phoneNumber',
      AttributeType: 'S',
    }, {
      AttributeName: 'email',
      AttributeType: 'S',
    }],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1,
    },
    GlobalSecondaryIndexes: [{
      IndexName: 'users-phone-index',
      /* required */
      KeySchema: [{
        AttributeName: 'phoneNumber',
        /* required */
        KeyType: 'HASH', /* required */
      }],
      Projection: { /* required */

        ProjectionType: 'ALL',
      },
      ProvisionedThroughput: { /* required */
        ReadCapacityUnits: 1,
        /* required */
        WriteCapacityUnits: 1, /* required */
      },
    }, {
      IndexName: 'users-email-index',
      /* required */
      KeySchema: [{
        AttributeName: 'email',
        /* required */
        KeyType: 'HASH', /* required */
      }],
      Projection: { /* required */

        ProjectionType: 'ALL',
      },
      ProvisionedThroughput: { /* required */
        ReadCapacityUnits: 1,
        /* required */
        WriteCapacityUnits: 1, /* required */
      },
    }],
  };

  return dynamodb.createTable(params).promise();

}

function createConversationsTable() {

  const dynamodb = new AWS.DynamoDB();

  const params = {
    TableName: 'conversations',
    KeySchema: [{
      AttributeName: 'userId',
      KeyType: 'HASH',
    }, {
      AttributeName: 'conversationId',
      KeyType: 'RANGE',
    }],
    AttributeDefinitions: [{
      AttributeName: 'userId',
      AttributeType: 'S',
    }, {
      AttributeName: 'conversationId',
      AttributeType: 'S',
    }],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1,
    },
    GlobalSecondaryIndexes: [{
      IndexName: 'conversations-cid',
      /* required */
      KeySchema: [{
        AttributeName: 'conversationId',
        /* required */
        KeyType: 'HASH', /* required */
      }, {
        AttributeName: 'userId',
        /* required */
        KeyType: 'RANGE', /* required */
      },
        /* more items */
      ],
      Projection: { /* required */

        ProjectionType: 'KEYS_ONLY',
      },
      ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
      },
    },
      /* more items */
    ],
  };

  return dynamodb.createTable(params).promise();

}

createTables();
