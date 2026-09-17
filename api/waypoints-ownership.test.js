import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';
import { issueToken } from './_utils/token.js';

/**
 * Can one fisher edit or delete another fisher's waypoint?
 *
 * These now prove authorization rather than merely documenting its absence.
 * Every caller below is identified by a signed token, and the endpoints no
 * longer read an id from the request at all — so naming the owner buys a
 * stranger nothing, which is what step 4 of docs/API-AUTH-PLAN.md set out to
 * achieve. The test named "even when they name the owner" is the one that
 * used to be impossible to pass.
 *
 * A refactor that reintroduced a caller-supplied id would leave every screen
 * looking the same and quietly reopen the hole, so these run on every commit.
 */

let db;
let waypointById;
let waypointsHandler;

const owner = new ObjectId();
const stranger = new ObjectId();

beforeAll(async () => {
  db = await startTestDatabase();
  process.env.AUTH_TOKEN_SECRET = 'ownership-test-signing-secret';
  waypointById = (await import('./waypoints/[id].js')).default;
  waypointsHandler = (await import('./waypoints.js')).default;
});

afterAll(stopTestDatabase);

let waypointId;

beforeEach(async () => {
  await db.collection('waypoints').deleteMany({});
  const { insertedId } = await db.collection('waypoints').insertOne({
    name: 'Coral ledge',
    type: 'fishing_ground',
    coordinates: { lat: -5.99924, lng: 39.18637 },
    userId: owner,
    isPrivate: true,
    createdAt: new Date(),
  });
  waypointId = insertedId;
});

/** Sign in as this fisher: what the browser would carry. */
const as = async (id) => ({ authorization: `Bearer ${await issueToken({ id, role: 'user' })}` });

const update = async (callerId, { body = {}, query = {}, headers } = {}) =>
  callHandler(waypointById, {
    method: 'PUT',
    query: { id: waypointId.toHexString(), ...query },
    body: { name: 'Renamed', ...body },
    headers: headers ?? (await as(callerId)),
  });

const remove = async (callerId, { query = {}, headers } = {}) =>
  callHandler(waypointById, {
    method: 'DELETE',
    query: { id: waypointId.toHexString(), ...query },
    headers: headers ?? (await as(callerId)),
  });

const stored = () => db.collection('waypoints').findOne({ _id: waypointId });

describe('the fisher who saved it', () => {
  it('can rename it', async () => {
    const result = await update(owner.toHexString());

    expect(result.status).toBe(200);
    expect((await stored()).name).toBe('Renamed');
  });

  it('can delete it', async () => {
    const result = await remove(owner.toHexString());

    expect(result.status).toBe(200);
    expect(await stored()).toBeNull();
  });
});

describe('any other fisher', () => {
  it('cannot rename it, and it is left untouched', async () => {
    const result = await update(stranger.toHexString());

    expect(result.status).not.toBe(200);
    expect((await stored()).name).toBe('Coral ledge');
  });

  it('cannot delete it, and it survives', async () => {
    const result = await remove(stranger.toHexString());

    expect(result.status).not.toBe(200);
    expect(await stored()).not.toBeNull();
  });

  it('cannot see it in their own listing', async () => {
    const listed = await callHandler(waypointsHandler, {
      method: 'GET',
      headers: await as(stranger.toHexString()),
    });

    expect(listed.body).toEqual([]);
  });
});

describe('a stranger who names the owner', () => {
  // The whole of step 4 in four tests. Before it, every one of these passed
  // for the attacker: the id came from the request, so claiming to be the
  // owner made you the owner.
  it('cannot rename it by putting the owner id in the body', async () => {
    const result = await update(stranger.toHexString(), {
      body: { userId: owner.toHexString() },
    });

    expect(result.status).not.toBe(200);
    expect((await stored()).name).toBe('Coral ledge');
  });

  it('cannot delete it by putting the owner id in the query', async () => {
    const result = await remove(stranger.toHexString(), {
      query: { userId: owner.toHexString() },
    });

    expect(result.status).not.toBe(200);
    expect(await stored()).not.toBeNull();
  });

  it('cannot list it by asking for the owner id', async () => {
    const listed = await callHandler(waypointsHandler, {
      method: 'GET',
      query: { userId: owner.toHexString() },
      headers: await as(stranger.toHexString()),
    });

    expect(listed.body).toEqual([]);
  });

  it('gets their own empty listing, not the owner\'s', async () => {
    const listed = await callHandler(waypointsHandler, {
      method: 'GET',
      query: { userId: owner.toHexString() },
      headers: await as(stranger.toHexString()),
    });

    expect(listed.status).toBe(200);
    expect(listed.body).toEqual([]);
  });
});

describe('a caller who proves nothing', () => {
  it('is refused the listing', async () => {
    const result = await callHandler(waypointsHandler, { method: 'GET' });

    expect(result.status).toBe(401);
  });

  it('is refused the listing even while naming a real fisher', async () => {
    const result = await callHandler(waypointsHandler, {
      method: 'GET',
      query: { userId: owner.toHexString() },
    });

    expect(result.status).toBe(401);
  });

  it('cannot delete, and the waypoint survives', async () => {
    const result = await remove(null, { headers: {} });

    expect(result.status).toBe(401);
    expect(await stored()).not.toBeNull();
  });

  it('is refused when the token does not verify', async () => {
    const result = await remove(null, { headers: { authorization: 'Bearer forged.token.here' } });

    expect(result.status).toBe(401);
    expect(await stored()).not.toBeNull();
  });
});

describe('a waypoint whose owner was stored as a string', () => {
  // Both storage forms are live in the collection; see docs/adr/0001. The
  // owner must still be able to manage their own waypoint, and a stranger
  // must still be refused.
  beforeEach(async () => {
    await db.collection('waypoints').updateOne(
      { _id: waypointId },
      { $set: { userId: owner.toHexString() } }
    );
  });

  it('is still deletable by its owner', async () => {
    const result = await remove(owner.toHexString());

    expect(result.status).toBe(200);
    expect(await stored()).toBeNull();
  });

  it('is still protected from everyone else', async () => {
    const result = await remove(stranger.toHexString());

    expect(result.status).not.toBe(200);
    expect(await stored()).not.toBeNull();
  });
});

describe('a waypoint that is not there', () => {
  it('reports a missing waypoint rather than succeeding', async () => {
    const result = await callHandler(waypointById, {
      method: 'DELETE',
      query: { id: new ObjectId().toHexString(), userId: owner.toHexString() },
    });

    expect(result.status).not.toBe(200);
  });
});
