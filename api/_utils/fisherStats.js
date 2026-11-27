import { ValidationError } from './errorHandler.js';
import { findFisherCommunity } from './fisherIdentity.js';

/**
 * Aggregating fisher stats and efficiency figures.
 *
 * Both the fisher-stats and fisher-performance endpoints share the same date
 * window parsing, fisher-community cohort resolution (supporting both IMEI and
 * self-registered username), comparison framing, and aggregation rules.
 * Keeping the full pipeline here makes both HTTP handlers thin adapters.
 */

const PERFORMANCE_METRICS = ['cpue_kg_per_hour', 'kg_per_liter', 'search_ratio'];

const round1 = (value) => Math.round(value * 10) / 10;

/**
 * Parse and validate an ISO date window, defaulting to the last 30 days, and
 * compute the immediately preceding period of equal length.
 *
 * @param {string|undefined} dateFrom
 * @param {string|undefined} dateTo
 * @returns {{ fromDate: Date, toDate: Date, previousFromDate: Date, previousToDate: Date }}
 */
export function parseDateWindow(dateFrom, dateTo) {
  const fromDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = dateTo ? new Date(dateTo) : new Date();

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new ValidationError('Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)');
  }

  const durationMs = toDate.getTime() - fromDate.getTime();
  const previousFromDate = new Date(fromDate.getTime() - durationMs);
  const previousToDate = new Date(fromDate.getTime());

  return { fromDate, toDate, previousFromDate, previousToDate };
}

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
    totalKg: round1(totalKg),
    count,
  }));
}

/**
 * Average each efficiency figure across a set of performance rows.
 *
 * @param {Array<{metric: string, value: number}>} rows
 * @returns {{ cpue_kg_per_hour: number, kg_per_liter: number, search_ratio: number, hasData: boolean }}
 */
