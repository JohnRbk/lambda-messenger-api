/* eslint-disable-next-line import/no-extraneous-dependencies */
const AWS = require('aws-sdk');
const uuidv1 = require('uuid/v1');
const { parseNumber } = require('libphonenumber-js');

AWS.config.update({
  region: 'us-east-1',
});

const docClient = new AWS.DynamoDB.DocumentClient();

/*

Note how these fields are mapped to the JWT token:

"userId": $utils.toJson($context.identity.claims.sub),
"email" : $utils.toJson($context.identity.claims.email),
"phoneNumber" : $utils.toJson($context.identity.claims.phone_number),
"displayName" : $utils.toJson($context.identity.claims.name)

*/

/**
  Returns a user object for the corresponding id. If the userId is
  not found, undefined is returned.
*/
function getUser(userId) {
  const params = {
    TableName: 'users',
    Key: {
      userId,
    },
  };

  return docClient.get(params).promise().then(data => data.Item);

}

/**
* Validates that the array of userIds are all in the user database
*/
function validateUserIds(userIds) {

  if (Array.isArray(userIds) === false) {
    return Promise.reject(Error('validateUserIds requirs array'));
  }

  const promises = [];

  userIds.forEach((userId) => {
    promises.push(getUser(userId));
  });

  return Promise.all(promises)
    .then((result) => {
      const numFound = result.filter(u => u && u.userId).length;
      return userIds.length === numFound;
    });
}

function lookupUserByPhoneNumber(phoneNumber) {
  const params = {
    TableName: 'users',
    IndexName: 'users-phone-index',
    KeyConditionExpression: 'phoneNumber = :phoneNumber',
    ExpressionAttributeValues: {
      ':phoneNumber': phoneNumber,
    },
  };

  return docClient.query(params).promise().then(data => data.Items[0]);
}

function lookupUserByEmail(email) {
  const params = {
    TableName: 'users',
    IndexName: 'users-email-index',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email,
    },
  };

  return docClient.query(params).promise().then(data => data.Items[0]);
}

function getConversationIds(userId) {

  if (typeof userId !== 'string') {
    return Promise.reject(Error('getConversationIds requires userId as a string type'));
  }

  const getParams = {
    TableName: 'conversations',
    KeyConditionExpression: '#userId = :userId',
    ExpressionAttributeNames: {
      '#userId': 'userId',
    },
    ExpressionAttributeValues: {
      ':userId': userId,
    },
  };

  return docClient.query(getParams).promise()
    .then(data => data.Items.map(
      conversation => conversation.conversationId,
    ));
}

async function getConversationUsers(conversationId) {
  const params = {
    TableName: 'conversations',
    IndexName: 'conversations-cid',
    KeyConditionExpression: 'conversationId = :conversationId',
    ExpressionAttributeValues: {
      ':conversationId': conversationId,
    },
  };

  const conversationUsers = await docClient.query(params).promise();
  const conversationUserIds = conversationUsers.Items.map(u => u.userId);
  const getUserPromises = [];
  conversationUserIds.forEach(user => getUserPromises.push(getUser(user)));
  return Promise.all(getUserPromises);

}

async function removeFromConversation(userId, conversationId) {
  const conversationUsers = await getConversationUsers(conversationId);
  if (conversationUsers.map(u => u.userId).includes(userId) === false) {
    return Promise.reject(Error('User is not part of conversation'));
  }
  const params = {
    TableName: 'conversations',
    Key: {
      userId,
      conversationId,
    },
  };

  return docClient.delete(params).promise();
}

/**
 * Gets the conversation as requested by userId since the time specified.
 * (If no timestamp is specified, it retrieves the full conversation
 */
async function getConversation(conversationId, userId, since = undefined) {

  if (!conversationId || !userId) {
    return Promise.reject(Error('invalid parameters for getConversation'));
  }

  const params = {
    TableName: 'messages',
    KeyConditionExpression: 'conversationId = :conversationId',
    ExpressionAttributeValues: {
      ':conversationId': conversationId,
    },
  };

  const allUsers = await getConversationUsers(conversationId);
  if (allUsers.map(u => u.userId).includes(userId) === false) {
    return Promise.reject(Error('User is not part of conversation'));
  }

  const data = await docClient.query(params).promise();

  const messages = data.Items;

  return {
    conversationId,
    users: allUsers,
    messages,
  };

}

/**
* Gets a full set of conversations a use has had
*/
function getConversationHistory(userId) {
  return getConversationIds(userId).then((conversations) => {
    const promises = [];
    conversations.forEach((c) => {
      promises.push(getConversation(c, userId));
    });
    return Promise.all(promises);
  });
}

async function joinConversation(userId, conversationId) {
  const conversationUsers = await getConversationUsers(conversationId);
  if (conversationUsers.map(u => u.userId).includes(userId) === true) {
    return Promise.reject(Error('User already part of conversation'));
  }
  const params = {
    TableName: 'conversations',
    Item: {
      userId,
      conversationId,
    },
  };
  return docClient.put(params).promise();
}

async function existingConversationIdAmongstUsers(users) {

  const promises = users.map(user => getConversationIds(user));

  const conversations = await Promise.all(promises);

  const commonCid = conversations.reduce((a, b) => a.filter(c => b.includes(c)));

  if (commonCid.length === 1) {
    return commonCid[0];
  }

  return undefined;

}

