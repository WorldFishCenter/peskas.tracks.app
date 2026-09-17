import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { startTestDatabase, stopTestDatabase, callHandler, signedInAs } from './_utils/testHarness.js';

/**
 * Does a saved waypoint reach the database, does the fisher who saved it get
 * it back, and can nobody else see it?
 *
 * Waypoints are private by design, so the last question is the one worth
 * automating: a leak between fishers is not visible from the saving fisher's
 * own screen.
 */

let db;
let waypointsHandler;

beforeAll(async () => {
  db = await startTestDatabase();
  waypointsHandler = (await import('./waypoints.js')).default;
});

afterAll(stopTestDatabase);

beforeEach(async () => {
  await db.collection('waypoints').deleteMany({});
  await db.collection('users').deleteMany({});
});

const aWaypoint = (overrides = {}) => ({
  name: 'Coral ledge',
  type: 'fishing_ground',
  coordinates: { lat: -5.99924, lng: 39.18637 },
  ...overrides,
});

// Whose waypoint it is comes from who is signed in, never from the request.
const save = async (callerId, body = {}) =>
  callHandler(waypointsHandler, {
    method: 'POST',
    body: aWaypoint(body),
    headers: await signedInAs(callerId),
  });

const listFor = async (callerId) =>
  callHandler(waypointsHandler, { method: 'GET', headers: await signedInAs(callerId) });

describe('saving a waypoint', () => {
  it('writes it to the database', async () => {
    const saved = await save(new ObjectId());

    expect(saved.status).toBe(201);

    const stored = await db.collection('waypoints').find({}).toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      name: 'Coral ledge',
      type: 'fishing_ground',
      isPrivate: true,
    });
  });

  it('gives it back to the fisher who saved it', async () => {
    const fisher = new ObjectId();
    await save(fisher);

    const listed = await listFor(fisher);

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].name).toBe('Coral ledge');
  });

  // The property that matters: waypoints are private, and a fisher seeing
  // someone else's would not show up on the saving fisher's own screen.
  it('does not give it to any other fisher', async () => {
    await save(new ObjectId());

    const listed = await listFor(new ObjectId());

    expect(listed.body).toEqual([]);
  });

  it('finds it whether the stored userId is an ObjectId or a string', async () => {
    const id = new ObjectId();

    // Both storage forms exist in the collection; see docs/adr/0001.
    await db.collection('waypoints').insertMany([
      { name: 'stored as ObjectId', userId: id, isPrivate: true },
      { name: 'stored as string', userId: id.toHexString(), isPrivate: true },
    ]);

    const listed = await listFor(id);

    expect(listed.body.map((w) => w.name).sort()).toEqual([
      'stored as ObjectId',
      'stored as string',
    ]);
  });

  it('finds a waypoint by IMEI when the fisher has a tracking device', async () => {
    const id = new ObjectId();
    await db.collection('users').insertOne({ _id: id, IMEI: '861508035295419' });
    await save(id, { imei: '861508035295419' });

    // No identifier is supplied: the server resolves the signed-in fisher to
    // their IMEI itself, which is how records are keyed for device-tracked
    // fishers.
    const listed = await listFor(id);

    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].name).toBe('Coral ledge');
  });
});

describe('rejecting a bad waypoint', () => {
  it('refuses one with no name', async () => {
    const saved = await save(new ObjectId(), { name: undefined });

    expect(saved.status).toBe(400);
    expect(await db.collection('waypoints').countDocuments()).toBe(0);
  });

  it('refuses one with no coordinates', async () => {
    const saved = await save(new ObjectId(), { coordinates: undefined });

    expect(saved.status).toBe(400);
    expect(await db.collection('waypoints').countDocuments()).toBe(0);
  });

  it('refuses coordinates outside the world', async () => {
    const saved = await save(new ObjectId(), { coordinates: { lat: 999, lng: 999 } });

    expect(saved.status).toBe(400);
    expect(await db.collection('waypoints').countDocuments()).toBe(0);
  });

  it('refuses a type outside the recorded vocabulary', async () => {
    const saved = await save(new ObjectId(), { type: 'submarine base' });

    expect(saved.status).toBe(400);
    expect(await db.collection('waypoints').countDocuments()).toBe(0);
  });

  // There is no identifier left to omit: the listing takes its subject from
  // the token. What used to be a 400 for a missing userId is now a 401 for a
  // caller who has not said who they are.
  it('refuses a listing request from nobody', async () => {
    const listed = await callHandler(waypointsHandler, { method: 'GET' });

    expect(listed.status).toBe(401);
  });
});
