import { format, addDays, subDays, isToday, differenceInHours } from 'date-fns';
import type { Trip, TripPoint, LiveLocation, VesselInsights } from '../types';
import { apiFetch, type QueryParams } from './httpClient';
import { isDemoMode } from '../utils/demoData';
import { fetchDemoTripPoints, fetchDemoLiveLocations } from './demoTracksService';

// Simple request cache to avoid repeated API calls with LRU eviction
const requestCache = new Map<string, { data: unknown; timestamp: number; expiry: number }>();
const MAX_CACHE_SIZE = 50;

// Fleet-wide trip activity for the vessel picker; see fetchFleetTripActivity.
// Kept apart from requestCache so it holds the small per-vessel summary rather
// than thousands of trips, and is never evicted by map browsing.
let fleetActivityCache: { data: FleetTripActivity; expiry: number } | null = null;
let fleetActivityRequest: Promise<FleetTripActivity> | null = null;

/** Canonical trip-distance multiplier over straight-line max range. */
const TRIP_DISTANCE_RANGE_FACTOR = 1.2;

const getCacheDuration = (dateTo: Date): number => {
  const hoursFromNow = differenceInHours(new Date(), dateTo);
  if (isToday(dateTo)) return 1 * 60 * 1000;
  if (hoursFromNow < 24) return 3 * 60 * 1000;
  return 10 * 60 * 1000;
};

/** Clear all cached movement data (used by manual refresh). */
export const clearCache = (): void => {
  requestCache.clear();
  fleetActivityCache = null;
};

const getCacheKey = (dateFrom: Date, dateTo: Date, imeis?: string[], extra?: string): string => {
  const dateRange = `${format(dateFrom, 'yyyy-MM-dd')}-${format(dateTo, 'yyyy-MM-dd')}`;
  const imeiStr = imeis?.join(',') || 'no-imeis';
  return `${dateRange}:${imeiStr}${extra ? `:${extra}` : ''}`;
};

const getGenericCacheKey = (operation: string, params: unknown): string =>
  `${operation}:${JSON.stringify(params || {})}`;

const getCachedData = <T>(key: string): T | null => {
  const cached = requestCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.data as T;
  }
  if (cached) {
    requestCache.delete(key);
  }
  return null;
};

const setCachedData = (key: string, data: unknown, cacheDuration: number): void => {
  if (requestCache.size >= MAX_CACHE_SIZE) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [k, v] of requestCache.entries()) {
      if (v.timestamp < oldestTime) {
        oldestTime = v.timestamp;
        oldestKey = k;
      }
    }

    if (oldestKey) {
      requestCache.delete(oldestKey);
    }
  }

  const timestamp = Date.now();
  requestCache.set(key, {
    data,
    timestamp,
    expiry: timestamp + cacheDuration
  });
};

/** Pelagic's historical trips and points, through our server, which holds the PDS token. */
const fetchPdsHistory = (path: string, query: QueryParams, timeoutMs: number): Promise<Response> =>
  apiFetch('/pds-history', { query: { path, ...query }, timeoutMs });

const commaList = (values?: string[]): string | undefined =>
  values && values.length > 0 ? values.join(',') : undefined;

export interface TripsFilter {
  dateFrom: Date;
  dateTo: Date;
  imeis?: string[];
  includeDeviceInfo?: boolean;
  includeLastSeen?: boolean;
  tags?: string[];
}

export interface PointsFilter extends TripsFilter {
  includeErrant?: boolean;
}

/** How often one vessel went to sea over the recent window. */
export interface VesselTripActivity {
  trips: number;
  /** When the most recent of those trips ended, as ISO 8601. */
  lastTripEnd: string;
}

/** Trip activity keyed by IMEI. Vessels with no trips have no entry. */
export type FleetTripActivity = Record<string, VesselTripActivity>;

/** The window the vessel picker counts trips over. */
export const TRIP_ACTIVITY_DAYS = 90;
const TRIP_ACTIVITY_CACHE_MS = 30 * 60 * 1000;

