/**
 * Freeze real tracks into the snapshot demo mode replays.
 *
 * Demo mode used to sign in as a real vessel and show whatever it was doing
 * that week. When the vessel stopped reporting, the demo showed an empty map,
 * and in the meantime its IMEI, name and live position were handed to anyone
 * who clicked "Try Demo Mode". This takes a stretch of that vessel's history
 * once, keeps only what a demo needs to look real, and writes it to
 * public/demo/snapshot.json. src/api/demoTracksService.ts moves those tracks
 * forward to the present each time the demo opens.
 *
 * What survives, and what does not:
 *
 *   kept     positions, speed, heading, distance from the start, the time of
 *            day each fix was taken, the device timezone
 *   dropped  IMEI, boat id and name, community, customer, trip ids, and the
 *            real dates — only offsets from the last fix are written
 *
 * Only trips that make a coherent picture are taken: long enough to be a
 * fishing trip rather than a move across the harbour, leaving from and
 * returning to the vessel's usual landing site, with no GPS jumps.
 *
 * Usage:
 *   npm run demo:snapshot -- --imei <imei> --from 2025-09-01 --to 2025-12-01
 *
 * Reads VITE_API_TOKEN and VITE_API_SECRET (and VITE_PELAGIC_* for the device
 * timezone) from .env.local and .env. src/api/demoTracksService.test.ts checks
 * the file it writes for anything identifying, so run the tests afterwards.
 */

import * as dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';

dotenv.config({ path: '.env.local' });
dotenv.config();

const OUTPUT = path.join('public', 'demo', 'snapshot.json');

/** A trip shorter than this is a mooring change, not a fishing trip. */
const MIN_TRIP_HOURS = 2;
/** …and so is one that never gets further than this from where it started. */
const MIN_TRIP_RANGE_METERS = 3000;
/** How far from the usual landing site a trip may start or end. */
const MAX_PORT_DISTANCE_METERS = 5000;
/** Faster than this between two fixes is a GPS jump, not a boat. */
const MAX_PLAUSIBLE_SPEED_MPS = 25;
/** Line simplification tolerance: small enough to keep fishing manoeuvres. */
const SIMPLIFY_TOLERANCE_METERS = 30;
/** Never let two kept fixes be further apart in time than this. */
const MAX_GAP_SECONDS = 15 * 60;
/** Where a fishing ground may be: slow, and away from the landing site. */
const FISHING_SPEED_MPS = [0.3, 2];
const FISHING_MIN_PORT_DISTANCE_METERS = 10000;
const FISHING_GRID_DEGREES = 0.02;

const { values: args } = parseArgs({
  options: {
    imei: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' }
  }
});

if (!args.imei || !args.from || !args.to) {
  console.error('Usage: npm run demo:snapshot -- --imei <imei> --from YYYY-MM-DD --to YYYY-MM-DD');
  process.exit(1);
}

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://analytics.pelagicdata.com/api';
const API_TOKEN = process.env.VITE_API_TOKEN;
const API_SECRET = process.env.VITE_API_SECRET;

if (!API_TOKEN || !API_SECRET) {
  console.error('Error: VITE_API_TOKEN and VITE_API_SECRET must be set');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Geometry

const toRadians = (degrees) => degrees * Math.PI / 180;

function distanceMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371e3 * Math.asin(Math.sqrt(h));
}

/** Distance from p to the segment a–b, on a local flat projection. */
function distanceToSegmentMeters(p, a, b) {
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = 111320 * Math.cos(toRadians(a.lat));
  const project = (q) => [(q.lng - a.lng) * metersPerDegreeLng, (q.lat - a.lat) * metersPerDegreeLat];
  const [px, py] = project(p);
  const [bx, by] = project(b);
  const lengthSquared = bx * bx + by * by;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Ramer–Douglas–Peucker, iterative so a four-day trip cannot blow the stack. */
function simplify(points) {
  if (points.length <= 2) return points;

  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];

  while (stack.length) {
    const [start, end] = stack.pop();
    let furthest = -1;
    let furthestDistance = SIMPLIFY_TOLERANCE_METERS;

    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegmentMeters(points[i], points[start], points[end]);
      if (d > furthestDistance) {
        furthest = i;
        furthestDistance = d;
      }
    }

    if (furthest !== -1) {
      keep[furthest] = 1;
      stack.push([start, furthest], [furthest, end]);
    }
  }

  // Straight transits collapse to their ends; put back enough fixes that the
  // speed colouring and the tooltips still have something to show.
  const kept = [];
  for (let i = 0; i < points.length; i++) {
    const last = kept[kept.length - 1];
    if (keep[i] || (last && (points[i].time - last.time) / 1000 >= MAX_GAP_SECONDS)) {
      kept.push(points[i]);
    }
  }
  return kept;
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

