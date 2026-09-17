import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';

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

beforeEach(async () => {
  await db.collection('catch-events').deleteMany({});
  await db.collection('users').deleteMany({});
});

const aCatch = (overrides = {}) => ({
  tripId: 'trip-1',
  date: new Date('2026-09-15').toISOString(),
  imei: '861508035295419',
  catch_outcome: 1,
  fishGroup: 'reef fish',
  quantity: 12,
  ...overrides,
});

describe('reporting a catch', () => {
  it('writes the report to the database', async () => {
    const posted = await callHandler(createCatchEvent, { method: 'POST', body: aCatch() });

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
    await callHandler(createCatchEvent, { method: 'POST', body: aCatch() });

    const fetched = await callHandler(getCatchEventsForUser, {
      method: 'GET',
      query: { identifier: '861508035295419' },
    });

    expect(fetched.status).toBe(200);
    expect(fetched.body).toHaveLength(1);
    expect(fetched.body[0]).toMatchObject({ tripId: 'trip-1', quantity: 12 });
  });

  it('does not give it to a different fisher', async () => {
    await callHandler(createCatchEvent, { method: 'POST', body: aCatch() });

    const fetched = await callHandler(getCatchEventsForUser, {
      method: 'GET',
      query: { identifier: '999999999999999' },
    });

    expect(fetched.body).toEqual([]);
  });

  // A fisher without a tracking device reports under their username, and the
  // records must come back for them too.
  it('gives a fisher without an IMEI their own reports back', async () => {
    await callHandler(createCatchEvent, {
      method: 'POST',
      body: aCatch({ imei: null, username: 'kito' }),
    });

    const fetched = await callHandler(getCatchEventsForUser, {
      method: 'GET',
      query: { identifier: 'kito' },
    });

    expect(fetched.status).toBe(200);
    expect(fetched.body).toHaveLength(1);
    expect(fetched.body[0]).toMatchObject({ username: 'kito', quantity: 12 });
  });

  it('records a trip that landed nothing', async () => {
    const posted = await callHandler(createCatchEvent, {
      method: 'POST',
      body: aCatch({ catch_outcome: 0, fishGroup: undefined, quantity: undefined }),
    });

    expect(posted.status).toBe(201);

    const [stored] = await db.collection('catch-events').find({}).toArray();
    expect(stored.catch_outcome).toBe(0);
  });
});

describe('rejecting a bad report', () => {
  it('refuses a report with no identifier', async () => {
    const posted = await callHandler(createCatchEvent, {
      method: 'POST',
      body: aCatch({ imei: null, username: null }),
    });

    expect(posted.status).toBe(400);
    expect(await db.collection('catch-events').countDocuments()).toBe(0);
  });

  it('refuses a catch with no fish group', async () => {
    const posted = await callHandler(createCatchEvent, {
      method: 'POST',
      body: aCatch({ fishGroup: undefined }),
    });

    expect(posted.status).toBe(400);
    expect(await db.collection('catch-events').countDocuments()).toBe(0);
  });

  it('refuses a fish group outside the recorded vocabulary', async () => {
    const posted = await callHandler(createCatchEvent, {
      method: 'POST',
      body: aCatch({ fishGroup: 'dragons' }),
    });

    expect(posted.status).toBe(400);
    expect(await db.collection('catch-events').countDocuments()).toBe(0);
  });

  it('refuses a negative quantity', async () => {
    const posted = await callHandler(createCatchEvent, {
      method: 'POST',
      body: aCatch({ quantity: -5 }),
    });

    expect(posted.status).toBe(400);
    expect(await db.collection('catch-events').countDocuments()).toBe(0);
  });
});
