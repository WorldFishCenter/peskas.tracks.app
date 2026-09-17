import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';

/**
 * Can one fisher edit or delete another fisher's waypoint?
 *
 * The endpoints scope every update and delete by the caller's userId, so the
 * answer is meant to be no. Nothing enforces that beyond the shape of the
 * query, and a refactor that drops the scoping would leave every screen
 * looking exactly the same — the owner would simply find a waypoint missing
 * one day. That is what these lock down.
 */

let db;
let waypointById;
let waypointsHandler;

const owner = new ObjectId();
const stranger = new ObjectId();

beforeAll(async () => {
  db = await startTestDatabase();
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

const update = (userId, body = {}) =>
  callHandler(waypointById, {
    method: 'PUT',
    query: { id: waypointId.toHexString() },
    body: { userId, name: 'Renamed', ...body },
  });

const remove = (userId) =>
  callHandler(waypointById, {
    method: 'DELETE',
    query: { id: waypointId.toHexString(), userId },
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
      query: { userId: stranger.toHexString() },
    });

    expect(listed.body).toEqual([]);
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
