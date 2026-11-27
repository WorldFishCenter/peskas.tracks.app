import { startOfDay, endOfDay } from 'date-fns';
import i18n from '../i18n';
import type {
  TripPoint,
  LiveLocation,
  Waypoint,
  FisherStatsResponse,
  FisherPerformanceResponse
} from '../types';
import { assetFetch } from './httpClient';

/**
 * The tracks demo mode shows, instead of a live vessel.
 *
 * Demo mode used to sign in as a real vessel and fetch whatever it had done
 * that week, so the demo went blank whenever that vessel stopped going to sea
 * — and the vessel's identity reached every visitor's browser along the way.
 * It now replays a frozen stretch of real history from
 * public/demo/snapshot.json, built by scripts/buildDemoSnapshot.js with every
 * identifier stripped.
 *
 * The snapshot stores times as offsets from its last fix. Replaying moves that
 * last fix forward by whole days to the most recent moment that is not in the
 * future, so the vessel always came home within the past day and every trip
 * keeps the time of day it really sailed at.
 */

/** [seconds before the anchor, lat, lng, speed in km/h, heading, metres from start] */
export type DemoFix = [number, number, number, number, number, number];

export interface DemoSnapshot {
  version: 1;
  /** The dates the tracks were taken from; kept for whoever rebuilds it. */
  window: { from: string; to: string };
  timezone: string;
  batteryState?: string;
  /** When the last fix of the last trip was really taken. */
  anchor: string;
  trips: DemoFix[][];
  waypoints: { kind: 'landingSite' | 'fishingGround'; lat: number; lng: number }[];
}

/** What the demo account's vessel is called wherever a name is shown. */
export const DEMO_VESSEL_NAME = 'Demo Vessel';
export const DEMO_COMMUNITY = 'Demo Community';
/** The demo account's stand-in IMEI, matching api/auth/demo-login.js. */
export const DEMO_IMEI = 'demo';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far to move the snapshot's times so its last fix lands in the past day.
 * Whole days, so a trip that left at 03:00 still leaves at 03:00.
 */
export const replayShiftMs = (snapshot: DemoSnapshot, now: Date): number => {
  const anchor = Date.parse(snapshot.anchor);
  return Math.floor((now.getTime() - anchor) / DAY_MS) * DAY_MS;
};

const replayTime = (snapshot: DemoSnapshot, offsetSeconds: number, now: Date): string =>
  new Date(Date.parse(snapshot.anchor) + replayShiftMs(snapshot, now) + offsetSeconds * 1000).toISOString();

/**
 * The trip points that fall within the requested days, as the Pelagic parser
 * would have produced them.
 */
export const replayTripPoints = (
  snapshot: DemoSnapshot,
  dateFrom: Date,
  dateTo: Date,
  now: Date = new Date()
): TripPoint[] => {
  const from = startOfDay(dateFrom).getTime();
  const to = endOfDay(dateTo).getTime();
  const points: TripPoint[] = [];

  snapshot.trips.forEach((fixes, index) => {
    const tripId = `demo-trip-${index + 1}`;
    const created = replayTime(snapshot, fixes[0][0], now);
    const updated = replayTime(snapshot, fixes[fixes.length - 1][0], now);

    for (const [offset, latitude, longitude, speed, heading, range] of fixes) {
      const time = replayTime(snapshot, offset, now);
      const ms = Date.parse(time);
      if (ms < from || ms > to) continue;

      points.push({
        time,
        timestamp: time,
        boat: DEMO_IMEI,
        tripId,
        latitude,
        longitude,
        speed,
        range,
        heading,
        boatName: DEMO_VESSEL_NAME,
        community: DEMO_COMMUNITY,
        tripCreated: created,
        tripUpdated: updated,
        imei: DEMO_IMEI,
        deviceId: DEMO_IMEI,
        lastSeen: updated
      });
    }
  });

  return points;
};

/** Where the demo vessel is now: moored where its last trip ended. */
export const replayLiveLocation = (snapshot: DemoSnapshot, now: Date = new Date()): LiveLocation => {
  const lastTrip = snapshot.trips[snapshot.trips.length - 1];
  const [offset, lat, lng] = lastTrip[lastTrip.length - 1];
  const lastFix = new Date(replayTime(snapshot, offset, now));

  return {
    deviceIndex: '1',
    boatName: DEMO_VESSEL_NAME,
    directCustomerName: DEMO_COMMUNITY,
    timezone: snapshot.timezone,
    lastSeen: lastFix,
    imei: DEMO_IMEI,
    lat,
    lng,
    lastGpsTs: lastFix,
    batteryState: snapshot.batteryState
  };
};