/*
* Generates a conversation id that is shared by the user and others. This allows
* the group to post messages to one another.
*/
async function initiateConversation(userId, others) {
  const cid = uuidv1();

  if (typeof userId !== 'string') {
    return Promise.reject(Error(`initiateConversation requires userId string parameter but had ${userId} instead`));
  }

  if (Array.isArray(others) === false) {
    return Promise.reject(Error('initiateConversation requires array'));
  }

  // Do not create a new Conversation if one already exists
  const allUsers = [userId, ...others];
  const existingCid = await existingConversationIdAmongstUsers(allUsers);
  if (existingCid !== undefined) {
    return existingCid;
  }

  const params = {
    TableName: 'conversations',
    Item: {
      userId,
      conversationId: cid,
    },
  };

  const conversationTableEntries = [];

  others.forEach((otherUser) => {

    const newParams = {
      TableName: 'conversations',
      Item: {
        userId: otherUser,
        conversationId: cid,
      },
    };
    conversationTableEntries.push(docClient.put(newParams).promise());

  });

  const thisUsersConversationEntry = docClient.put(params).promise();

  const allUsersValid = await validateUserIds([userId, ...others]);
  if (allUsersValid === false) {
    return Promise.reject(Error('UserIds not valid'));
  }

  const conversationsToSave = [thisUsersConversationEntry, ...conversationTableEntries];

  return Promise.all(conversationsToSave).then(() => cid);
}

/**
 * Performs a simple email validation.
 */
function validateEmail(email) {
  /* eslint-disable-next-line no-useless-escape */
  const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

/**
* Registers a user using a userId, email, and displayName. When called via
* appsync, these variables are retrived from the $context.identity.claims
* object which is populated automatically using the Authentication token
* passed in the request header. Calls to this function made from Appsync
* are guaranteed to be authenticated against the OIDC provider (Firebase)
*/
async function registerUserWithEmail(userId, email, displayName) {

  if (!userId || !email || !displayName) {
    return Promise.reject(Error('Invalid parameters to call registerUserWithEmail'));
  }

  if (validateEmail(email) === false) {
    return Promise.reject(Error(`Invalid email ${email}`));
  }

  const params = {
    TableName: 'users',
    ConditionExpression: 'attribute_not_exists(userId)',
    Item: {
      userId,
      email,
      displayName,
    },
  };

  const user = await lookupUserByEmail(email);
  if (user) {
    return Promise.reject(Error(`User with email ${email} already exists`));
  }

  await docClient.put(params).promise().catch((error) => {
    if (error.code === 'ConditionalCheckFailedException') {
      return Promise.reject(Error('User already exists'));
    }
    return Promise.reject(error);
  });

  return {
    userId,
    email,
    displayName,
  };

}

/**
* deletes the user from the DynamoDB table
*/
async function deleteUser(userId) {
  const params = {
    TableName: 'users',
    Key: {
      userId,
    },
  };

  return docClient.delete(params).promise();
}

/**
* Registers a user using a userId, email, and phoneNumber. When called via
* appsync, these variables are retrived from the $context.identity.claims
* object which is populated automatically using the Authentication token
* passed in the request header. Calls to this function made from Appsync
* are guaranteed to be authenticated against the OIDC provider (Firebase)
*/
async function registerUserWithPhoneNumber(userId, phoneNumber, displayName) {
  // console.log(`Registering ${displayName} ${userId} ${phoneNumber}`);

  if (parseNumber(phoneNumber, 'US').phone === undefined) {
    return Promise.reject(Error(`Invalid phone number ${phoneNumber}`));
  }

  const params = {
    TableName: 'users',
    ConditionExpression: 'attribute_not_exists(userId)',
    Item: {
      userId,
      phoneNumber,
      displayName,
    },
  };

  const user = await lookupUserByPhoneNumber(phoneNumber);
  if (user) {
    return Promise.reject(Error('User with phone number already exists'));
  }

  await docClient.put(params).promise().catch((error) => {
    if (error.code === 'ConditionalCheckFailedException') {
      return Promise.reject(Error('User already exists'));
    }
    return Promise.reject(error);
  });

  return {
    userId,
    phoneNumber,
    displayName,
  };

}

/**
* Posts a mesage from the sender to the group participating in the
* conversation.
*/
async function postMessage(conversationId, sender, message, ts = undefined) {

  const timestamp = !ts ? new Date().toISOString() : ts;

  if (!sender) {
    return Promise.reject(Error('sender must be set'));
  }

  const params = {
    TableName: 'messages',
    Item: {
      conversationId,
      timestamp,
      message,
      sender,
    },
  };

  const user = await getUser(sender);
  if (!user) {
    throw new Error('Sender is not valid');
  }

  const conversationIds = await getConversationIds(user.userId);
  if (conversationIds.includes(conversationId) === false) {
    return Promise.reject(Error('Sender is not part of the conversation'));
  }

  return docClient.put(params).promise().then(() => ({
    conversationId,
    message,
    sender,
    timestamp,
  }));

}

async function registerUsers(users) {
  const promises = users.map((user) => {
    if (user.phoneNumber) {
      return registerUserWithPhoneNumber(user.userId, user.phoneNumber,
        user.displayName);
    }
    return registerUserWithEmail(user.userId, user.email,
      user.displayName);

  });
  return Promise.all(promises);
}

module.exports = {
  existingConversationIdAmongstUsers,
  registerUsers,
  removeFromConversation,
  joinConversation,
  deleteUser,
  postMessage,
  getConversation,
  getConversationHistory,
  initiateConversation,
  getConversationIds,
  getConversationUsers,
  lookupUserByPhoneNumber,
  lookupUserByEmail,
  getUser,
  registerUserWithEmail,
  registerUserWithPhoneNumber,
  validateUserIds,
};