/** Complete, internally consistent vessel-tracks snapshot for one query. */
export interface VesselTracksSnapshot {
  trips: Trip[];
  tripPoints: TripPoint[];
  tripById: Record<string, TripPoint[]>;
  liveLocations: LiveLocation[];
  insights: VesselInsights;
}

/**
 * Movement seam: everything needed to obtain raw trip points, trip summaries,
 * live locations, and fleet activity. Two production adapters satisfy it
 * (Pelagic HTTP and frozen demo snapshot) plus in-memory adapters in tests.
 */
export interface MovementAdapter {
  fetchTripPoints(filter: PointsFilter): Promise<TripPoint[]>;
  fetchLiveLocations(imeis: string[]): Promise<LiveLocation[]>;
  fetchFleetTripActivity(): Promise<FleetTripActivity>;
}

/**
 * Split one CSV line into fields, honouring double quotes so that a comma
 * inside a quoted boat or community name does not shift every later column.
 */
const splitCsvLine = (line: string): string[] => {
  const fields: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }

  fields.push(field);
  return fields;
};

/**
 * Pelagic writes timestamps as "2026-09-16 21:22:33+00". Chrome reads that,
 * Safari does not, so rewrite it as ISO 8601 before anything hands it to
 * `new Date()`.
 */
const toIsoTimestamp = (value: string): string =>
  value ? value.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00') : '';

/**
 * Parse trips CSV data from /v1/trips endpoint.
 * Columns are found by header rather than position because IMEI and Device Id
 * are appended only when deviceInfo is requested.
 */
export const parseTripsCSV = (csvText: string): Trip[] => {
  const lines = csvText.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(header => header.trim());

  return lines.slice(1)
    .map(line => {
      const fields = splitCsvLine(line);
      const column = (name: string): string => {
        const index = headers.indexOf(name);
        return index === -1 ? '' : (fields[index] ?? '').trim();
      };

      return {
        id: column('Trip'),
        startTime: toIsoTimestamp(column('Started')),
        endTime: toIsoTimestamp(column('Ended')),
        boat: column('Boat'),
        boatName: column('Boat Name'),
        community: column('Community'),
        durationSeconds: parseFloat(column('Duration (Seconds)')) || 0,
        rangeMeters: parseFloat(column('Range (Meters)')) || 0,
        distanceMeters: parseFloat(column('Distance (Meters)')) || 0,
        created: toIsoTimestamp(column('Created')),
        updated: toIsoTimestamp(column('Updated')),
        imei: column('IMEI') || undefined
      };
    })
    .filter(trip => trip.id);
};

/**
 * Parse trip points CSV data from /v1/points or /v1/trips/{id}/points.
 * Uses quote-aware splitting and Safari-safe ISO timestamps matching parseTripsCSV.
 */
export const parsePointsCSV = (csv: string, imei?: string): TripPoint[] => {
  if (!csv || csv.trim() === '') return [];

  const lines = csv.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(header => header.trim());
  const headerIndexes: Record<string, number> = {};

  headers.forEach((header, index) => {
    switch (header) {
      case 'Time': headerIndexes.time = index; break;
      case 'Boat': headerIndexes.boat = index; break;
      case 'Trip': headerIndexes.tripId = index; break;
      case 'Lat': headerIndexes.latitude = index; break;
      case 'Lng': headerIndexes.longitude = index; break;
      case 'Speed (M/S)': headerIndexes.speed = index; break;
      case 'Range (Meters)': headerIndexes.range = index; break;
      case 'Heading': headerIndexes.heading = index; break;
      case 'Boat Name': headerIndexes.boatName = index; break;
      case 'Community': headerIndexes.community = index; break;
      case 'Trip Created': headerIndexes.tripCreated = index; break;
      case 'Trip Updated': headerIndexes.tripUpdated = index; break;
      default:
        headerIndexes[header.toLowerCase().replace(/ /g, '')] = index;
    }
  });

  const points: TripPoint[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    const point: Partial<TripPoint> & Record<string, unknown> = {
      timestamp: '',
      imei: imei || ''
    };

    for (const [key, index] of Object.entries(headerIndexes)) {
      const value = (values[index] ?? '').trim();

      if (['latitude', 'longitude', 'speed', 'heading', 'range'].includes(key)) {
        point[key] = parseFloat(value) || 0;
      } else if (['time', 'tripCreated', 'tripUpdated'].includes(key)) {
        point[key] = toIsoTimestamp(value);
      } else {
        point[key] = value;
      }
    }

    if (typeof point.speed === 'number' && point.speed < 20) {
      point.speed = point.speed * 3.6; // m/s to km/h
    }

    if (point.time) {
      point.timestamp = point.time as string;
    }
    point.deviceId = (point.boat as string) || `device-${imei?.slice(-4)}`;
    point.lastSeen = (point.tripUpdated as string) || (point.time as string);

    points.push(point as TripPoint);
  }

  return points;
};

