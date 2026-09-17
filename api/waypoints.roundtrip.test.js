import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';

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
  userId: new ObjectId().toHexString(),
  name: 'Coral ledge',
  type: 'fishing_ground',
  coordinates: { lat: -5.99924, lng: 39.18637 },
  ...overrides,
});

const save = (body) => callHandler(waypointsHandler, { method: 'POST', body });
const listFor = (query) => callHandler(waypointsHandler, { method: 'GET', query });

describe('saving a waypoint', () => {
  it('writes it to the database', async () => {
    const saved = await save(aWaypoint());

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
    const waypoint = aWaypoint();
    await save(waypoint);

    const listed = await listFor({ userId: waypoint.userId });

    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].name).toBe('Coral ledge');
  });

  // The property that matters: waypoints are private, and a fisher seeing
  // someone else's would not show up on the saving fisher's own screen.
  it('does not give it to any other fisher', async () => {
    await save(aWaypoint());

    const listed = await listFor({ userId: new ObjectId().toHexString() });

    expect(listed.body).toEqual([]);
  });

  it('finds it whether the stored userId is an ObjectId or a string', async () => {
    const id = new ObjectId();

    // Both storage forms exist in the collection; see docs/adr/0001.
    await db.collection('waypoints').insertMany([
      { name: 'stored as ObjectId', userId: id, isPrivate: true },
      { name: 'stored as string', userId: id.toHexString(), isPrivate: true },
    ]);

    const listed = await listFor({ userId: id.toHexString() });

    expect(listed.body.map((w) => w.name).sort()).toEqual([
      'stored as ObjectId',
      'stored as string',
    ]);
  });

  it('finds a waypoint by IMEI when the fisher has a tracking device', async () => {
    const id = new ObjectId();
    await db.collection('users').insertOne({ _id: id, IMEI: '861508035295419' });
    await save(aWaypoint({ userId: id.toHexString(), imei: '861508035295419' }));

    const listed = await listFor({ imei: '861508035295419' });

    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].name).toBe('Coral ledge');
  });
});

describe('rejecting a bad waypoint', () => {
  it('refuses one with no name', async () => {
    const saved = await save(aWaypoint({ name: undefined }));

    expect(saved.status).toBe(400);
    expect(await db.collection('waypoints').countDocuments()).toBe(0);
  });

  it('refuses one with no coordinates', async () => {
    const saved = await save(aWaypoint({ coordinates: undefined }));

    expect(saved.status).toBe(400);
    expect(await db.collection('waypoints').countDocuments()).toBe(0);
  });

  it('refuses coordinates outside the world', async () => {
    const saved = await save(aWaypoint({ coordinates: { lat: 999, lng: 999 } }));

    expect(saved.status).toBe(400);
    expect(await db.collection('waypoints').countDocuments()).toBe(0);
  });

  it('refuses a type outside the recorded vocabulary', async () => {
    const saved = await save(aWaypoint({ type: 'submarine base' }));

    expect(saved.status).toBe(400);
    expect(await db.collection('waypoints').countDocuments()).toBe(0);
  });

  it('refuses a listing request with no identifier at all', async () => {
    const listed = await listFor({});

    expect(listed.status).toBe(400);
  });
});
