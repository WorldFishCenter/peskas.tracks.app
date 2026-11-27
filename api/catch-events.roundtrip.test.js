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

  it('keeps the fuel a trip used, with or without a catch', async () => {
    await callHandler(createCatchEvent, { method: 'POST', body: aCatch({ fuel_liters: 12.5 }) });
    await callHandler(createCatchEvent, {
      method: 'POST',
      body: aCatch({ tripId: 'trip-2', catch_outcome: 0, fishGroup: undefined, quantity: undefined, fuel_liters: 0 }),
    });
    await callHandler(createCatchEvent, { method: 'POST', body: aCatch({ tripId: 'trip-3' }) });

    const stored = await db.collection('catch-events').find({}).sort({ tripId: 1 }).toArray();
    expect(stored.map(e => e.fuel_liters)).toEqual([12.5, 0, undefined]);
  });
});

// The app re-sends a whole report when any part of it fails, so the entries
// that already went through arrive again.
describe('a report sent more than once', () => {
  it('stores each entry once', async () => {
    const first = await callHandler(createCatchEvent, { method: 'POST', body: aCatch({ reportId: 'r1', entryId: 'e1' }) });
    const again = await callHandler(createCatchEvent, { method: 'POST', body: aCatch({ reportId: 'r1', entryId: 'e1' }) });
    await callHandler(createCatchEvent, { method: 'POST', body: aCatch({ reportId: 'r1', entryId: 'e2', fishGroup: 'tuna/tuna-like' }) });

    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.body._id).toEqual(first.body._id);
    const stored = await db.collection('catch-events').find({}).sort({ entryId: 1 }).toArray();
    expect(stored.map(e => [e.reportId, e.entryId, e.fishGroup])).toEqual([
      ['r1', 'e1', 'reef fish'],
      ['r1', 'e2', 'tuna/tuna-like'],
    ]);
  });

  it('stores a no-catch report once', async () => {
    const noCatch = aCatch({ reportId: 'r2', catch_outcome: 0, fishGroup: undefined, quantity: undefined });
    await callHandler(createCatchEvent, { method: 'POST', body: noCatch });
    await callHandler(createCatchEvent, { method: 'POST', body: noCatch });

    expect(await db.collection('catch-events').countDocuments()).toBe(1);
  });

  it('stores one copy and answers every request when copies arrive together', async () => {
    await db.collection('catch-events').createIndex(
      { reportId: 1, entryId: 1 },
      { name: 'idx_report_entry_unique', unique: true, partialFilterExpression: { reportId: { $exists: true } } }
    );
    const bodies = [
      aCatch({ reportId: 'r3', entryId: 'e1' }),
      aCatch({ reportId: 'r4', catch_outcome: 0, fishGroup: undefined, quantity: undefined }),
    ];
    const posted = await Promise.all(bodies.flatMap(body =>
      Array.from({ length: 20 }, () => callHandler(createCatchEvent, { method: 'POST', body }))));

    expect(posted.map(p => p.status).filter(s => s !== 200 && s !== 201)).toEqual([]);
    expect(await db.collection('catch-events').countDocuments()).toBe(2);
  });

  it('still keeps every report from an app version without report ids', async () => {
    await callHandler(createCatchEvent, { method: 'POST', body: aCatch() });
    await callHandler(createCatchEvent, { method: 'POST', body: aCatch() });

    expect(await db.collection('catch-events').countDocuments()).toBe(2);
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

  it('refuses negative or non-numeric fuel', async () => {
    for (const fuel_liters of [-1, '20']) {
      const posted = await callHandler(createCatchEvent, { method: 'POST', body: aCatch({ fuel_liters }) });
      expect(posted.status).toBe(400);
    }
    expect(await db.collection('catch-events').countDocuments()).toBe(0);
  });

  it('refuses a report id that is not a string', async () => {
    const posted = await callHandler(createCatchEvent, {
      method: 'POST',
      body: aCatch({ reportId: { $ne: null }, entryId: 'e1' }),
    });

    expect(posted.status).toBe(400);
    expect(await db.collection('catch-events').countDocuments()).toBe(0);
  });
});
