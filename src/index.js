const api = require('./api.js');
/* eslint-disable func-names, no-unused-vars */

exports.postMessage = async function(event, context) {
  return api.postMessage(
    event.arguments.conversationId,
    event.user.userId,
    event.arguments.message,
    true, /* enable push notifications */
  );
};

exports.updateUser = async function(event, context) {
  return api.updateUser(
    event.user.userId,
    event.arguments.displayName,
    event.arguments.fcmToken,
  );
};

exports.registerUserWithPhoneNumber = async function(event, context) {
  return api.registerUserWithPhoneNumber(
    event.user.userId,
    event.user.phoneNumber,
    event.user.displayName,
    event.arguments.fcmToken,
  );
};

exports.registerUserWithEmail = async function(event, context) {
  return api.registerUserWithEmail(
    event.user.userId,
    event.user.email,
    event.user.displayName,
    event.arguments.fcmToken,
  );
};

exports.sendPushNotifications = async (event, context) => {
  return api.sendPushNotifications(
    event.arguments.conversationId,
    event.arguments.sender,
    event.arguments.message,
    event.arguments.dryRun,
  );
};

exports.getConversation = async function(event, context) {
  return api.getConversation(
    event.arguments.conversationId,
    event.user.userId,
    event.arguments.since,
  );
};

exports.lookupUserByPhoneNumber = async function(event, context) {
  return api.lookupUserByPhoneNumber(event.arguments.phoneNumber);
};

exports.lookupUserByEmail = async function(event, context) {
  return api.lookupUserByEmail(event.arguments.email);
};

exports.getConversationHistory = async function(event, context) {
  return api.getConversationHistory(event.user.userId);
};

exports.initiateConversation = async function(event, context) {
  return api.initiateConversation(
    event.user.userId,
    event.arguments.others,
  );
};
