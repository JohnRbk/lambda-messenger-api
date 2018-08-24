const api = require('./api.js');
/* eslint-disable func-names, no-unused-vars */

exports.postMessage = async function(event, context) {
  return api.postMessage(
    event.arguments.conversationId,
    event.user.userId,
    event.arguments.message,
  );
};

exports.updateUser = async function(event, context) {
  return api.updateUser(event.user.userId, event.arguments.displayName);
};

exports.registerUserWithPhoneNumber = async function(event, context) {
  return api.registerUserWithPhoneNumber(
    event.user.userId,
    event.user.phoneNumber,
    event.user.displayName,
  );
};

exports.registerUserWithEmail = async function(event, context) {
  return api.registerUserWithEmail(
    event.user.userId,
    event.user.email,
    event.user.displayName,
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
    event.arguments.message,
  );
};