export function summarisePerformanceMetrics(rows) {
  const buckets = {
    cpue_kg_per_hour: [],
    kg_per_liter: [],
    search_ratio: [],
  };

  for (const row of rows) {
    if (buckets[row.metric] !== undefined) {
      buckets[row.metric].push(row.value);
    }
  }

  const avg = (values) => (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0);

  const summary = {
    cpue_kg_per_hour: avg(buckets.cpue_kg_per_hour),
    kg_per_liter: avg(buckets.kg_per_liter),
    search_ratio: avg(buckets.search_ratio),
  };

  return {
    ...summary,
    hasData: PERFORMANCE_METRICS.some((key) => summary[key] > 0),
  };
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

/**
 * Build the MongoDB filter and human label for a comparison cohort
 * ('community', 'all', or 'previous') against a collection keyed by dateField.
 */
async function resolveComparisonCohort({
  usersCollection,
  identifier,
  compareWith,
  dateField,
  window,
}) {
  const { fromDate, toDate, previousFromDate, previousToDate } = window;

  if (compareWith === 'community') {
    const community = await findFisherCommunity(identifier, usersCollection);
    if (!community) {
      return { query: null, label: '', alwaysShowLabel: false };
    }

    const peerImeis = (await communityImeis(usersCollection, community)).filter(
      (candidate) => candidate !== identifier
    );
    if (peerImeis.length === 0) {
      return { query: null, label: '', alwaysShowLabel: false };
    }

    return {
      query: {
        imei: { $in: peerImeis },
        [dateField]: { $gte: fromDate, $lte: toDate },
      },
      label: `${peerImeis.length} fishers in ${community}`,
      alwaysShowLabel: false,
    };
  }

  if (compareWith === 'all') {
    return {
      query: {
        imei: { $ne: identifier },
        [dateField]: { $gte: fromDate, $lte: toDate },
      },
      label: 'all fishers',
      alwaysShowLabel: false,
    };
  }

  if (compareWith === 'previous') {
    const isoRange = `${previousFromDate.toISOString().split('T')[0]} - ${previousToDate.toISOString().split('T')[0]}`;
    return {
      query: {
        imei: identifier,
        [dateField]: { $gte: previousFromDate, $lt: previousToDate },
      },
      label: isoRange,
      alwaysShowLabel: true,
    };
  }

  return { query: null, label: '', alwaysShowLabel: false };
}

/**
 * Compute catch stats and comparison cohort figures for a fisher.
 */
export async function getFisherStats(db, { identifier, dateFrom, dateTo, compareWith = 'community' }) {
  if (!identifier) {
    throw new ValidationError('IMEI is required');
  }

  const window = parseDateWindow(dateFrom, dateTo);
  const statsCollection = db.collection('fishers-stats');
  const usersCollection = db.collection('users');

  const fisherRows = await statsCollection
    .find({ imei: identifier, date: { $gte: window.fromDate, $lte: window.toDate } })
    .toArray();

  const {
    trips: totalTrips,
    successfulTrips,
    totalCatch,
    successRate,
    avgCatchPerTrip,
  } = summariseCatchStats(fisherRows);

  const catchByType = catchByFishGroup(fisherRows);

  const recentTrips = [...fisherRows]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
    .map((stat) => ({
      tripId: stat.tripId,
      date: stat.date,
      catch_kg: stat.catch_kg || 0,
      fishGroup: stat.fishGroup,
    }));

  const timeSeries = [...fisherRows]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((stat) => ({
      date: new Date(stat.date).toISOString().split('T')[0],
      catch_kg: stat.catch_kg || 0,
    }));

  let comparisonData = {
    avgCatch: 0,
    avgSuccessRate: 0,
    basedOn: '',
    hasData: false,
  };

  const cohort = await resolveComparisonCohort({
    usersCollection,
    identifier,
    compareWith,
    dateField: 'date',
    window,
  });

  if (cohort.query) {
    const cohortRows = await statsCollection.find(cohort.query).toArray();
    if (cohortRows.length > 0) {
      const summary = summariseCatchStats(cohortRows);
      comparisonData = {
        avgCatch: summary.avgCatchPerTrip,
        avgSuccessRate: summary.successRate,
        basedOn: cohort.label,
        hasData: summary.trips > 0,
      };
    }
  }

  return {
    summary: {
      totalCatch: round1(totalCatch),
      totalTrips,
      successfulTrips,
      successRate,
      avgCatchPerTrip: round1(avgCatchPerTrip),
    },
    catchByType,
    recentTrips,
    timeSeries,
    comparison: {
      type: compareWith,
      ...comparisonData,
    },
  };
}

/**
 * Compute efficiency figures, trip-type breakdown, best trips, and comparison
 * cohort figures for a fisher.
 */
export async function getFisherPerformance(
  db,
  { identifier, dateFrom, dateTo, compareWith = 'community' }
) {
  if (!identifier) {
    throw new ValidationError('IMEI is required');
  }

  const window = parseDateWindow(dateFrom, dateTo);
  const performanceCollection = db.collection('fishers-performance');
  const statsCollection = db.collection('fishers-stats');
  const usersCollection = db.collection('users');

  const fisherRows = await performanceCollection
    .find({ imei: identifier, started: { $gte: window.fromDate, $lte: window.toDate } })
    .toArray();

  // Reassemble per-trip efficiency rows and trip types.
  const tripTypeBuckets = new Map();
  const tripsById = new Map();

  for (const row of fisherRows) {
    if (!tripsById.has(row.tripId)) {
      tripsById.set(row.tripId, {
        tripType: row.trip_type,
        started: row.started,
        metrics: {},
      });
      if (!tripTypeBuckets.has(row.trip_type)) {
        tripTypeBuckets.set(row.trip_type, { totalCatch: 0, trips: new Set() });
      }
      tripTypeBuckets.get(row.trip_type).trips.add(row.tripId);
    }
    tripsById.get(row.tripId).metrics[row.metric] = row.value;
  }

  const tripIds = Array.from(tripsById.keys());
  const catchRows =
    tripIds.length > 0
      ? await statsCollection.find({ imei: identifier, tripId: { $in: tripIds } }).toArray()
      : [];

  const catchByTrip = new Map();
  for (const stat of catchRows) {
    catchByTrip.set(stat.tripId, (catchByTrip.get(stat.tripId) || 0) + (stat.catch_kg || 0));
  }

  for (const [tripId, tripData] of tripsById.entries()) {
    tripTypeBuckets.get(tripData.tripType).totalCatch += catchByTrip.get(tripId) || 0;
  }

  const tripTypes = {};
  for (const [type, bucket] of tripTypeBuckets.entries()) {
    const count = bucket.trips.size;
    tripTypes[type] = {
      count,
      avgCatch: count > 0 ? round1(bucket.totalCatch / count) : 0,
    };
  }

  const fisherMetrics = summarisePerformanceMetrics(fisherRows);

  const bestTrips = Array.from(tripsById.entries())
    .filter(([, data]) => data.metrics.cpue_kg_per_hour !== undefined)
    .map(([tripId, data]) => ({
      tripId,
      date: data.started,
      tripType: data.tripType,
      cpue: round1(data.metrics.cpue_kg_per_hour),
    }))
    .sort((a, b) => b.cpue - a.cpue)
    .slice(0, 5);

  const cohort = await resolveComparisonCohort({
    usersCollection,
    identifier,
    compareWith,
    dateField: 'started',
    window,
  });

  const cohortRows = cohort.query ? await performanceCollection.find(cohort.query).toArray() : [];
  const comparisonMetrics = summarisePerformanceMetrics(cohortRows);
  const comparisonLabel =
    comparisonMetrics.hasData || cohort.alwaysShowLabel ? cohort.label : '';

  const percentDiff = (yours, theirs) =>
    theirs === 0 ? 0 : Math.round(((yours - theirs) / theirs) * 100);

  const metrics = Object.fromEntries(
    PERFORMANCE_METRICS.map((key) => [
      key,
      {
        yourAvg: round1(fisherMetrics[key]),
        comparisonAvg: round1(comparisonMetrics[key]),
        percentDiff: percentDiff(fisherMetrics[key], comparisonMetrics[key]),
      },
    ])
  );

  return {
    tripTypes,
    metrics,
    bestTrips,
    comparison: {
      type: compareWith,
      basedOn: comparisonLabel,
      hasData: comparisonMetrics.hasData,
    },
  };
}
