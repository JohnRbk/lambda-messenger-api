const assert = require('assert');
const uuidv1 = require('uuid/v1');
const api = require('../src/api.js');
const utils = require('./testUtils.js');

describe('API Unit Tests', () => {
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

  it('can get conversationId amongst users', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');

    await api.registerUsers([mike, henry, steve]);

    const others = [henry.userId, steve.userId];

    const cid = await api.initiateConversation(mike.userId, others);

    const commonCid = await api.existingConversationIdAmongstUsers(
      [henry.userId, steve.userId, mike.userId],
    );

    assert.equal(commonCid, cid);

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
    assert.equal(mike.userId, postResult.sender);
    const conversation = await api.getConversation(cid, mike.userId);
    assert.equal(3, conversation.users.length);
    assert.equal(1, conversation.messages.length);

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

  it('can create a conversation amongst users', async () => {
    const mike = utils.randomTestUser('mike');
    const henry = utils.randomTestUser('henry');
    const steve = utils.randomTestUser('steve');
    await api.registerUsers([mike, henry, steve]);

    const others = [henry.userId, steve.userId];

    await api.initiateConversation(mike.userId, others);

    [mike, henry, steve].forEach(async (user) => {
      const convos = await api.getConversationIds(user.userId);
      assert.equal(1, convos.length);
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

  it('can register a user with a phone number', () => {
    const u = utils.randomTestUser();

    return api.registerUserWithPhoneNumber(u.userId, u.phoneNumber, u.displayName)
      .then(user => api.getUser(user.userId))
      .then((user) => {
        assert.equal(u.userId, user.userId);
      });
  });

  it('can register a user with an email', () => {
    const u = utils.randomTestUser();

    return api.registerUserWithEmail(u.userId, u.email, u.displayName)
      .then((user) => {
        // console.log(user);
        return api.getUser(user.userId);
      })
      .then((user) => {
        assert.equal(u.email, user.email);
      });
  });

  it('can delete a user', () => {
    const u = utils.randomTestUser();

    return api.registerUserWithEmail(u.userId, u.email, u.displayName)
      .then(() => api.deleteUser(u.userId))
      .then(() => api.getUser(u.userId))
      .then((user) => {
        assert(!user);
      });
  });

  it('can find a user using a phone number', () => {
    const u = utils.randomTestUser();

    return api.lookupUserByPhoneNumber(u.phoneNumber)
      .then((user) => {
        assert(user === undefined);
        return api.registerUserWithPhoneNumber(u.userId, u.phoneNumber,
          u.displayName);
      })
      .then(user => api.lookupUserByPhoneNumber(user.phoneNumber))
      .then((user) => {
        assert.equal(u.phoneNumber, user.phoneNumber);
      });
  });

  it('can find a user using email', () => {
    const u = utils.randomTestUser();

    return api.lookupUserByEmail(u.email)
      .then((user) => {
        assert(user === undefined);
        return api.registerUserWithEmail(u.userId, u.email, u.displayName);
      })
      .then(user => api.lookupUserByEmail(user.email))
      .then((user) => {
        assert.equal(u.email, user.email);
      });
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
      .then(() => api.initiateConversation(u1.userId, [u2.userId, u3.userId]))
      .then(cid => api.postMessage(cid, u1.userId, 'hi')
        .then(() => api.getConversationHistory(
          u1.userId,
        ))
        .then((history) => {
          assert.equal(1, history.length);
          assert.equal('hi', history[0].messages[0].message);
        }));
  });
});
