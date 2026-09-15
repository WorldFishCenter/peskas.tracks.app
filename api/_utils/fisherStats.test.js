import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { summariseCatchStats, catchByFishGroup, communityImeis } from './fisherStats.js';

describe('summariseCatchStats', () => {
  it('summarises a set of trips', () => {
    const summary = summariseCatchStats([
      { catch_kg: 10 },
      { catch_kg: 5 },
      { catch_kg: 0 },
      { catch_kg: 0 },
    ]);

    expect(summary).toEqual({
      trips: 4,
      successfulTrips: 2,
      totalCatch: 15,
      avgCatchPerTrip: 3.75,
      successRate: 0.5,
    });
  });

  // A fisher who did not go to sea during the period is normal, and the
  // reported figures must be zeroes rather than NaN.
  it('returns zeroes for a period with no trips', () => {
    expect(summariseCatchStats([])).toEqual({
      trips: 0,
      successfulTrips: 0,
      totalCatch: 0,
      avgCatchPerTrip: 0,
      successRate: 0,
    });
  });

  it('counts a trip that landed nothing as a trip', () => {
    const summary = summariseCatchStats([{ catch_kg: 0 }, { catch_kg: 0 }]);

    expect(summary.trips).toBe(2);
    expect(summary.successfulTrips).toBe(0);
    expect(summary.successRate).toBe(0);
  });

  it('treats a missing catch_kg as no catch', () => {
    const summary = summariseCatchStats([{ catch_kg: 4 }, {}]);

    expect(summary.totalCatch).toBe(4);
    expect(summary.successfulTrips).toBe(1);
  });
});

describe('catchByFishGroup', () => {
  it('totals landed weight per fish group', () => {
    const groups = catchByFishGroup([
      { catch_kg: 10, fishGroup: 'reef fish' },
      { catch_kg: 5.25, fishGroup: 'reef fish' },
      { catch_kg: 3, fishGroup: 'tuna/tuna-like' },
    ]);

    expect(groups).toEqual([
      { fishGroup: 'reef fish', totalKg: 15.3, count: 2 },
      { fishGroup: 'tuna/tuna-like', totalKg: 3, count: 1 },
    ]);
  });

  it('skips rows that landed nothing or recorded no group', () => {
    const groups = catchByFishGroup([
      { catch_kg: 0, fishGroup: 'reef fish' },
      { catch_kg: 7 },
      { catch_kg: 2, fishGroup: 'sharks/rays' },
    ]);

    expect(groups).toEqual([{ fishGroup: 'sharks/rays', totalKg: 2, count: 1 }]);
  });

  it('returns an empty list for no rows', () => {
    expect(catchByFishGroup([])).toEqual([]);
  });
});

describe('communityImeis', () => {
  let mongo;
  let client;
  let users;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    client = new MongoClient(mongo.getUri());
    await client.connect();
    users = client.db('test').collection('users');
  });

  afterAll(async () => {
    await client?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    await users.deleteMany({});
  });

  it('collects the IMEIs of one community', async () => {
    await users.insertMany([
      { Community: 'Fuji', IMEI: '111' },
      { Community: 'Fuji', IMEI: '222' },
      { Community: 'Nungwi', IMEI: '333' },
    ]);

    expect((await communityImeis(users, 'Fuji')).sort()).toEqual(['111', '222']);
  });

  // Self-registered fishers have IMEI null. Left in, they reach a
  // { imei: { $in: [...] } } query and match records with no imei at all.
  it('drops fishers who have no tracking device', async () => {
    await users.insertMany([
      { Community: 'Fuji', IMEI: '111' },
      { Community: 'Fuji', IMEI: null },
      { Community: 'Fuji', username: 'kito' },
    ]);

    expect(await communityImeis(users, 'Fuji')).toEqual(['111']);
  });

  it('returns nothing for an unknown community', async () => {
    expect(await communityImeis(users, 'Nowhere')).toEqual([]);
  });
});
