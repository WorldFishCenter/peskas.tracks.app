import { startOfDay, endOfDay } from 'date-fns';
import i18n from '../i18n';
import type { TripPoint, LiveLocation, Waypoint } from '../types';
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
