import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, ObjectId } from 'mongodb';
import { resolveOwnerCriteria, resolveIdentifierCriteria } from './fisherIdentity.js';

// Run against a real MongoDB rather than a fake collection: the bug this
// module exists to prevent was a query that was shaped wrongly, and a fake
// would have accepted the broken shape as readily as the correct one.
let mongo;
let client;
let db;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  client = new MongoClient(mongo.getUri());
  await client.connect();
  db = client.db('test');
});

afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});

beforeEach(async () => {
  await db.collection('users').deleteMany({});
  await db.collection('waypoints').deleteMany({});
});

const users = () => db.collection('users');
const waypoints = () => db.collection('waypoints');

describe('resolveOwnerCriteria', () => {
  it('prefers IMEI over every other identifier', async () => {
    const criteria = await resolveOwnerCriteria(
      { imei: '111', userId: 'ignored', username: 'ignored' },
      users()
    );

    expect(criteria).toEqual({ imei: '111' });
  });

  it('resolves a userId to the IMEI when the user has one', async () => {
    const id = new ObjectId();
    await users().insertOne({ _id: id, IMEI: '222', username: 'kito' });

    const criteria = await resolveOwnerCriteria({ userId: id.toHexString() }, users());

    expect(criteria).toEqual({ imei: '222' });
  });

  it('falls back to username when no other identifier is given', async () => {
    const criteria = await resolveOwnerCriteria({ username: 'kito' }, users());

    expect(criteria).toEqual({ username: 'kito' });
  });

  it('throws when no identifier is supplied', async () => {
    await expect(resolveOwnerCriteria({}, users())).rejects.toThrow(
      'userId, username, or imei is required'
    );
  });

  // The divergence this module was extracted to kill: userId is stored as an
  // ObjectId when it parses as one and as a string otherwise, so a query that
  // matches only the parsed form hides records written the other way.
  describe('a userId stored in either form', () => {
    it('matches a record whose userId is an ObjectId', async () => {
      const id = new ObjectId();
      await users().insertOne({ _id: id, IMEI: null });
      await waypoints().insertOne({ name: 'reef', userId: id });

      const criteria = await resolveOwnerCriteria({ userId: id.toHexString() }, users());
      const found = await waypoints().find(criteria).toArray();

      expect(found.map((w) => w.name)).toEqual(['reef']);
    });

    it('matches a record whose userId is the same id stored as a string', async () => {
      const id = new ObjectId();
      await users().insertOne({ _id: id, IMEI: null });
      await waypoints().insertOne({ name: 'anchorage', userId: id.toHexString() });

      const criteria = await resolveOwnerCriteria({ userId: id.toHexString() }, users());
      const found = await waypoints().find(criteria).toArray();

      expect(found.map((w) => w.name)).toEqual(['anchorage']);
    });

    it('matches both forms in one query', async () => {
      const id = new ObjectId();
      await users().insertOne({ _id: id, IMEI: null });
      await waypoints().insertMany([
        { name: 'reef', userId: id },
        { name: 'anchorage', userId: id.toHexString() },
      ]);

      const criteria = await resolveOwnerCriteria({ userId: id.toHexString() }, users());
      const found = await waypoints().find(criteria).toArray();

      expect(found.map((w) => w.name).sort()).toEqual(['anchorage', 'reef']);
    });
  });

  it('queries a non-ObjectId userId such as admin as a plain string', async () => {
    await users().insertOne({ _id: 'admin', IMEI: null });
    await waypoints().insertOne({ name: 'test spot', userId: 'admin' });

    const criteria = await resolveOwnerCriteria({ userId: 'admin' }, users());
    const found = await waypoints().find(criteria).toArray();

    expect(criteria).toEqual({ userId: 'admin' });
    expect(found.map((w) => w.name)).toEqual(['test spot']);
  });

  it('falls back to the userId itself when it matches no user', async () => {
    const id = new ObjectId();

    const criteria = await resolveOwnerCriteria({ userId: id.toHexString() }, users());

    expect(criteria).toEqual({ $or: [{ userId: id }, { userId: id.toHexString() }] });
  });
});

describe('resolveIdentifierCriteria', () => {
  it('matches an IMEI, a username or a boat name in one query', async () => {
    const events = db.collection('catch-events');
    await events.deleteMany({});
    await events.insertMany([
      { label: 'by imei', imei: 'shared' },
      { label: 'by username', username: 'shared' },
      { label: 'by boat', boatName: 'shared' },
      { label: 'unrelated', imei: 'other' },
    ]);

    const found = await events.find(resolveIdentifierCriteria('shared')).toArray();

    expect(found.map((e) => e.label).sort()).toEqual(['by boat', 'by imei', 'by username']);
  });

  it('throws when the identifier is missing', () => {
    expect(() => resolveIdentifierCriteria(undefined)).toThrow(
      'User identifier (IMEI or username) is required'
    );
  });
});
