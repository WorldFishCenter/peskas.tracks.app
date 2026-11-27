import { useState, useEffect, useCallback } from 'react';
import type { Trip, TripPoint, LiveLocation, VesselInsights } from '../types';
import { loadVesselTracks, refreshVesselTracks } from '../api/pelagicDataService';
import { useAuth } from '../contexts/AuthContext';
import { hasTrackingDevice } from '../utils/userInfo';

const EMPTY_INSIGHTS: VesselInsights = {
  activeTrips: 0,
  totalDistance: 0,
  avgSpeed: 0
};

export interface UseVesselTracksReturn {
  trips: Trip[];
  tripPoints: TripPoint[];
  tripById: Record<string, TripPoint[]>;
  liveLocations: LiveLocation[];
  insights: VesselInsights;
  loading: boolean;
  dataAvailable: boolean | null;
  errorMessage: string | null;
  refetch: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Single React binding over the vessel-tracks module. Loads trip points and
 * live locations once in parallel and exposes one atomic refresh for the map,
 * trips table, vessel details, and vessel insights together.
 */
export const useVesselTracks = (dateFrom: Date, dateTo: Date): UseVesselTracksReturn => {
  const { currentUser } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([]);
  const [tripById, setTripById] = useState<Record<string, TripPoint[]>>({});
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [insights, setInsights] = useState<VesselInsights>(EMPTY_INSIGHTS);
  const [loading, setLoading] = useState(false);
  const [dataAvailable, setDataAvailable] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetEmpty = useCallback((available: boolean | null) => {
    setTrips([]);
    setTripPoints([]);
    setTripById({});
    setLiveLocations([]);
    setInsights(EMPTY_INSIGHTS);
    setDataAvailable(available);
    setErrorMessage(null);
    setLoading(false);
  }, []);

  const execute = useCallback(
    async (forceRefresh: boolean) => {
      if (!currentUser) return;

      const imeis = currentUser.imeis;

      // Administrators do not load movement data until they choose a vessel.
      if (currentUser.role === 'admin' && (!imeis || imeis.length === 0)) {
        resetEmpty(null);
        return;
      }

      // Self-registered fishers without a tracking device never call Pelagic.
      if (!hasTrackingDevice(currentUser) || !imeis || imeis.length === 0) {
        resetEmpty(false);
        return;
      }

      setLoading(true);
      setErrorMessage(null);

      try {
        const loader = forceRefresh ? refreshVesselTracks : loadVesselTracks;
        const snapshot = await loader({
          dateFrom,
          dateTo,
          imeis,
          includeDeviceInfo: true,
          includeLastSeen: true
        });

        setTrips(snapshot.trips);
        setTripPoints(snapshot.tripPoints);
        setTripById(snapshot.tripById);
        setLiveLocations(snapshot.liveLocations);
        setInsights(snapshot.insights);
        setDataAvailable(snapshot.tripPoints.length > 0);
      } catch (error) {
        console.error('Error loading vessel tracks:', error);
        setTrips([]);
        setTripPoints([]);
        setTripById({});
        setInsights(EMPTY_INSIGHTS);
        setDataAvailable(false);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error fetching trip data');
      } finally {
        setLoading(false);
      }
    },
    [currentUser, dateFrom, dateTo, resetEmpty]
  );

  const refetch = useCallback(() => execute(false), [execute]);
  const refresh = useCallback(() => execute(true), [execute]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return {
    trips,
    tripPoints,
    tripById,
    liveLocations,
    insights,
    loading,
    dataAvailable,
    errorMessage,
    refetch,
    refresh
  };
};
