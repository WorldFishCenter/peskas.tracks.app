import { describe, it, expect, vi } from 'vitest';
import {
  parseTripsCSV,
  parsePointsCSV,
  summariseTripActivity,
  assembleVesselTracks,
  loadVesselTracks,
  refreshVesselTracks,
  type MovementAdapter
} from './pelagicDataService';

/**
 * The vessel picker counts each vessel's recent trips from one fleet-wide
 * /v1/trips response. That only works if every row lands on the right vessel
 * and the right dates, whichever columns the endpoint chose to send.
 */

const HEADER =
  'Trip,Started,Ended,Boat,Boat Name,Boat Gear,Community,Duration (Seconds),Range (Meters),Distance (Meters),Created,Updated';

describe('parseTripsCSV', () => {
  it('reads columns by header, including the IMEI sent with device info', () => {
    const csv = [
      `${HEADER},IMEI,Device Id`,
      '101,2026-09-10 04:00:00+00,2026-09-10 10:30:00+00,7,Boat Seven,"",Harbour,23400,4000,52000,2026-09-10 11:00:00+00,2026-09-10 11:05:00+00,100000000000001,device-a'
    ].join('\n');

    expect(parseTripsCSV(csv)).toEqual([
      {
        id: '101',
        startTime: '2026-09-10T04:00:00+00:00',
        endTime: '2026-09-10T10:30:00+00:00',
        boat: '7',
        boatName: 'Boat Seven',
        community: 'Harbour',
        durationSeconds: 23400,
        rangeMeters: 4000,
        distanceMeters: 52000,
        created: '2026-09-10T11:00:00+00:00',
        updated: '2026-09-10T11:05:00+00:00',
        imei: '100000000000001'
      }
    ]);
  });

  it('leaves the IMEI unset when device info was not requested', () => {
    const csv = [
      HEADER,
      '101,2026-09-10 04:00:00+00,2026-09-10 10:30:00+00,7,Boat Seven,"",Harbour,23400,4000,52000,2026-09-10 11:00:00+00,2026-09-10 11:05:00+00'
    ].join('\n');

    const [trip] = parseTripsCSV(csv);

    expect(trip.imei).toBeUndefined();
    expect(trip.community).toBe('Harbour');
  });

  it('keeps a quoted comma inside its field', () => {
    const csv = [
      `${HEADER},IMEI,Device Id`,
      '101,2026-09-10 04:00:00+00,2026-09-10 10:30:00+00,7,"Boat, Seven","",Harbour,23400,4000,52000,2026-09-10 11:00:00+00,2026-09-10 11:05:00+00,100000000000001,device-a'
    ].join('\n');

    const [trip] = parseTripsCSV(csv);

    expect(trip.boatName).toBe('Boat, Seven');
    expect(trip.imei).toBe('100000000000001');
  });

  it('writes timestamps every browser can parse', () => {
    const csv = [
      HEADER,
      '101,2026-09-10 04:00:00+00,2026-09-10 10:30:00+00,7,Boat Seven,"",Harbour,0,0,0,,'
    ].join('\n');

    const [trip] = parseTripsCSV(csv);

    expect(new Date(trip.endTime).toISOString()).toBe('2026-09-10T10:30:00.000Z');
  });

  it('returns nothing for an empty response', () => {
    expect(parseTripsCSV('')).toEqual([]);
    expect(parseTripsCSV(`${HEADER},IMEI,Device Id\n`)).toEqual([]);
  });
});

describe('summariseTripActivity', () => {
  const trip = (imei: string | undefined, endTime: string) => ({
    id: `${imei}-${endTime}`,
    startTime: endTime,
    endTime,
    boat: '',
    boatName: '',
    community: '',
    durationSeconds: 0,
    rangeMeters: 0,
    distanceMeters: 0,
    created: '',
    updated: '',
    imei
  });

  it('counts trips per vessel and keeps the latest end, in any order', () => {
    const activity = summariseTripActivity([
      trip('A', '2026-09-01T10:00:00+00:00'),
      trip('A', '2026-09-15T10:00:00+00:00'),
      trip('B', '2026-08-01T10:00:00+00:00'),
      trip('A', '2026-09-05T10:00:00+00:00')
    ]);

    expect(activity).toEqual({
      A: { trips: 3, lastTripEnd: '2026-09-15T10:00:00+00:00' },
      B: { trips: 1, lastTripEnd: '2026-08-01T10:00:00+00:00' }
    });
  });

  it('skips trips it cannot tie to a vessel', () => {
    expect(summariseTripActivity([trip(undefined, '2026-09-01T10:00:00+00:00')])).toEqual({});
  });
});

