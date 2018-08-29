const assert = require('assert');
const uuidv1 = require('uuid/v1');
const api = require('../src/api.js');
const utils = require('./testUtils.js');

describe('API Unit Tests', () => {


  /* This will always throw an error since Firebase expects an actual FCMToken,
   * even when dryRun is enabled */
  it('can send a push notification', async () => {

    const u1 = utils.randomTestUser();
    const u2 = utils.randomTestUser();
    const user1 = await api.registerUserWithPhoneNumber(
      u1.userId, u1.phoneNumber, u1.displayName, u1.fcmToken,
    );
    const user2 = await api.registerUserWithPhoneNumber(
      u2.userId, u2.phoneNumber, u2.displayName, u2.fcmToken,
    );

    const cid = await api.initiateConversation(user1.userId, [user2.userId]);

    const dryRun = true;
    let raisedException = false;
    try {
      await api.sendPushNotifications(cid, user1.userId, 'hey', dryRun);
    } catch (error) {
      raisedException = true;
      assert(error.code === 'messaging/invalid-argument');
    }

    assert(raisedException);

  });


  it('can post a message to a conversation', async () => {

    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');
    await api.registerUsers([mike, henry, steve]);

    const others = [henry.userId, steve.userId];

    const cid = await api.initiateConversation(mike.userId, others);

    const postResult = await api.postMessage(cid, mike.userId, 'hi');
    assert(postResult.timestamp);
    assert.equal('hi', postResult.message);
    assert.equal(mike.userId, postResult.sender.userId);
    const conversation = await api.getConversation(cid, mike.userId);
    assert.equal(3, conversation.users.length);
    assert.equal(1, conversation.messages.length);
    assert.equal(mike.userId, conversation.messages[0].sender.userId);

  });

  it('can register a user with an fcmToken', async () => {
    const u = utils.randomTestUser();

    const user = await api.registerUserWithPhoneNumber(u.userId, u.phoneNumber, u.displayName, u.fcmToken);
    const foundUser = await api.getUser(user.userId);
    assert.equal(user.fcmToken, foundUser.fcmToken);
  });

  it('can update a displayName', async() => {
    const u = utils.randomTestUser();

    const user = await api.registerUserWithPhoneNumber(u.userId, u.phoneNumber, u.displayName, u.fcmToken);
    await api.updateUser(user.userId, 'Austin');
    const foundUser = await api.getUser(user.userId);
    assert.equal('Austin', foundUser.displayName);
    assert.equal(u.phoneNumber, foundUser.phoneNumber);
    assert.equal(u.fcmToken, foundUser.fcmToken);

  });

  it('can update an fcmToken', async() => {
    const u = utils.randomTestUser();

    const user = await api.registerUserWithPhoneNumber(u.userId, u.phoneNumber, u.displayName, u.fcmToken);
    await api.updateUser(user.userId, undefined, '56789');
    const foundUser = await api.getUser(user.userId);
    assert.equal(u.displayName, foundUser.displayName);
    assert.equal(u.phoneNumber, foundUser.phoneNumber);
    assert.equal('56789', foundUser.fcmToken);

  });

  it('can update both an fcmToken and name', async() => {
    const u = utils.randomTestUser();

    const user = await api.registerUserWithPhoneNumber(u.userId, u.phoneNumber, u.displayName, u.fcmToken);
    await api.updateUser(user.userId, 'Austin', '56789');
    const foundUser = await api.getUser(user.userId);
    assert.equal('Austin', foundUser.displayName);
    assert.equal(u.phoneNumber, foundUser.phoneNumber);
    assert.equal('56789', foundUser.fcmToken);

  });

  it('can handle errors when updating a displayName', async() => {

    let raisedException = false;
    try {
      await api.updateUser(uuidv1(), 'Austin');
    } catch (error) {
      assert.equal('User does not exist', error.message);
      raisedException = true;
    }
    assert(raisedException);

  });


  it('can update a displayName in older messages', async() => {
    const u1 = utils.randomTestUser();
    const u2 = utils.randomTestUser();
    await api.registerUsers([u1, u2]);

    const cid = await api.initiateConversation(u1.userId, [u2.userId]);

    await api.postMessage(cid, u1.userId, 'hi');
    await api.postMessage(cid, u2.userId, 'hey');
    const c1 = await api.getConversation(cid, u1.userId);

    assert.equal(u1.displayName, c1.messages[0].sender.displayName);
    assert.equal(u1.phoneNumber, c1.messages[0].sender.phoneNumber);
    assert.equal(u2.displayName, c1.messages[1].sender.displayName);

    await api.updateUser(u1.userId, 'Anne');

    const c2 = await api.getConversation(cid, u1.userId);
    assert.equal('Anne', c2.messages[0].sender.displayName);
    assert.equal(u2.displayName, c1.messages[1].sender.displayName);
    assert.equal(u2.phoneNumber, c1.messages[1].sender.phoneNumber);
  });

  it('can not start a conversation with yourself', async() => {
    const u1 = utils.randomTestUser();
    await api.registerUsers([u1]);

    let raisedException = false;
    try {
      await api.initiateConversation(u1.userId, [u1.userId]);
    } catch (error) {
      raisedException = true;
    }

    assert(raisedException);
  });

  it('can handle an invalid data when getting a user', async() => {
    const u1 = await api.getUser('bad id');
    const u2 = await api.lookupUserByEmail(utils.randomEmail());
    const u3 = await api.lookupUserByPhoneNumber(utils.randomPhoneNumber());
    assert(u1 === undefined);
    assert(u2 === undefined);
    assert(u3 === undefined);
  });

  it('can remove a user from a conversation', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');

    await api.registerUsers([mike, henry, steve]);

    const cid = await api.initiateConversation(mike.userId, [steve.userId]);

    // Shouldn't be able to remove a user not part of a conversation
    let caughtRemovalError = false;
    try {
      await api.removeFromConversation(henry.userId, cid);
    } catch (error) {
      assert.equal('User is not part of conversation', error.message);
      caughtRemovalError = true;
    }
    assert(caughtRemovalError);

    await api.joinConversation(henry.userId, cid);

    const conversationUsers = await api.getConversationUsers(cid);
    assert(conversationUsers.map(u => u.userId).includes(henry.userId) === true);

    await api.removeFromConversation(henry.userId, cid);

    let caughtPostError = false;
    try {
      await api.postMessage(cid, henry.userId, 'hi');
    } catch (error) {
      assert.equal('Sender is not part of the conversation', error.message);
      caughtPostError = true;
    }

    assert(caughtPostError);

  });

  it('can get conversationId amongst users', async () => {

    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');

    await api.registerUsers([mike, henry, steve]);

    const others = [henry.userId, steve.userId];

    const cid = await api.initiateConversation(mike.userId, others);
    assert(cid);

    const commonCid = await api.existingConversationIdAmongstUsers(
      [henry.userId, steve.userId, mike.userId],
    );

    assert.equal(commonCid, cid);

  });

  it('can handle errors getting conversationId amongst users', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');

    await api.registerUsers([mike, henry, steve]);

    let commonCid;

    let threwError = false;
    try {
      commonCid = await api.existingConversationIdAmongstUsers([]);
    } catch (error) {
      threwError = true;
    }
    assert(threwError);

    commonCid = await api.existingConversationIdAmongstUsers([uuidv1(), uuidv1()]);
    assert(commonCid === undefined);

    commonCid = await api.existingConversationIdAmongstUsers(
      [henry.userId, steve.userId, mike.userId],
    );

    assert(commonCid === undefined);

  });

  it('can not register a user with bad data', async() => {
    let raisedException = false;
    try {
      await api.registerUserWithEmail(undefined, undefined, undefined);
    } catch (error) {
      raisedException = true;
    }

    assert(raisedException);
  });

  it('can prevent users eavesdropping on a conversation', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const eavesdropper = utils.randomTestUser('eavesdropper');
    await api.registerUsers([mike, henry, eavesdropper]);
    const cid = await api.initiateConversation(mike.userId, [henry.userId]);
    assert(cid);

    let caughtError = false;

    try {
      await api.getConversation(cid, eavesdropper.userId);
    } catch (error) {
      assert.equal('User is not part of conversation', error.message);
      caughtError = true;
    }

    assert(caughtError);

  });

  it('can prevent fake users from initiating a converation', async () => {
    let raisedException = false;
    try {
      await api.initiateConversation(uuidv1(), [uuidv1()]);
    } catch (error) {
      raisedException = true;
    }
    assert(raisedException);
  });

  it('can create a conversation amongst users', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');
    await api.registerUsers([mike, henry, steve]);

    const others = [henry.userId, steve.userId];

    await api.initiateConversation(mike.userId, others);

    [mike, henry, steve].forEach(async (user) => {
      const convoIds = await api.getConversationIds(user.userId);
      assert.equal(1, convoIds.length);
      const convo = await api.getConversation(convoIds[0], user.userId);
      assert(convo.messages.length === 0);
    });

  });


  it('can validate a user', async () => {
    const u = utils.randomTestUser();

    const isValid = await api.validateUserIds([uuidv1()]);
    assert(isValid === false);
    const user = await api.registerUserWithPhoneNumber(u.userId, u.phoneNumber, u.displayName);
    assert(await api.validateUserIds([user.userId]));

  });

  it('can register a user with a phone number', async () => {
    const u = utils.randomTestUser();

    const user = await api.registerUserWithPhoneNumber(u.userId, u.phoneNumber, u.displayName);
    const foundUser = await api.getUser(user.userId);
    assert.equal(user.userId, foundUser.userId);
  });

  it('can register a user with an email', async () => {
    const u = utils.randomTestUser();

    const user = await api.registerUserWithEmail(u.userId, u.email, u.displayName);
    const foundUser = await api.getUser(user.userId);
    assert.equal(user.email, foundUser.email);
  });

  it('can delete a user', async () => {
    const u = utils.randomTestUser();

    await api.registerUserWithEmail(u.userId, u.email, u.displayName);
    await api.deleteUser(u.userId);
    const foundUser = await api.getUser(u.userId);
    assert(!foundUser);
  });

  it('can find a user using a phone number', async () => {
    const u = utils.randomTestUser();

    const user = await api.lookupUserByPhoneNumber(u.phoneNumber);
    assert(user === undefined);
    await api.registerUserWithPhoneNumber(u.userId, u.phoneNumber, u.displayName);
    const foundUser = await api.lookupUserByPhoneNumber(u.phoneNumber);
    assert.equal(u.phoneNumber, foundUser.phoneNumber);

  });

  it('can find a user using email', async () => {
    const u = utils.randomTestUser();

    const user = await api.lookupUserByEmail(u.email);
    assert(user === undefined);
    await api.registerUserWithEmail(u.userId, u.email, u.displayName);
    const foundUser = await api.lookupUserByEmail(u.email);
    assert.equal(u.email, foundUser.email);
  });

  it('can reject duplicate phone user registrations (userId)', () => {
    const u1 = utils.randomTestUser();
    const u2 = utils.randomTestUser();

    return api.registerUserWithPhoneNumber(u1.userId, u1.phoneNumber, u1.displayName)
      .then(() => api.registerUserWithPhoneNumber(u1.userId, u2.phoneNumber, u2.displayName))
      .catch(err => err)
      .then((caughtError) => {
        assert(caughtError instanceof Error === true);
        assert.equal(caughtError.message, 'User already exists');
      });
  });

  it('can reject duplicate email user registrations (userId)', () => {
    const u1 = utils.randomTestUser();
    const u2 = utils.randomTestUser();

    return api.registerUserWithEmail(u1.userId, u1.email, u1.displayName)
      .then(() => api.registerUserWithEmail(u1.userId, u2.email, u2.displayName))
      .catch(err => err)
      .then((caughtError) => {
        assert(caughtError instanceof Error === true);
        assert.equal(caughtError.message, 'User already exists');
      });
  });

  it('can reject duplicate user registrations (phoneNumber)', () => {
    const u1 = utils.randomTestUser();
    const u2 = utils.randomTestUser();

    return api.registerUserWithPhoneNumber(u1.userId, u1.phoneNumber, u1.displayName)
      .then(() => api.registerUserWithPhoneNumber(u2.userId, u1.phoneNumber, u2.displayName))
      .catch(err => err).then((caughtError) => {
        assert.equal(caughtError.message, 'User with phone number already exists');
      });
  });

  it('can reject duplicate user registrations (email)', () => {
    const u1 = utils.randomTestUser();
    const u2 = utils.randomTestUser();

    return api.registerUserWithEmail(u1.userId, u1.email, u1.displayName)
      .then(() => api.registerUserWithEmail(u2.userId, u1.email, u2.displayName))
      .catch(err => err).then((caughtError) => {
        assert(caughtError.message.match('User with email .* already exists') !== null);
      });
  });

  it('can reject invalid phone numbers', async () => {
    const testUser = {
      userId: uuidv1(),
      phoneNumber: 'INVALID_PHONE_NUMBER',
      displayName: 'John Smith',
    };

    let caughtError = false;
    try {
      await api.registerUserWithPhoneNumber(
        testUser.userId,
        testUser.phoneNumber,
        testUser.displayName,
      );
    } catch (error) {
      caughtError = true;
      assert(error.message.startsWith('Invalid phone number'));
    }

    assert(caughtError);

  });

  it('can prevent unregistered users from starting a conversation', () => {
    return api.initiateConversation(uuidv1(), [uuidv1()])
      .catch(error => error)
      .then((thrownError) => {
        assert(thrownError instanceof Error === true);
        assert.equal(thrownError.message, 'UserIds not valid');
      });
  });

  it('can ensure a duplicate conversation is not initiated', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');

    await api.registerUsers([mike, henry, steve]);

    const others = [henry.userId, steve.userId];

    const cid1 = await api.initiateConversation(mike.userId, others);
    const cid2 = await api.initiateConversation(mike.userId, others);
    assert.equal(cid1, cid2);
  });

  it('can get all users participating in a conversation', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');

    await api.registerUsers([mike, henry, steve]);

    const others = [henry.userId, steve.userId];

    const cid = await api.initiateConversation(mike.userId, others);

    const users = await api.getConversationUsers(cid);

    assert(users !== undefined);
    assert.equal(3, users.length);
    const userIds = users.map(u => u.userId);
    const expectedUserIds = [mike, henry, steve].map(u => u.userId);
    assert.deepStrictEqual(expectedUserIds, userIds);

  });

  it('can not post a message from an invalid user', () => {
    const u1 = utils.randomTestUser();
    const u2 = utils.randomTestUser();
    const u3 = utils.randomTestUser();

    const r1 = api.registerUserWithPhoneNumber(u1.userId, u1.phoneNumber,
      u1.displayName);
    const r2 = api.registerUserWithPhoneNumber(u2.userId, u2.phoneNumber,
      u2.displayName);
    const r3 = api.registerUserWithPhoneNumber(u3.userId, u3.phoneNumber,
      u3.displayName);

    return Promise.all([r1, r2, r3])
      .then(() => api.initiateConversation(u1.userId, [u2.userId]))
      .then(cid => api.postMessage(cid, 'invalid usser', 'im crashing'))
      .catch(err => err)
      .then((thrownError) => {
        assert.equal('Sender is not valid', thrownError.message);
      });
  });

  it('can get all message history', async () => {
    const u1 = utils.randomTestUser();
    const u2 = utils.randomTestUser();
    const u3 = utils.randomTestUser();
    const p1 = api.registerUserWithPhoneNumber(u1.userId, u1.phoneNumber,
      u1.displayName);
    const p2 = api.registerUserWithPhoneNumber(u2.userId, u2.phoneNumber,
      u2.displayName);
    const p3 = api.registerUserWithPhoneNumber(u3.userId, u3.phoneNumber,
      u3.displayName);

    await Promise.all([p1, p2, p3]);

    const cid = await api.initiateConversation(u1.userId, [u2.userId, u3.userId]);

    await api.postMessage(cid, u1.userId, 'hi');
    const history = await api.getConversationHistory(u1.userId);
    assert.equal(1, history.length);
    assert.equal('hi', history[0].messages[0].message);

  });

});
