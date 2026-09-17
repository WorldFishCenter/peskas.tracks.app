import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDatabase, stopTestDatabase, callHandler } from './_utils/testHarness.js';

/**
 * How efficiently a fisher fished: catch per hour at sea, catch per litre of
 * fuel, and how much of the trip was spent searching rather than fishing.
 *
 * The records arrive one metric per row, so a trip is reassembled from several
 * documents. Getting that wrong produces averages that are merely wrong rather
 * than obviously broken.
 */

let db;
let fisherPerformance;

const MINE = '861508035295419';
const NEIGHBOUR = '862044068727895';

beforeAll(async () => {
  db = await startTestDatabase();
  fisherPerformance = (await import('./fisher-performance/[imei].js')).default;
});

afterAll(stopTestDatabase);

const day = (n) => new Date(`2026-09-${String(n).padStart(2, '0')}T12:00:00Z`);

/** One trip arrives as one row per metric. */
const tripRows = (imei, tripId, started, tripType, metrics) =>
  Object.entries(metrics).map(([metric, value]) => ({
    imei,
    tripId,
    started,
    trip_type: tripType,
    metric,
    value,
  }));

beforeEach(async () => {
  await db.collection('fishers-performance').deleteMany({});
  await db.collection('fishers-stats').deleteMany({});
  await db.collection('users').deleteMany({});

  await db.collection('users').insertMany([
    { IMEI: MINE, Community: 'Fuji' },
    { IMEI: NEIGHBOUR, Community: 'Fuji' },
  ]);

  await db.collection('fishers-performance').insertMany([
    ...tripRows(MINE, 'trip-1', day(1), 'day', {
      cpue_kg_per_hour: 4,
      kg_per_liter: 2,
      search_ratio: 0.4,
    }),
    ...tripRows(MINE, 'trip-2', day(2), 'night', {
      cpue_kg_per_hour: 8,
      kg_per_liter: 4,
      search_ratio: 0.2,
    }),
    ...tripRows(NEIGHBOUR, 'trip-9', day(1), 'day', {
      cpue_kg_per_hour: 10,
      kg_per_liter: 5,
      search_ratio: 0.5,
    }),
  ]);
});

const performanceFor = (imei, query = {}) =>
  callHandler(fisherPerformance, {
    method: 'GET',
    query: { imei, dateFrom: day(1).toISOString(), dateTo: day(28).toISOString(), ...query },
  });

describe('a fisher own efficiency', () => {
  it('averages each metric across their trips', async () => {
    const result = await performanceFor(MINE);

    expect(result.status).toBe(200);
    expect(result.body.metrics.cpue_kg_per_hour.yourAvg).toBe(6);
    expect(result.body.metrics.kg_per_liter.yourAvg).toBe(3);
    expect(result.body.metrics.search_ratio.yourAvg).toBeCloseTo(0.3, 5);
  });

  it('does not mix in another fisher trips', async () => {
    const result = await performanceFor(MINE);

    // The neighbour's 10 kg/hour would pull the average to 7.3.
    expect(result.body.metrics.cpue_kg_per_hour.yourAvg).toBe(6);
  });

  it('ranks the best trips by catch per hour', async () => {
    const result = await performanceFor(MINE);

    expect(result.body.bestTrips[0]).toMatchObject({
      tripId: 'trip-2',
      cpue: 8,
      tripType: 'night',
    });
    expect(result.body.bestTrips.map((t) => t.tripId)).toEqual(['trip-2', 'trip-1']);
  });

  it('reports zeroes, not errors, for a fisher with no trips', async () => {
    const result = await performanceFor('000000000000000');

    expect(result.status).toBe(200);
    expect(result.body.metrics.cpue_kg_per_hour.yourAvg).toBe(0);
    expect(result.body.metrics.kg_per_liter.yourAvg).toBe(0);
    expect(result.body.metrics.search_ratio.yourAvg).toBe(0);
    expect(result.body.bestTrips).toEqual([]);
  });

  it('leaves out trips outside the requested window', async () => {
    const result = await performanceFor(MINE, {
      dateFrom: day(2).toISOString(),
      dateTo: day(28).toISOString(),
    });

    // Only trip-2 remains.
    expect(result.body.metrics.cpue_kg_per_hour.yourAvg).toBe(8);
  });
});

describe('comparing against the community', () => {
  it('averages the community without counting the fisher themselves', async () => {
    const result = await performanceFor(MINE, { compareWith: 'community' });

    expect(result.body.metrics.cpue_kg_per_hour.comparisonAvg).toBe(10);
    expect(result.body.comparison.type).toBe('community');
  });
});

describe('refusing a bad request', () => {
  it('requires an IMEI', async () => {
    const result = await callHandler(fisherPerformance, { method: 'GET', query: {} });

    expect(result.status).toBe(400);
  });

  it('refuses anything but GET', async () => {
    const result = await callHandler(fisherPerformance, {
      method: 'POST',
      query: { imei: MINE },
    });

    expect(result.status).toBe(405);
  });
});
