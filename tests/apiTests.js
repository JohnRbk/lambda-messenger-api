const assert = require('assert');
const uuidv1 = require('uuid/v1');
const api = require('../src/api.js');
const utils = require('./testUtils.js');

describe('API Unit Tests', () => {

  it('can post a message to a conversation', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');
    await api.registerUsers([mike, henry, steve]);

    const others = [henry.userId, steve.userId];

    const msg = await api.initiateConversation(mike.userId, others, 'hello');

    const postResult = await api.postMessage(msg.conversationId, mike.userId, 'hi');
    assert(postResult.timestamp);
    assert.equal('hi', postResult.message);
    assert.equal(mike.userId, postResult.sender);
    const conversation = await api.getConversation(msg.conversationId, mike.userId);
    assert.equal(3, conversation.users.length);
    assert.equal(2, conversation.messages.length);

  });

  it('can remove a user from a conversation', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');

    await api.registerUsers([mike, henry, steve]);

    const msg = await api.initiateConversation(mike.userId, [steve.userId], 'hello');

    // Shouldn't be able to remove a user not part of a conversation
    let caughtRemovalError = false;
    try {
      await api.removeFromConversation(henry.userId, msg.conversationId);
    } catch (error) {
      assert.equal('User is not part of conversation', error.message);
      caughtRemovalError = true;
    }
    assert(caughtRemovalError);

    await api.joinConversation(henry.userId, msg.conversationId);

    const conversationUsers = await api.getConversationUsers(msg.conversationId);
    assert(conversationUsers.map(u => u.userId).includes(henry.userId) === true);

    await api.removeFromConversation(henry.userId, msg.conversationId);

    let caughtPostError = false;
    try {
      await api.postMessage(msg.conversationId, henry.userId, 'hi');
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

    const msg = await api.initiateConversation(mike.userId, others, 'hello');
    assert(msg.conversationId);

    const commonCid = await api.existingConversationIdAmongstUsers(
      [henry.userId, steve.userId, mike.userId],
    );

    assert.equal(commonCid, msg.conversationId);

  });

  it('can update a displayName', async() => {
    const u = utils.randomTestUser();

    const user = await api.registerUserWithEmail(u.userId, u.email, u.displayName);
    await api.updateUser(user.userId, 'Austin');
    const foundUser = await api.getUser(user.userId);
    assert.equal('Austin', foundUser.displayName);

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

  it('can not register a user with bad data', () => {
    const badRegister = api.registerUserWithEmail(undefined, undefined,
      undefined);
    return badRegister
      .catch(error => error)
      .then((thrownError) => {
        assert(thrownError !== undefined);
        assert(thrownError instanceof Error);
      });
  });

  it('can prevent users eavesdropping on a conversation', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const eavesdropper = utils.randomTestUser('eavesdropper');
    await api.registerUsers([mike, henry, eavesdropper]);
    const msg = await api.initiateConversation(mike.userId, [henry.userId], 'hello');
    assert(msg.conversationId);

    let caughtError = false;

    try {
      await api.getConversation(msg.conversationId, eavesdropper.userId);
    } catch (error) {
      assert.equal('User is not part of conversation', error.message);
      caughtError = true;
    }

    assert(caughtError);

  });

  it('can prevent fake users from initiating a converation', async () => {
    let raisedException = false;
    try {
      await api.initiateConversation(uuidv1(), [uuidv1()], 'hello');
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

    await api.initiateConversation(mike.userId, others, 'hello');

    [mike, henry, steve].forEach(async (user) => {
      const convoIds = await api.getConversationIds(user.userId);
      assert.equal(1, convoIds.length);
      const convo = await api.getConversation(convoIds[0], user.userId);
      assert(convo.messages.length === 1);
      assert.equal('hello', convo.messages[0].message);
    });

  });


  it('can validate a user', () => {
    const u = utils.randomTestUser();

    return api.validateUserIds([uuidv1()])
      .then((isValid) => {
        assert(isValid === false);
        return api.registerUserWithPhoneNumber(u.userId, u.phoneNumber, u.displayName);
      })
      .then(user => api.validateUserIds([user.userId]))
      .then((isValid) => {
        assert(isValid === true);
      });
  });

  it('can handle an invalid userId when getting a user', () => {
    return api.getUser('bad id')
      .catch(() => assert.fail('should not throw an error'))
      .then((thrownError) => {
        assert(thrownError === undefined);
      });
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
    return api.initiateConversation(uuidv1(), [uuidv1()], 'hello')
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

    const m1 = await api.initiateConversation(mike.userId, others, 'hello');
    const m2 = await api.initiateConversation(mike.userId, others, 'hello');
    assert.equal(m1.conversationId, m2.conversationId);
  });

  it('can get all users participating in a conversation', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');

    await api.registerUsers([mike, henry, steve]);

    const others = [henry.userId, steve.userId];

    const msg = await api.initiateConversation(mike.userId, others, 'hello');

    const users = await api.getConversationUsers(msg.conversationId);

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
      .then(() => api.initiateConversation(u1.userId, [u2.userId], 'hello'))
      .then(msg => msg.conversationId)
      .then(cid => api.postMessage(cid, 'invalid usser', 'im crashing'))
      .catch(err => err)
      .then((thrownError) => {
        assert.equal('Sender is not valid', thrownError.message);
      });
  });

  it('can get all message history', () => {
    const u1 = utils.randomTestUser();
    const u2 = utils.randomTestUser();
    const u3 = utils.randomTestUser();
    const p1 = api.registerUserWithPhoneNumber(u1.userId, u1.phoneNumber,
      u1.displayName);
    const p2 = api.registerUserWithPhoneNumber(u2.userId, u2.phoneNumber,
      u2.displayName);
    const p3 = api.registerUserWithPhoneNumber(u3.userId, u3.phoneNumber,
      u3.displayName);

    return Promise.all([p1, p2, p3])
      .then(() => api.initiateConversation(u1.userId, [u2.userId, u3.userId], 'hello'))
      .then(msg => msg.conversationId)
      .then(cid => api.postMessage(cid, u1.userId, 'hi')
        .then(() => api.getConversationHistory(
          u1.userId,
        ))
        .then((history) => {
          assert.equal(1, history.length);
          assert.equal('hello', history[0].messages[0].message);
          assert.equal('hi', history[0].messages[1].message);
        }));
  });

});
