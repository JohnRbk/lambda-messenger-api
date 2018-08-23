const api = require('../api.js');

async function example() {
  const john = await api.registerUserWithEmail('UserId123456778967', 'john68769@example.com', 'John');
  const sarah = await api.registerUserWithEmail('UserId567890778697', 'sarah68967@example.com', 'Sarah');
  const anthony = await api.registerUserWithEmail('UserId90786586879', 'anthony66798@example.com', 'Anthony');

  console.log(john);

  const conversationId = await api.initiateConversation(
    john.userId,
    [sarah.userId, anthony.userId],
  );
  console.log(conversationId);
  await api.postMessage(conversationId, john.userId, 'hello');
  await api.postMessage(conversationId, sarah.userId, 'hi');
  const conversation = await api.getConversation(conversationId, anthony.userId);
  console.log(conversation);
}

Promise.resolve(example());