describe('parsePointsCSV', () => {
  const POINTS_HEADER =
    'Time,Boat,Trip,Lat,Lng,Speed (M/S),Range (Meters),Heading,Boat Name,Community,Trip Created,Trip Updated';

  it('honours quoted commas and normalises Pelagic timestamps to ISO 8601', () => {
    const csv = [
      POINTS_HEADER,
      '2026-09-16 05:00:00+00,7,trip-1,-4.4,39.6,5,1000,90,"Boat, Seven","Fuji, North",2026-09-16 04:55:00+00,2026-09-16 08:00:00+00'
    ].join('\n');

    const [point] = parsePointsCSV(csv, '861508035295419');

    expect(point.boatName).toBe('Boat, Seven');
    expect(point.community).toBe('Fuji, North');
    expect(point.time).toBe('2026-09-16T05:00:00+00:00');
    expect(point.tripCreated).toBe('2026-09-16T04:55:00+00:00');
    expect(point.tripUpdated).toBe('2026-09-16T08:00:00+00:00');
    expect(point.speed).toBe(18); // 5 m/s -> 18 km/h
    expect(new Date(point.time).toISOString()).toBe('2026-09-16T05:00:00.000Z');
  });
});

describe('vessel-tracks assembly and movement seam', () => {
  const points = [
    {
      time: '2026-09-16T06:00:00+00:00',
      timestamp: '2026-09-16T06:00:00+00:00',
      boat: '7',
      tripId: 'trip-1',
      latitude: -4.41,
      longitude: 39.61,
      speed: 12,
      range: 5000,
      heading: 90,
      boatName: 'Mashaallah',
      community: 'Fuji',
      tripCreated: '2026-09-16T05:00:00+00:00',
      tripUpdated: '2026-09-16T06:00:00+00:00',
      imei: '861508035295419'
    },
    {
      time: '2026-09-16T05:00:00+00:00',
      timestamp: '2026-09-16T05:00:00+00:00',
      boat: '7',
      tripId: 'trip-1',
      latitude: -4.4,
      longitude: 39.6,
      speed: 8,
      range: 1000,
      heading: 85,
      boatName: 'Mashaallah',
      community: 'Fuji',
      tripCreated: '2026-09-16T05:00:00+00:00',
      tripUpdated: '2026-09-16T06:00:00+00:00',
      imei: '861508035295419'
    }
  ];

  const liveLocations = [
    {
      deviceIndex: '1',
      boatName: 'Mashaallah',
      directCustomerName: 'Fuji',
      timezone: 'Africa/Nairobi',
      lastSeen: new Date('2026-09-16T06:05:00Z'),
      imei: '861508035295419',
      lat: -4.41,
      lng: 39.61,
      lastGpsTs: new Date('2026-09-16T06:05:00Z')
    }
  ];

  it('uses one canonical maxRange * 1.2 distance across trips and vessel insights', () => {
    const snapshot = assembleVesselTracks(
      points,
      liveLocations,
      ['861508035295419'],
      new Date('2026-09-16T12:00:00Z')
    );

    expect(snapshot.trips).toHaveLength(1);
    expect(snapshot.trips[0].rangeMeters).toBe(5000);
    expect(snapshot.trips[0].distanceMeters).toBe(6000);
    expect(snapshot.trips[0].timezone).toBe('Africa/Nairobi');
    expect(snapshot.trips[0].durationSeconds).toBe(3600);
    // Insights totalDistance (km) agrees with trips[0].distanceMeters / 1000.
    expect(snapshot.insights).toEqual({
      activeTrips: 1,
      totalDistance: 6,
      avgSpeed: 10
    });
    // tripById points are sorted chronologically without mutating caller input order.
    expect(snapshot.tripById['trip-1'][0].time).toBe('2026-09-16T05:00:00+00:00');
    expect(points[0].time).toBe('2026-09-16T06:00:00+00:00');
  });

  it('loads and refreshes both trip points and live locations through one movement adapter', async () => {
    const adapter: MovementAdapter = {
      fetchTripPoints: vi.fn(async () => points),
      fetchLiveLocations: vi.fn(async () => liveLocations),
      fetchFleetTripActivity: vi.fn(async () => ({}))
    };

    const filter = {
      dateFrom: new Date('2026-09-10'),
      dateTo: new Date('2026-09-17'),
      imeis: ['861508035295419']
    };

    const first = await loadVesselTracks(filter, adapter);
    const refreshed = await refreshVesselTracks(filter, adapter);

    expect(first.trips).toHaveLength(1);
    expect(first.liveLocations).toHaveLength(1);
    expect(refreshed.trips).toHaveLength(1);
    expect(adapter.fetchTripPoints).toHaveBeenCalledTimes(2);
    expect(adapter.fetchLiveLocations).toHaveBeenCalledTimes(2);
  });
});
