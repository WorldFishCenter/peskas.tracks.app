import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  replayShiftMs,
  replayTripPoints,
  replayLiveLocation,
  replayWaypoints,
  type DemoSnapshot
} from './demoTracksService';

/**
 * The demo replays frozen tracks as if they were recent. Two things have to
 * hold: whatever day someone opens it, there is something on the map; and
 * the snapshot it replays never names the vessel it came from.
 */

const HOUR = 60 * 60;

// Two trips: one that left eight days before the last fix, and one that left
// at 04:00 on the last day and came home at 10:00.
const snapshot: DemoSnapshot = {
  version: 1,
  window: { from: '2025-11-01', to: '2025-12-01' },
  timezone: 'Africa/Maputo',
  anchor: '2025-11-30T10:00:00.000Z',
  trips: [
    [
      [-8 * 24 * HOUR, -21.54, 35.21, 0, 0, 0],
      [-8 * 24 * HOUR + 6 * HOUR, -21.54, 35.21, 12.5, 90, 40]
    ],
    [
      [-6 * HOUR, -21.54, 35.21, 0, 0, 0],
      [-3 * HOUR, -20.9, 35.5, 9.4, 45, 80000],
      [0, -21.54, 35.22, 0.4, 180, 900]
    ]
  ],
  waypoints: [
    { kind: 'landingSite', lat: -21.54, lng: 35.22 },
    { kind: 'fishingGround', lat: -20.67, lng: 35.59 }
  ]
};

describe('replaying the snapshot', () => {
  it('brings the last fix to within the past day, never into the future', () => {
    for (const now of ['2026-09-17T08:00:00Z', '2026-09-17T10:00:00Z', '2026-09-17T23:59:00Z', '2025-11-30T10:00:00Z']) {
      const last = Date.parse(snapshot.anchor) + replayShiftMs(snapshot, new Date(now));

      expect(last).toBeLessThanOrEqual(Date.parse(now));
      expect(last).toBeGreaterThan(Date.parse(now) - 24 * HOUR * 1000);
    }
  });

  it('keeps the time of day each fix was really taken', () => {
    const points = replayTripPoints(snapshot, new Date('2026-09-01'), new Date('2026-09-18'), new Date('2026-09-17T12:00:00Z'));
    const departure = points.find(p => p.tripId === 'demo-trip-2');

    expect(departure?.time).toBe('2026-09-17T04:00:00.000Z');
  });

  it('shows the latest trip in the default seven-day view on any day', () => {
    for (const now of ['2026-01-01T00:30:00Z', '2026-09-17T09:59:00Z', '2027-03-03T18:00:00Z']) {
      const today = new Date(now);
      const weekAgo = new Date(today.getTime() - 7 * 24 * HOUR * 1000);
      const tripIds = new Set(replayTripPoints(snapshot, weekAgo, today, today).map(p => p.tripId));

      expect(tripIds.has('demo-trip-2')).toBe(true);
    }
  });

  it('leaves out fixes outside the requested days', () => {
    const now = new Date('2026-09-17T12:00:00Z');
    const points = replayTripPoints(snapshot, new Date('2026-09-17T00:00:00'), new Date('2026-09-17T00:00:00'), now);

    expect(new Set(points.map(p => p.tripId))).toEqual(new Set(['demo-trip-2']));
  });

  it('builds points the rest of the app can treat like Pelagic ones', () => {
    const now = new Date('2026-09-17T12:00:00Z');
    const [point] = replayTripPoints(snapshot, new Date('2026-09-17'), new Date('2026-09-17'), now)
      .filter(p => p.speed > 0);

    expect(point).toMatchObject({
      tripId: 'demo-trip-2',
      latitude: -20.9,
      longitude: 35.5,
      speed: 9.4,
      heading: 45,
      range: 80000,
      boatName: 'Demo Vessel',
      community: 'Demo Community',
      tripCreated: '2026-09-17T04:00:00.000Z',
      tripUpdated: '2026-09-17T10:00:00.000Z'
    });
    expect(point.timestamp).toBe(point.time);
  });

  it('puts the vessel where its last trip ended, when it ended', () => {
    const location = replayLiveLocation(snapshot, new Date('2026-09-17T12:00:00Z'));

    expect(location).toMatchObject({ lat: -21.54, lng: 35.22, timezone: 'Africa/Maputo', boatName: 'Demo Vessel' });
    expect(location.lastGpsTs?.toISOString()).toBe('2026-09-17T10:00:00.000Z');
  });

  it('offers the landing site and fishing ground as saved waypoints', () => {
    const waypoints = replayWaypoints(snapshot, 'demo', kind => `name:${kind}`, new Date('2026-09-17T12:00:00Z'));

    expect(waypoints.map(w => [w.type, w.name])).toEqual([
      ['port', 'name:landingSite'],
      ['fishing_ground', 'name:fishingGround']
    ]);
    // Their ids are what makes the waypoint service simulate edits to them.
    expect(waypoints.every(w => w._id?.startsWith('demo-waypoint-'))).toBe(true);
  });
});

describe('the shipped snapshot', () => {
  const shipped: DemoSnapshot = JSON.parse(
    readFileSync(resolve(__dirname, '../../public/demo/snapshot.json'), 'utf8')
  );

  /** Every string the file is allowed to contain, and where. */
  const ALLOWED_STRINGS: Array<[path: RegExp, value: RegExp]> = [
    [/^window\.(from|to)$/, /^\d{4}-\d{2}-\d{2}$/],
    [/^timezone$/, /^(UTC|[A-Za-z]+\/[A-Za-z_]+)$/],
    [/^batteryState$/, /^[A-Za-z_ ]{1,20}$/],
    [/^anchor$/, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/],
    [/^waypoints\.\d+\.kind$/, /^(landingSite|fishingGround)$/]
  ];

  const strings = (value: unknown, path: string[] = []): Array<[string, string]> => {
    if (typeof value === 'string') return [[path.join('.'), value]];
    if (value && typeof value === 'object') {
      return Object.entries(value).flatMap(([key, child]) => strings(child, [...path, key]));
    }
    return [];
  };

  // A name, a community, an IMEI or a trip id would each arrive as a string,
  // so if every string is one of the few this file is meant to hold, none of
  // them can have slipped in. Adding a field means adding it here, on purpose.
  it('contains no text beyond what the demo needs', () => {
    for (const [path, value] of strings(shipped)) {
      const allowed = ALLOWED_STRINGS.some(([p, v]) => p.test(path) && v.test(value));
      expect(allowed, `unexpected string at ${path}`).toBe(true);
    }
  });

  it('holds only numeric fixes in its trips', () => {
    for (const trip of shipped.trips) {
      for (const fix of trip) {
        expect(fix).toHaveLength(6);
        expect(fix.every(n => typeof n === 'number' && Number.isFinite(n))).toBe(true);
      }
    }
  });

  it('has enough to fill the default seven-day view', () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * HOUR * 1000);
    const points = replayTripPoints(shipped, weekAgo, now, now);

    expect(new Set(points.map(p => p.tripId)).size).toBeGreaterThanOrEqual(1);
  });
});
