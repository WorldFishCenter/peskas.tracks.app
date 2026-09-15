/**
 * Aggregating fisher stats.
 *
 * The fisher-stats and fisher-performance endpoints each summarise the same
 * rows four times over — once for the fisher, then again for their community,
 * for all fishers, and for the preceding period — and both build the same
 * community roster. Written out at each site, the four copies drifted apart in
 * how they guarded against an empty period.
 */

/**
 * Summarise a set of stat rows into the figures every comparison is expressed
 * in. Returns zeroes rather than NaN for an empty set: a fisher who did not go
 * to sea during the period is a normal case, not an error.
 *
 * @param {Array<{catch_kg?: number}>} rows
 * @returns {{trips: number, successfulTrips: number, totalCatch: number,
 *            avgCatchPerTrip: number, successRate: number}}
 */
export function summariseCatchStats(rows) {
  const trips = rows.length;
  const successfulTrips = rows.filter((row) => row.catch_kg > 0).length;
  const totalCatch = rows.reduce((sum, row) => sum + (row.catch_kg || 0), 0);

  return {
    trips,
    successfulTrips,
    totalCatch,
    avgCatchPerTrip: trips > 0 ? totalCatch / trips : 0,
    successRate: trips > 0 ? successfulTrips / trips : 0,
  };
}

/**
 * Total landed weight per fish group, skipping rows that landed nothing or
 * recorded no group. Weights are rounded to one decimal, the precision the
 * figures are reported at.
 *
 * @param {Array<{catch_kg?: number, fishGroup?: string}>} rows
 * @returns {Array<{fishGroup: string, totalKg: number, count: number}>}
 */
export function catchByFishGroup(rows) {
  const totals = {};

  for (const row of rows) {
    if (!(row.catch_kg > 0) || !row.fishGroup) continue;

    totals[row.fishGroup] ??= { totalKg: 0, count: 0 };
    totals[row.fishGroup].totalKg += row.catch_kg;
    totals[row.fishGroup].count += 1;
  }

  return Object.entries(totals).map(([fishGroup, { totalKg, count }]) => ({
    fishGroup,
    totalKg: Math.round(totalKg * 10) / 10,
    count,
  }));
}

/**
 * The IMEIs of every fisher in a community.
 *
 * Fishers without a tracking device have no IMEI, so they cannot appear in
 * stats keyed on one and are filtered out rather than left as nulls, which
 * would otherwise match records whose imei field is absent.
 *
 * @param {import('mongodb').Collection} usersCollection
 * @param {string} community
 * @returns {Promise<string[]>}
 */
export async function communityImeis(usersCollection, community) {
  const users = await usersCollection.find({ Community: community }).toArray();

  return users.map((user) => user.IMEI).filter(Boolean);
}