// ---------------------------------------------------------------------------
// Pelagic

/** One request per month: the points endpoint slows sharply on long ranges. */
function monthlyRanges(from, to) {
  const ranges = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);

  while (cursor < end) {
    const next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    const stop = next < end ? next : end;
    ranges.push([cursor.toISOString().slice(0, 10), stop.toISOString().slice(0, 10)]);
    cursor = stop;
  }
  return ranges;
}

async function fetchPointsCsv(imei, from, to) {
  const url = `${API_BASE_URL}/${API_TOKEN}/v1/points/${from}/${to}?imeis=${imei}`;
  const response = await fetch(url, { headers: { 'X-API-SECRET': API_SECRET } });
  if (!response.ok) {
    throw new Error(`Points request for ${from}..${to} failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

/** Parse the points CSV into trips of { time, lat, lng, speed, heading, range }. */
function parseTrips(csvChunks) {
  const trips = new Map();

  for (const csv of csvChunks) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) continue;

    const headers = lines[0].split(',').map((h) => h.trim());
    const column = (name) => headers.indexOf(name);
    const cols = {
      time: column('Time'), trip: column('Trip'), lat: column('Lat'), lng: column('Lng'),
      speed: column('Speed (M/S)'), range: column('Range (Meters)'), heading: column('Heading')
    };

    for (const line of lines.slice(1)) {
      const v = line.split(',');
      const tripId = v[cols.trip];
      // "2025-10-23 11:55:20+00" is not a format Date parses everywhere.
      const time = new Date(v[cols.time].trim().replace(' ', 'T').replace(/\+00$/, 'Z')).getTime();
      if (!tripId || Number.isNaN(time)) continue;

      if (!trips.has(tripId)) trips.set(tripId, new Map());
      // Months overlap at their edges; key by time so a fix is counted once.
      trips.get(tripId).set(time, {
        time,
        lat: Number(v[cols.lat]),
        lng: Number(v[cols.lng]),
        speed: Number(v[cols.speed]) || 0,
        heading: Number(v[cols.heading]) || 0,
        range: Number(v[cols.range]) || 0
      });
    }
  }

  return [...trips.values()].map((fixes) => [...fixes.values()].sort((a, b) => a.time - b.time));
}

/** The device's timezone and battery state; the only device fields we keep. */
async function fetchDeviceState(imei) {
  const base = process.env.VITE_PELAGIC_API_BASE_URL || 'https://analytics.pelagicdata.com/api';
  const { VITE_PELAGIC_USERNAME: username, VITE_PELAGIC_PASSWORD: password, VITE_PELAGIC_CUSTOMER_ID: customerId } = process.env;

  if (!username || !password || !customerId) {
    console.warn('VITE_PELAGIC_* not set: using UTC as the demo timezone');
    return { timezone: 'UTC' };
  }

  try {
    const auth = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const { token } = await auth.json();

    const response = await fetch(`${base}/pds/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        customers: [{ entityType: 'CUSTOMER', id: customerId }],
        boats: [],
        imeis: [Number(imei)]
      })
    });
    const [device] = await response.json();

    return {
      timezone: device?.timezone || 'UTC',
      batteryState: device?.batteryState || undefined
    };
  } catch (error) {
    console.warn('Could not read the device timezone, using UTC:', error.message);
    return { timezone: 'UTC' };
  }
}

// ---------------------------------------------------------------------------
// Selection

function measureTrip(trip) {
  let jumps = 0;
  for (let i = 1; i < trip.length; i++) {
    const seconds = (trip[i].time - trip[i - 1].time) / 1000;
    if (seconds > 0 && distanceMeters(trip[i - 1], trip[i]) / seconds > MAX_PLAUSIBLE_SPEED_MPS) {
      jumps++;
    }
  }

  return {
    hours: (trip[trip.length - 1].time - trip[0].time) / 3.6e6,
    maxRange: Math.max(...trip.map((p) => distanceMeters(trip[0], p))),
    jumps
  };
}

/** The landing site: where this vessel's real trips usually begin. */
function findLandingSite(trips) {
  const starts = trips
    .filter((trip) => measureTrip(trip).hours >= MIN_TRIP_HOURS)
    .map((trip) => trip[0]);
  return { lat: median(starts.map((p) => p.lat)), lng: median(starts.map((p) => p.lng)) };
}

