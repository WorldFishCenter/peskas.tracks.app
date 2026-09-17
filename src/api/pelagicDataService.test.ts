import { describe, it, expect } from 'vitest';
import { parseTripsCSV, summariseTripActivity } from './pelagicDataService';

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