const WAYPOINT_TYPES = {
  landingSite: 'port',
  fishingGround: 'fishing_ground'
} as const;

/**
 * The places a fisher on this vessel would have saved. `nameFor` supplies the
 * name in the reader's language.
 */
export const replayWaypoints = (
  snapshot: DemoSnapshot,
  userId: string,
  nameFor: (kind: DemoSnapshot['waypoints'][number]['kind']) => string,
  now: Date = new Date()
): Waypoint[] => {
  const savedAt = replayTime(snapshot, snapshot.trips[0][0][0], now);

  return snapshot.waypoints.map(({ kind, lat, lng }) => ({
    _id: `demo-waypoint-${kind}`,
    userId,
    imei: DEMO_IMEI,
    name: nameFor(kind),
    coordinates: { lat, lng },
    type: WAYPOINT_TYPES[kind],
    isPrivate: true,
    createdAt: savedAt,
    updatedAt: savedAt,
    visible: true
  }));
};

let snapshotRequest: Promise<DemoSnapshot> | null = null;

/** Fetched once per page load, and only by someone who opened the demo. */
const loadSnapshot = (): Promise<DemoSnapshot> => {
  if (!snapshotRequest) {
    snapshotRequest = assetFetch('/demo/snapshot.json', { timeoutMs: 15000 })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Demo tracks unavailable: ${response.status} ${response.statusText}`);
        }
        return response.json() as Promise<DemoSnapshot>;
      })
      .catch(error => {
        // Let the next attempt try again rather than caching the failure.
        snapshotRequest = null;
        throw error;
      });
  }
  return snapshotRequest;
};

export const fetchDemoTripPoints = async (dateFrom: Date, dateTo: Date): Promise<TripPoint[]> =>
  replayTripPoints(await loadSnapshot(), dateFrom, dateTo);

export const fetchDemoLiveLocations = async (): Promise<LiveLocation[]> =>
  [replayLiveLocation(await loadSnapshot())];

export const fetchDemoWaypoints = async (userId: string): Promise<Waypoint[]> =>
  replayWaypoints(await loadSnapshot(), userId, kind => i18n.t(`waypoints.demo.${kind}`));

const DEMO_FISH_GROUPS = [
  'tuna/tuna-like',
  'large pelagics',
  'reef fish',
  'small pelagics'
] as const;

const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;

interface DemoDerivedTrip {
  tripId: string;
  date: string;
  endMs: number;
  durationHours: number;
  maxRangeMeters: number;
  tripType: 'offshore' | 'mid-range' | 'nearshore';
  catchKg: number;
  fishGroup?: string;
  cpue: number;
  kgPerLiter: number;
  searchRatio: number;
}

/**
 * Derive deterministic catch and efficiency records from the frozen snapshot's
 * trips so Map, Catches, and Efficiency agree without Math.random().
 */
const deriveDemoTrips = (
  snapshot: DemoSnapshot,
  dateFrom: Date,
  dateTo: Date,
  now: Date
): DemoDerivedTrip[] => {
  const from = startOfDay(dateFrom).getTime();
  const to = endOfDay(dateTo).getTime();
  const derived: DemoDerivedTrip[] = [];

  snapshot.trips.forEach((fixes, index) => {
    if (fixes.length === 0) return;

    const startTime = replayTime(snapshot, fixes[0][0], now);
    const endTime = replayTime(snapshot, fixes[fixes.length - 1][0], now);
    const endMs = Date.parse(endTime);
    if (endMs < from || endMs > to) return;

    const durationHours = Math.max(1, (endMs - Date.parse(startTime)) / 3_600_000);
    const maxRangeMeters = Math.max(...fixes.map(fix => fix[5] || 0));
    const tripType: DemoDerivedTrip['tripType'] =
      maxRangeMeters >= 8000 ? 'offshore' : maxRangeMeters >= 3000 ? 'mid-range' : 'nearshore';

    // Keep roughly 75% successful trips deterministically by index.
    const hasCatch = index % 4 !== 1;
    const baseCatch = 12 + (maxRangeMeters / 1000) * 1.4 + durationHours * 1.6;
    const catchKg = hasCatch ? round1(Math.min(48, Math.max(8, baseCatch))) : 0;
    const fishGroup = hasCatch ? DEMO_FISH_GROUPS[index % DEMO_FISH_GROUPS.length] : undefined;

    const fuelLiters = Math.max(4, (maxRangeMeters / 1000) * 0.9 + durationHours * 1.2);
    const cpue = hasCatch ? round1(catchKg / durationHours) : 0;
    const kgPerLiter = hasCatch ? round1(catchKg / fuelLiters) : 0;
    const searchRatio = round2(Math.min(0.6, Math.max(0.18, 0.25 + (index % 4) * 0.05)));

    derived.push({
      tripId: `demo-trip-${index + 1}`,
      date: endTime,
      endMs,
      durationHours,
      maxRangeMeters,
      tripType,
      catchKg,
      fishGroup,
      cpue,
      kgPerLiter,
      searchRatio
    });
  });

  return derived.sort((a, b) => a.endMs - b.endMs);
};

/**
 * Deterministic fisher catch stats derived from the frozen snapshot.
 */
export const replayFisherStats = (
  snapshot: DemoSnapshot,
  dateFrom?: Date,
  dateTo?: Date,
  compareWith: 'community' | 'previous' = 'community',
  now: Date = new Date()
): FisherStatsResponse => {
  const endDate = dateTo ?? now;
  const startDate = dateFrom ?? new Date(endDate.getTime() - 30 * DAY_MS);
  const trips = deriveDemoTrips(snapshot, startDate, endDate, now);

  const totalTrips = trips.length;
  const successfulTrips = trips.filter(trip => trip.catchKg > 0).length;
  const totalCatch = round1(trips.reduce((sum, trip) => sum + trip.catchKg, 0));
  const avgCatchPerTrip = totalTrips > 0 ? round1(totalCatch / totalTrips) : 0;
  const successRate = totalTrips > 0 ? successfulTrips / totalTrips : 0;

  const groupTotals = new Map<string, { totalKg: number; count: number }>();
  for (const trip of trips) {
    if (!trip.fishGroup || trip.catchKg <= 0) continue;
    const existing = groupTotals.get(trip.fishGroup) ?? { totalKg: 0, count: 0 };
    existing.totalKg += trip.catchKg;
    existing.count += 1;
    groupTotals.set(trip.fishGroup, existing);
  }

  const catchByType = Array.from(groupTotals.entries()).map(([fishGroup, data]) => ({
    fishGroup,
    totalKg: round1(data.totalKg),
    count: data.count
  }));

  const recentTrips = [...trips]
    .reverse()
    .slice(0, 5)
    .map(trip => ({
      tripId: trip.tripId,
      date: trip.date,
      catch_kg: trip.catchKg,
      fishGroup: trip.fishGroup
    }));

  const timeSeries = trips.map(trip => ({
    date: trip.date.split('T')[0],
    catch_kg: trip.catchKg
  }));

  const durationMs = endDate.getTime() - startDate.getTime();
  const prevStart = new Date(startDate.getTime() - durationMs);
  const prevLabel = `${prevStart.toISOString().split('T')[0]} - ${startDate.toISOString().split('T')[0]}`;

  const comparison =
    compareWith === 'community'
      ? {
          type: 'community' as const,
          avgCatch: round1(avgCatchPerTrip * 0.92),
          avgSuccessRate: round2(Math.min(1, successRate * 0.95)),
          basedOn: `12 fishers in ${DEMO_COMMUNITY}`,
          hasData: totalTrips > 0
        }
      : {
          type: 'previous' as const,
          avgCatch: round1(avgCatchPerTrip * 0.96),
          avgSuccessRate: round2(Math.min(1, successRate * 0.97)),
          basedOn: prevLabel,
          hasData: totalTrips > 0
        };

  return {
    summary: {
      totalCatch,
      totalTrips,
      successfulTrips,
      successRate,
      avgCatchPerTrip
    },
    catchByType,
    recentTrips,
    timeSeries,
    comparison
  };
};

/**
 * Deterministic fisher efficiency figures derived from the frozen snapshot.
 */
export const replayFisherPerformance = (
  snapshot: DemoSnapshot,
  dateFrom?: Date,
  dateTo?: Date,
  compareWith: 'community' | 'previous' = 'community',
  now: Date = new Date()
): FisherPerformanceResponse => {
  const endDate = dateTo ?? now;
  const startDate = dateFrom ?? new Date(endDate.getTime() - 30 * DAY_MS);
  const trips = deriveDemoTrips(snapshot, startDate, endDate, now);

  const buckets: Record<'offshore' | 'mid-range' | 'nearshore', { count: number; totalCatch: number }> = {
    offshore: { count: 0, totalCatch: 0 },
    'mid-range': { count: 0, totalCatch: 0 },
    nearshore: { count: 0, totalCatch: 0 }
  };

  for (const trip of trips) {
    buckets[trip.tripType].count += 1;
    buckets[trip.tripType].totalCatch += trip.catchKg;
  }

  const tripTypes = {
    offshore: {
      count: buckets.offshore.count,
      avgCatch: buckets.offshore.count > 0 ? round1(buckets.offshore.totalCatch / buckets.offshore.count) : 0
    },
    'mid-range': {
      count: buckets['mid-range'].count,
      avgCatch: buckets['mid-range'].count > 0 ? round1(buckets['mid-range'].totalCatch / buckets['mid-range'].count) : 0
    },
    nearshore: {
      count: buckets.nearshore.count,
      avgCatch: buckets.nearshore.count > 0 ? round1(buckets.nearshore.totalCatch / buckets.nearshore.count) : 0
    }
  };

  const avg = (values: number[]): number =>
    values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

  const successful = trips.filter(trip => trip.catchKg > 0);
  const yourCpue = round1(avg(successful.map(trip => trip.cpue)));
  const yourFuel = round1(avg(successful.map(trip => trip.kgPerLiter)));
  const yourSearch = round2(avg(trips.map(trip => trip.searchRatio)));

  const cpueFactor = compareWith === 'community' ? 0.88 : 0.94;
  const fuelFactor = compareWith === 'community' ? 0.91 : 0.95;
  const searchFactor = compareWith === 'community' ? 1.1 : 1.05;

  const compCpue = round1(yourCpue * cpueFactor);
  const compFuel = round1(yourFuel * fuelFactor);
  const compSearch = round2(yourSearch * searchFactor);

  const pct = (yours: number, theirs: number): number =>
    theirs === 0 ? 0 : Math.round(((yours - theirs) / theirs) * 100);

  const bestTrips = [...successful]
    .sort((a, b) => b.cpue - a.cpue)
    .slice(0, 5)
    .map(trip => ({
      tripId: trip.tripId,
      date: trip.date,
      tripType: trip.tripType,
      cpue: trip.cpue
    }));

  const durationMs = endDate.getTime() - startDate.getTime();
  const prevStart = new Date(startDate.getTime() - durationMs);
  const prevLabel = `${prevStart.toISOString().split('T')[0]} - ${startDate.toISOString().split('T')[0]}`;

  return {
    tripTypes,
    metrics: {
      cpue_kg_per_hour: {
        yourAvg: yourCpue,
        comparisonAvg: compCpue,
        percentDiff: pct(yourCpue, compCpue)
      },
      kg_per_liter: {
        yourAvg: yourFuel,
        comparisonAvg: compFuel,
        percentDiff: pct(yourFuel, compFuel)
      },
      search_ratio: {
        yourAvg: yourSearch,
        comparisonAvg: compSearch,
        percentDiff: pct(yourSearch, compSearch)
      }
    },
    bestTrips,
    comparison: {
      type: compareWith,
      basedOn: compareWith === 'community' ? `12 fishers in ${DEMO_COMMUNITY}` : prevLabel,
      hasData: trips.length > 0
    }
  };
};

export const fetchDemoFisherStats = async (
  dateFrom?: Date,
  dateTo?: Date,
  compareWith: 'community' | 'previous' = 'community'
): Promise<FisherStatsResponse> =>
  replayFisherStats(await loadSnapshot(), dateFrom, dateTo, compareWith);

export const fetchDemoFisherPerformance = async (
  dateFrom?: Date,
  dateTo?: Date,
  compareWith: 'community' | 'previous' = 'community'
): Promise<FisherPerformanceResponse> =>
  replayFisherPerformance(await loadSnapshot(), dateFrom, dateTo, compareWith);