/** The grid cell where the vessel spent most time moving at fishing speed. */
function findFishingGround(trips, landingSite) {
  const cells = new Map();

  for (const trip of trips) {
    for (const p of trip) {
      if (p.speed < FISHING_SPEED_MPS[0] || p.speed > FISHING_SPEED_MPS[1]) continue;
      if (distanceMeters(p, landingSite) < FISHING_MIN_PORT_DISTANCE_METERS) continue;

      const key = `${Math.floor(p.lat / FISHING_GRID_DEGREES)}:${Math.floor(p.lng / FISHING_GRID_DEGREES)}`;
      const cell = cells.get(key) || { count: 0, lat: 0, lng: 0 };
      cell.count++;
      cell.lat += p.lat;
      cell.lng += p.lng;
      cells.set(key, cell);
    }
  }

  const busiest = [...cells.values()].sort((a, b) => b.count - a.count)[0];
  return busiest ? { lat: busiest.lat / busiest.count, lng: busiest.lng / busiest.count } : null;
}

// ---------------------------------------------------------------------------

const round = (value, places) => Number(value.toFixed(places));

/**
 * The speed the app's CSV parser would have produced: it reads values under
 * 20 as metres per second and converts them to km/h. Mirrored here so the
 * demo colours tracks exactly as the live data would.
 */
const displaySpeed = (metersPerSecond) => metersPerSecond < 20 ? metersPerSecond * 3.6 : metersPerSecond;

async function main() {
  console.log(`Fetching points ${args.from}..${args.to}`);
  const chunks = [];
  for (const [from, to] of monthlyRanges(args.from, args.to)) {
    chunks.push(await fetchPointsCsv(args.imei, from, to));
  }

  const allTrips = parseTrips(chunks).filter((trip) => trip.length > 1);
  if (!allTrips.length) {
    console.error('No trips in that range.');
    process.exit(1);
  }

  const landingSite = findLandingSite(allTrips);
  const trips = allTrips
    .filter((trip) => {
      const { hours, maxRange, jumps } = measureTrip(trip);
      return hours >= MIN_TRIP_HOURS &&
        maxRange >= MIN_TRIP_RANGE_METERS &&
        jumps === 0 &&
        distanceMeters(trip[0], landingSite) <= MAX_PORT_DISTANCE_METERS &&
        distanceMeters(trip[trip.length - 1], landingSite) <= MAX_PORT_DISTANCE_METERS;
    })
    .sort((a, b) => a[0].time - b[0].time);

  console.log(`Kept ${trips.length} of ${allTrips.length} trips`);
  if (!trips.length) {
    console.error('No trip passed the coherence checks; try a different range or vessel.');
    process.exit(1);
  }

  const lastTrip = trips[trips.length - 1];
  const anchor = lastTrip[lastTrip.length - 1].time;
  const fishingGround = findFishingGround(trips, landingSite);
  const device = await fetchDeviceState(args.imei);

  // Every string written here has to get past the allow-list in
  // src/api/demoTracksService.test.ts. Add a field there before adding one here.
  const snapshot = {
    version: 1,
    window: { from: args.from, to: args.to },
    timezone: device.timezone,
    ...(device.batteryState ? { batteryState: device.batteryState } : {}),
    anchor: new Date(anchor).toISOString(),
    // [seconds before anchor, lat, lng, km/h, heading, metres from start]
    trips: trips.map((trip) => simplify(trip).map((p) => [
      Math.round((p.time - anchor) / 1000),
      round(p.lat, 5),
      round(p.lng, 5),
      round(displaySpeed(p.speed), 1),
      Math.round(p.heading),
      Math.round(p.range)
    ])),
    waypoints: [
      { kind: 'landingSite', lat: round(landingSite.lat, 4), lng: round(landingSite.lng, 4) },
      ...(fishingGround ? [{ kind: 'fishingGround', lat: round(fishingGround.lat, 4), lng: round(fishingGround.lng, 4) }] : [])
    ]
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(snapshot)}\n`);

  const pointCount = snapshot.trips.reduce((sum, trip) => sum + trip.length, 0);
  console.log(`Wrote ${OUTPUT}: ${trips.length} trips, ${pointCount} points, ${(fs.statSync(OUTPUT).size / 1024).toFixed(0)} KB`);
  console.log('Run `npm run test` to check the snapshot carries nothing identifying.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
