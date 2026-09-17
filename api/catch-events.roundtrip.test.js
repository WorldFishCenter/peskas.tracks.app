import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { startTestDatabase, stopTestDatabase, callHandler, signedInAs } from './_utils/testHarness.js';

/**
 * Does a reported catch actually reach the database, and does the fisher get
 * it back the next time they open the app?
 *
 * Drives the real endpoints end to end against a throwaway MongoDB, so the
 * answer does not depend on anyone remembering to check by hand — and no
 * production record is created to find out.
 */

let db;
let createCatchEvent;
let getCatchEventsForUser;

beforeAll(async () => {
  db = await startTestDatabase();

  // Imported after the database exists: these modules capture MONGODB_URI at
  // module load.
  createCatchEvent = (await import('./catch-events.js')).default;
  getCatchEventsForUser = (await import('./catch-events/user/[identifier].js')).default;
});

afterAll(stopTestDatabase);

// Who is doing the reporting. Since step 4 the report's author comes from the
// signed-in account rather than from the body, so the fisher has to exist.
const withDevice = new ObjectId();
const withoutDevice = new ObjectId();

beforeEach(async () => {
  await db.collection('catch-events').deleteMany({});
  await db.collection('users').deleteMany({});
  await db.collection('users').insertMany([
    { _id: withDevice, IMEI: '861508035295419', Boat: 'Mashaallah', Community: 'Fuji' },
    { _id: withoutDevice, username: 'kito', IMEI: null, Community: 'Shela' },
  ]);
});

const aCatch = (overrides = {}) => ({
  tripId: 'trip-1',
  date: new Date('2026-09-15').toISOString(),
  catch_outcome: 1,
  fishGroup: 'reef fish',
  quantity: 12,
  ...overrides,
});

const report = async (callerId, body = {}) =>
  callHandler(createCatchEvent, {
    method: 'POST',
    body: aCatch(body),
    headers: await signedInAs(callerId),
  });

const readFor = async (callerId, identifier) =>
  callHandler(getCatchEventsForUser, {
    method: 'GET',
    query: { identifier },
    headers: await signedInAs(callerId),
  });

describe('reporting a catch', () => {
  it('writes the report to the database', async () => {
    const posted = await report(withDevice);

    expect(posted.status).toBe(201);

    const stored = await db.collection('catch-events').find({}).toArray();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      tripId: 'trip-1',
      imei: '861508035295419',
      fishGroup: 'reef fish',
      quantity: 12,
      catch_outcome: 1,
    });
  });

  it('gives it back to the fisher who reported it', async () => {
    await report(withDevice);

    const fetched = await readFor(withDevice, '861508035295419');

    expect(fetched.status).toBe(200);
    expect(fetched.body).toHaveLength(1);
    expect(fetched.body[0]).toMatchObject({ tripId: 'trip-1', quantity: 12 });
  });

  // Naming somebody else is now refused outright rather than answered with an
  // empty list: the caller is not that fisher and is not an administrator.
  it('does not give it to a different fisher', async () => {
    await report(withDevice);

    const fetched = await readFor(withoutDevice, '861508035295419');

    expect(fetched.status).toBe(403);
  });

  // A fisher without a tracking device reports under their username, and the
  // records must come back for them too.
  it('gives a fisher without an IMEI their own reports back', async () => {
    await report(withoutDevice);

    const fetched = await readFor(withoutDevice, 'kito');

    expect(fetched.status).toBe(200);
    expect(fetched.body).toHaveLength(1);
    expect(fetched.body[0]).toMatchObject({ username: 'kito', quantity: 12 });
  });

  it('records a trip that landed nothing', async () => {
    const posted = await report(withDevice, { catch_outcome: 0, fishGroup: undefined, quantity: undefined });

    expect(posted.status).toBe(201);

    const [stored] = await db.collection('catch-events').find({}).toArray();
    expect(stored.catch_outcome).toBe(0);
  });
});

describe('rejecting a bad report', () => {
  // The body no longer names an author, so there is no missing identifier to
  // refuse. What it refuses now is a caller who has not signed in.
  it('refuses a report from nobody', async () => {
    const posted = await callHandler(createCatchEvent, { method: 'POST', body: aCatch() });

    expect(posted.status).toBe(401);
    expect(await db.collection('catch-events').countDocuments()).toBe(0);
  });

  it('refuses a catch with no fish group', async () => {
    const posted = await report(withDevice, { fishGroup: undefined });

    expect(posted.status).toBe(400);
    expect(await db.collection('catch-events').countDocuments()).toBe(0);
  });

  it('refuses a fish group outside the recorded vocabulary', async () => {
    const posted = await report(withDevice, { fishGroup: 'dragons' });

    expect(posted.status).toBe(400);
    expect(await db.collection('catch-events').countDocuments()).toBe(0);
  });

  it('refuses a negative quantity', async () => {
    const posted = await report(withDevice, { quantity: -5 });

    expect(posted.status).toBe(400);
    expect(await db.collection('catch-events').countDocuments()).toBe(0);
  });
});
