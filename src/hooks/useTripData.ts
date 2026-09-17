import { useState, useEffect, useCallback } from 'react';
import { Trip, TripPoint } from '../types';
import { fetchTripPoints, fetchLiveLocations } from '../api/pelagicDataService';
import { useAuth } from '../contexts/AuthContext';
import { hasTrackingDevice } from '../utils/userInfo';

interface UseTripDataReturn {
  trips: Trip[];
  tripPoints: TripPoint[];
  loading: boolean;
  dataAvailable: boolean | null;
  errorMessage: string | null;
  refetch: () => Promise<void>;
}

/**
 * Construct trips from trip points (moved from pelagicDataService to avoid redundant API calls)
 */
const constructTripsFromPoints = (points: TripPoint[], imeis?: string[]): Trip[] => {
  if (points.length === 0) {
    console.log('No points provided, returning empty trips array');
    return [];
  }
  
  console.log(`Constructing trips from ${points.length} points`);
  
  // Group points by trip ID
  const tripMap = new Map<string, TripPoint[]>();
  
  points.forEach(point => {
    if (!tripMap.has(point.tripId)) {
      tripMap.set(point.tripId, []);
    }
    tripMap.get(point.tripId)?.push(point);
  });
  
  // Create trip objects from grouped points
  const trips: Trip[] = [];
  
  for (const [tripId, tripPoints] of tripMap.entries()) {
    // Sort points by time
    tripPoints.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    
    const firstPoint = tripPoints[0];
    const lastPoint = tripPoints[tripPoints.length - 1];
    
    // Calculate duration in seconds
    const startTime = new Date(firstPoint.time);
    const endTime = new Date(lastPoint.time);
    const durationSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    
    // Calculate distance (using the range values from points)
    const distanceMeters = Math.max(...tripPoints.map(p => p.range));
    
    trips.push({
      id: tripId,
      startTime: firstPoint.time,
      endTime: lastPoint.time,
      boat: firstPoint.boat,
      boatName: firstPoint.boatName,
      community: firstPoint.community,
      durationSeconds,
      rangeMeters: distanceMeters,
      distanceMeters: distanceMeters * 1.2, // Estimate, as total path is likely longer than max range
      created: firstPoint.tripCreated,
      updated: lastPoint.tripUpdated,
      imei: imeis?.[0],
      lastSeen: lastPoint.time,
      timezone: undefined // Will be populated by live location data if available
    });
  }
  
  console.log(`Created ${trips.length} trips from points`);
  return trips;
};

export const useTripData = (
  dateFrom: Date,
  dateTo: Date
): UseTripDataReturn => {
  const { currentUser } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataAvailable, setDataAvailable] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentUser) return;

    const imeis = currentUser.imeis;

    // Admin users don't load data until they select a vessel (have IMEIs)
    if (currentUser.role === 'admin' && (!imeis || imeis.length === 0)) {
      setTrips([]);
      setTripPoints([]);
      setDataAvailable(null); // null means no attempt to load data yet
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    // Users without IMEI (self-registered users) should not call PDS APIs.
    // An administrator has no IMEI of their own either, so this has to be
    // asked of the vessel they selected above, not of their account.
    if (!hasTrackingDevice(currentUser) || !imeis || imeis.length === 0) {
      setTrips([]);
      setTripPoints([]);
      setDataAvailable(false);
      setErrorMessage(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      // Fetch trip points and live locations in parallel (trips will be constructed from points)
      const [points, liveLocations] = await Promise.all([
        fetchTripPoints({
          dateFrom,
          dateTo,
          imeis,
          includeDeviceInfo: true,
          includeLastSeen: true
        }),
        fetchLiveLocations(imeis).catch(err => {
          console.warn('Failed to fetch live locations for timezone info:', err);
          return []; // Return empty array if live locations fail
        })
      ]);

      console.log(`Received ${points.length} points from API`);

      // Construct trips from points client-side (no additional API call needed)
      const tripData = constructTripsFromPoints(points, imeis);

      // Create a map of IMEI -> timezone from live locations
      const timezoneMap = new Map<string, string>();
      liveLocations.forEach(location => {
        if (location.imei && location.timezone) {
          timezoneMap.set(location.imei, location.timezone);
        }
      });

      // Add timezone information to trips based on IMEI
      const tripsWithTimezone = tripData.map(trip => ({
        ...trip,
        timezone: trip.imei ? timezoneMap.get(trip.imei) : undefined
      }));

      setTripPoints(points);
      setTrips(tripsWithTimezone);
      setDataAvailable(points.length > 0 || tripData.length > 0);

      console.log(`Loaded ${points.length} trip points and ${tripData.length} trips`);
    } catch (err) {
      console.error('Error fetching trip data:', err);
      setDataAvailable(false);
      setErrorMessage('Failed to retrieve vessel data. Please check your connection or try again later.');
    } finally {
      setLoading(false);
    }
  }, [currentUser, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [currentUser, dateFrom, dateTo, fetchData]);

  return {
    trips,
    tripPoints,
    loading,
    dataAvailable,
    errorMessage,
    refetch: fetchData
  };
}; 