/**
 * Count trips per vessel and note when each vessel's latest trip ended.
 * Trips without an IMEI cannot be matched to a vessel and are skipped.
 */
export const summariseTripActivity = (trips: Trip[]): FleetTripActivity => {
  const activity: FleetTripActivity = {};

  for (const trip of trips) {
    if (!trip.imei) continue;

    const entry = (activity[trip.imei] ??= { trips: 0, lastTripEnd: '' });
    const end = trip.endTime || trip.startTime;

    entry.trips += 1;
    if (!entry.lastTripEnd || Date.parse(end) > Date.parse(entry.lastTripEnd)) {
      entry.lastTripEnd = end;
    }
  }

  return activity;
};

/**
 * Single assembly pipeline turning raw trip points and live locations into
 * grouped points, trips (with timezone enrichment and canonical maxRange * 1.2
 * distance), and matching vessel insights. Never mutates input arrays.
 */
export const assembleVesselTracks = (
  points: TripPoint[],
  liveLocations: LiveLocation[] = [],
  imeis?: string[],
  now: Date = new Date()
): VesselTracksSnapshot => {
  const tripById: Record<string, TripPoint[]> = {};

  for (const point of points) {
    (tripById[point.tripId] ??= []).push(point);
  }

  const timezoneByImei = new Map<string, string>();
  for (const loc of liveLocations) {
    if (loc.imei && loc.timezone) {
      timezoneByImei.set(loc.imei, loc.timezone);
    }
  }

  const trips: Trip[] = [];
  const oneDayAgoMs = subDays(now, 1).getTime();
  let activeTrips = 0;
  let totalDistanceMeters = 0;

  for (const [tripId, rawTripPoints] of Object.entries(tripById)) {
    const sorted = [...rawTripPoints].sort(
      (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
    );
    tripById[tripId] = sorted;

    const firstPoint = sorted[0];
    const lastPoint = sorted[sorted.length - 1];
    const startMs = new Date(firstPoint.time).getTime();
    const endMs = new Date(lastPoint.time).getTime();
    const durationSeconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
    const maxRangeMeters = Math.max(...sorted.map(p => p.range || 0));
    const distanceMeters = maxRangeMeters * TRIP_DISTANCE_RANGE_FACTOR;
    const tripImei = firstPoint.imei || imeis?.[0];

    if (endMs > oneDayAgoMs) {
      activeTrips += 1;
    }
    totalDistanceMeters += distanceMeters;

    trips.push({
      id: tripId,
      startTime: firstPoint.time,
      endTime: lastPoint.time,
      boat: firstPoint.boat,
      boatName: firstPoint.boatName,
      community: firstPoint.community,
      durationSeconds,
      rangeMeters: maxRangeMeters,
      distanceMeters,
      created: firstPoint.tripCreated,
      updated: lastPoint.tripUpdated,
      imei: tripImei,
      lastSeen: lastPoint.time,
      timezone: tripImei ? timezoneByImei.get(tripImei) : undefined
    });
  }

  const avgSpeed =
    points.length > 0
      ? points.reduce((sum, p) => sum + (p.speed || 0), 0) / points.length
      : 0;

  return {
    trips,
    tripPoints: points,
    tripById,
    liveLocations,
    insights: {
      activeTrips,
      totalDistance: parseFloat((totalDistanceMeters / 1000).toFixed(1)),
      avgSpeed: parseFloat(avgSpeed.toFixed(1))
    }
  };
};

/** Calculate map center from a set of trip points. */
export const calculateCenterFromPoints = (
  points: TripPoint[]
): { latitude: number; longitude: number } => {
  if (points.length === 0) {
    return { latitude: -4.4, longitude: 39.6 };
  }

  const totalLat = points.reduce((sum, p) => sum + p.latitude, 0);
  const totalLng = points.reduce((sum, p) => sum + p.longitude, 0);

  return {
    latitude: totalLat / points.length,
    longitude: totalLng / points.length
  };
};

// --- Internal HTTP / Pelagic adapter implementation ---

const fetchTripsFromAPI = async (filter: TripsFilter): Promise<Trip[]> => {
  const cacheKey = getCacheKey(filter.dateFrom, filter.dateTo, filter.imeis, 'trips');
  const cachedData = getCachedData<Trip[]>(cacheKey);
  if (cachedData) return cachedData;

  const adjustedDateTo = isToday(filter.dateTo) ? addDays(filter.dateTo, 1) : filter.dateTo;
  const dateFrom = format(filter.dateFrom, 'yyyy-MM-dd');
  const dateTo = format(adjustedDateTo, 'yyyy-MM-dd');

  try {
    const response = await fetchPdsHistory(`trips/${dateFrom}/${dateTo}`, {
      imeis: commaList(filter.imeis),
      deviceInfo: filter.includeDeviceInfo || undefined,
      withLastSeen: filter.includeLastSeen || undefined,
      tags: commaList(filter.tags)
    }, 15000);

    if (!response.ok) {
      throw new Error(`Failed to fetch trips: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();
    if (csvText.trim() === '' || csvText.length < 5) return [];

    const trips = parseTripsCSV(csvText);
    setCachedData(cacheKey, trips, getCacheDuration(filter.dateTo));
    return trips;
  } catch (error) {
    if (!filter.imeis || filter.imeis.length === 0) return [];
    throw error;
  }
};

const fetchTripPointsForTripId = async (tripId: string, imei?: string): Promise<TripPoint[]> => {
  try {
    const response = await fetchPdsHistory(`trips/${tripId}/points`, {}, 15000);
    if (!response.ok) return [];
    const csvText = await response.text();
    if (csvText.trim() === '' || csvText.length < 5) return [];
    return parsePointsCSV(csvText, imei);
  } catch {
    return [];
  }
};

const fetchTripPointsViaTripsFallback = async (filter: PointsFilter): Promise<TripPoint[]> => {
  try {
    const trips = await fetchTripsFromAPI(filter);
    const tripIds = Array.from(new Set(trips.map(trip => trip.id).filter(Boolean)));
    if (!tripIds.length) return [];

    const tripPointsArrays = await Promise.all(
      tripIds.map(id => fetchTripPointsForTripId(id, filter.imeis?.[0]))
    );
    return tripPointsArrays.flat();
  } catch {
    return [];
  }
};

const fetchTripPointsFromLocalSnapshot = async (filter: PointsFilter): Promise<TripPoint[]> => {
  try {
    const response = await apiFetch('/fallback/points', {
      headers: { Accept: 'application/json' },
      query: {
        dateFrom: format(filter.dateFrom, 'yyyy-MM-dd'),
        dateTo: format(filter.dateTo, 'yyyy-MM-dd'),
        imeis: commaList(filter.imeis)
      },
      timeoutMs: 10000
    });

    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? (data as TripPoint[]) : [];
  } catch {
    return [];
  }
};

const convertTimestamp = (timestamp: string | null): Date | null => {
  if (!timestamp) return null;
  try {
    const iso = toIsoTimestamp(timestamp);
    const date = new Date(iso);
    if (!Number.isNaN(date.getTime())) return date;
    const withTz = iso.includes('+') || iso.includes('Z') ? iso : `${iso}+00:00`;
    const parsed = new Date(withTz);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value as Record<string, unknown>, newKey));
    } else {
      result[newKey] = value;
    }
  }
  return result;
};

const parseLiveLocationData = (data: unknown[]): LiveLocation[] => {
  if (!Array.isArray(data)) return [];

  return data
    .map((device, index) => {
      const flattened = flattenObject(device as Record<string, unknown>);
      return {
        deviceIndex: (index + 1).toString(),
        boatName: (flattened.boatName || flattened['boat.name'] || '') as string,
        directCustomerName: (flattened.directCustomerName || flattened['directCustomer.name'] || '') as string,
        timezone: (flattened.timezone || 'UTC') as string,
        lastSeen: convertTimestamp((flattened.lastSeen as string) ?? null),
        imei: (flattened.imei || '') as string,
        lat: parseFloat((flattened.lat as string) || '0') || 0,
        lng: parseFloat((flattened.lng as string) || '0') || 0,
        lastGpsTs: convertTimestamp((flattened.lastGpsTs as string) ?? null),
        batteryState: flattened.batteryState as string | undefined,
        externalBoatId: flattened.externalBoatId as string | undefined
      };
    })
    .filter(location => Boolean(location.imei));
};

export const pelagicHttpAdapter: MovementAdapter = {
  async fetchTripPoints(filter: PointsFilter): Promise<TripPoint[]> {
    const cacheKey = getCacheKey(filter.dateFrom, filter.dateTo, filter.imeis, 'points');
    const cachedData = getCachedData<TripPoint[]>(cacheKey);
    if (cachedData) return cachedData;

    // Add +1 day buffer for "today" queries so UTC-midnight truncation does not
    // drop recent hours for fishers in positive timezones (e.g. EAT/UTC+3).
    const adjustedDateTo = isToday(filter.dateTo) ? addDays(filter.dateTo, 1) : filter.dateTo;
    const dateFrom = format(filter.dateFrom, 'yyyy-MM-dd');
    const dateTo = format(adjustedDateTo, 'yyyy-MM-dd');

    try {
      const response = await fetchPdsHistory(`points/${dateFrom}/${dateTo}`, {
        imeis: commaList(filter.imeis),
        deviceInfo: filter.includeDeviceInfo || undefined,
        errant: filter.includeErrant || undefined,
        withLastSeen: filter.includeLastSeen || undefined,
        tags: commaList(filter.tags)
      }, 15000);

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 500 && errorText.includes('empty_api_points.csv')) {
          return [];
        }
        if (!filter.imeis || filter.imeis.length === 0) {
          return [];
        }
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const csvText = await response.text();
      let points: TripPoint[] = [];

      if (csvText.trim() === '' || csvText.length < 5) {
        points = await fetchTripPointsFromLocalSnapshot(filter);
        if (!points.length) {
          points = await fetchTripPointsViaTripsFallback(filter);
        }
      } else {
        points = parsePointsCSV(csvText, filter.imeis?.[0]);
      }

      setCachedData(cacheKey, points, getCacheDuration(filter.dateTo));
      return points;
    } catch (error) {
      if (!filter.imeis || filter.imeis.length === 0) return [];

      const localPoints = await fetchTripPointsFromLocalSnapshot(filter);
      if (localPoints.length) return localPoints;

      const tripFallbackPoints = await fetchTripPointsViaTripsFallback(filter);
      if (tripFallbackPoints.length) return tripFallbackPoints;

      throw error;
    }
  },

  async fetchLiveLocations(imeis: string[]): Promise<LiveLocation[]> {
    if (!imeis || imeis.length === 0) return [];

    const cacheKey = getGenericCacheKey('liveLocations', { imeis });
    const cachedData = getCachedData<LiveLocation[]>(cacheKey);
    if (cachedData) return cachedData;

    const response = await apiFetch('/live-locations', {
      query: { imeis: imeis.join(',') },
      timeoutMs: 15000
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const parsedData = parseLiveLocationData(await response.json());
    setCachedData(cacheKey, parsedData, 60 * 1000);
    return parsedData;
  },

  async fetchFleetTripActivity(): Promise<FleetTripActivity> {
    if (fleetActivityCache && Date.now() < fleetActivityCache.expiry) {
      return fleetActivityCache.data;
    }

    if (!fleetActivityRequest) {
      fleetActivityRequest = (async () => {
        const today = new Date();
        const dateFrom = format(subDays(today, TRIP_ACTIVITY_DAYS), 'yyyy-MM-dd');
        // A day past today so today's trips are not cut off by midnight UTC.
        const dateTo = format(addDays(today, 1), 'yyyy-MM-dd');

        const response = await fetchPdsHistory(`trips/${dateFrom}/${dateTo}`, { deviceInfo: true }, 30000);
        if (!response.ok) {
          throw new Error(`Failed to fetch fleet trips: ${response.status} ${response.statusText}`);
        }

        const activity = summariseTripActivity(parseTripsCSV(await response.text()));
        fleetActivityCache = { data: activity, expiry: Date.now() + TRIP_ACTIVITY_CACHE_MS };
        return activity;
      })().finally(() => {
        fleetActivityRequest = null;
      });
    }

    return fleetActivityRequest;
  }
};

/** Frozen snapshot adapter for demo mode — structurally never reaches Pelagic. */
export const demoMovementAdapter: MovementAdapter = {
  fetchTripPoints: (filter) => fetchDemoTripPoints(filter.dateFrom, filter.dateTo),
  fetchLiveLocations: () => fetchDemoLiveLocations(),
  fetchFleetTripActivity: async () => ({})
};

const activeAdapter = (): MovementAdapter =>
  isDemoMode() ? demoMovementAdapter : pelagicHttpAdapter;

/**
 * Load a consistent snapshot of trips, trip points, tripById, live locations,
 * and vessel insights in a single parallel round-trip.
 */
export const loadVesselTracks = async (
  filter: PointsFilter,
  adapter: MovementAdapter = activeAdapter()
): Promise<VesselTracksSnapshot> => {
  const imeis = filter.imeis ?? [];
  const [points, liveLocations] = await Promise.all([
    adapter.fetchTripPoints(filter),
    adapter.fetchLiveLocations(imeis).catch(err => {
      console.warn('Failed to fetch live locations:', err);
      return [] as LiveLocation[];
    })
  ]);

  return assembleVesselTracks(points, liveLocations, imeis);
};

/**
 * Atomically clear cached movement entries and reload both trip points and
 * live locations so every panel and the map stay in sync.
 */
export const refreshVesselTracks = async (
  filter: PointsFilter,
  adapter: MovementAdapter = activeAdapter()
): Promise<VesselTracksSnapshot> => {
  clearCache();
  return loadVesselTracks(filter, adapter);
};

/** Fetch assembled trips for a date window (used by TripSelectionModal). */
export const fetchTrips = async (
  filter: TripsFilter,
  adapter: MovementAdapter = activeAdapter()
): Promise<Trip[]> => {
  const points = await adapter.fetchTripPoints(filter);
  return assembleVesselTracks(points, [], filter.imeis).trips;
};

/** Fetch fleet-wide 90-day trip activity (used by admin vessel picker). */
export const fetchFleetTripActivity = async (
  adapter: MovementAdapter = activeAdapter()
): Promise<FleetTripActivity> => adapter.fetchFleetTripActivity();
