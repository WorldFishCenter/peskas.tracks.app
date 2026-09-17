import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';

/**
 * The figures a fisher is shown about their own season, and the community
 * figures they are compared against.
 *
 * These are read-only, which is exactly why they are worth testing: a wrong
 * average looks like a plausible number, so nothing about the screen would
 * tell anyone it had drifted.
 */

let db;
let fisherStats;

const MINE = '861508035295419';
const NEIGHBOUR = '862044068727895';
const ELSEWHERE = '864352046459434';

beforeAll(async () => {
  db = await startTestDatabase();
  fisherStats = (await import('./fisher-stats/[imei].js')).default;
});

afterAll(stopTestDatabase);

const day = (n) => new Date(`2026-09-${String(n).padStart(2, '0')}T12:00:00Z`);

beforeEach(async () => {
  await db.collection('fishers-stats').deleteMany({});
  await db.collection('users').deleteMany({});

  await db.collection('users').insertMany([
    { IMEI: MINE, Community: 'Fuji' },
    { IMEI: NEIGHBOUR, Community: 'Fuji' },
    { IMEI: ELSEWHERE, Community: 'Shela' },
  ]);

  await db.collection('fishers-stats').insertMany([
    // Mine: four trips, three landed something, 30 kg in total.
    { imei: MINE, date: day(1), catch_kg: 10, fishGroup: 'reef fish' },
    { imei: MINE, date: day(2), catch_kg: 15, fishGroup: 'reef fish' },
    { imei: MINE, date: day(3), catch_kg: 5, fishGroup: 'tuna/tuna-like' },
    { imei: MINE, date: day(4), catch_kg: 0 },
    // A neighbour in the same community.
    { imei: NEIGHBOUR, date: day(1), catch_kg: 40, fishGroup: 'reef fish' },
    { imei: NEIGHBOUR, date: day(2), catch_kg: 0 },
    // A fisher in another community.
    { imei: ELSEWHERE, date: day(1), catch_kg: 100, fishGroup: 'reef fish' },
  ]);
});

const statsFor = (imei, query = {}) =>
  callHandler(fisherStats, {
    method: 'GET',
    query: { imei, dateFrom: day(1).toISOString(), dateTo: day(28).toISOString(), ...query },
  });

describe('a fisher own figures', () => {
  it('counts every trip, including the one that landed nothing', async () => {
    const result = await statsFor(MINE);

    expect(result.status).toBe(200);
    expect(result.body.summary).toMatchObject({
      totalTrips: 4,
      successfulTrips: 3,
      totalCatch: 30,
    });
  });

  it('averages over all trips, not only the successful ones', async () => {
    const result = await statsFor(MINE);

    expect(result.body.summary.avgCatchPerTrip).toBe(7.5);
    expect(result.body.summary.successRate).toBe(0.75);
  });

  it('breaks the catch down by fish group', async () => {
    const result = await statsFor(MINE);

    const byGroup = Object.fromEntries(
      result.body.catchByType.map((entry) => [entry.fishGroup, entry.totalKg])
    );
    expect(byGroup).toEqual({ 'reef fish': 25, 'tuna/tuna-like': 5 });
  });

  it('counts nobody else trips as theirs', async () => {
    const result = await statsFor(MINE);

    expect(result.body.summary.totalCatch).toBe(30);
    expect(result.body.summary.totalCatch).not.toBe(70);
  });

  it('reports zeroes, not errors, for a fisher with no trips', async () => {
    const result = await statsFor('000000000000000');

    expect(result.status).toBe(200);
    expect(result.body.summary).toMatchObject({
      totalTrips: 0,
      totalCatch: 0,
      avgCatchPerTrip: 0,
      successRate: 0,
    });
  });
});

describe('comparing against the community', () => {
  it('averages the community without counting the fisher themselves', async () => {
    const result = await statsFor(MINE, { compareWith: 'community' });

    // The neighbour alone: 40 kg over two trips, one of them empty.
    expect(result.body.comparison.avgCatch).toBe(20);
    expect(result.body.comparison.avgSuccessRate).toBe(0.5);
  });

  it('does not borrow figures from another community', async () => {
    const result = await statsFor(MINE, { compareWith: 'community' });

    // 100 kg from Shela must not reach a Fuji comparison.
    expect(result.body.comparison.avgCatch).not.toBe(70);
  });

  it('compares against every fisher when asked', async () => {
    const result = await statsFor(MINE, { compareWith: 'all' });

    // Everyone but the fisher: 40 + 0 + 100 over three trips.
    expect(result.body.comparison.avgCatch).toBeCloseTo(140 / 3, 5);
  });
});

describe('refusing a bad request', () => {
  it('requires an IMEI', async () => {
    const result = await callHandler(fisherStats, { method: 'GET', query: {} });

    expect(result.status).toBe(400);
  });

  it('rejects an unparseable date', async () => {
    const result = await statsFor(MINE, { dateFrom: 'last Tuesday' });

    expect(result.status).toBe(400);
  });

  it('refuses anything but GET', async () => {
    const result = await callHandler(fisherStats, { method: 'POST', query: { imei: MINE } });

    expect(result.status).toBe(405);
  });
});
