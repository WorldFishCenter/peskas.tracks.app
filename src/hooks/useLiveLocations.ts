import { useState, useEffect, useCallback } from 'react';
import { LiveLocation } from '../types';
import { fetchLiveLocations } from '../api/pelagicDataService';
import { useAuth } from '../contexts/AuthContext';

interface UseLiveLocationsReturn {
  liveLocations: LiveLocation[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useLiveLocations = (): UseLiveLocationsReturn => {
  const { currentUser } = useAuth();
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveLocationsData = useCallback(async () => {
    console.log('loadLiveLocations effect triggered');

    if (!currentUser) {
      console.log('No current user, skipping live locations load');
      setLiveLocations([]);
      return;
    }

    // Only skip live locations for admin users with no selected vessels
    // Demo and regular users should always try to load live locations
    if (currentUser.role === 'admin' && (!currentUser.imeis || currentUser.imeis.length === 0)) {
      console.log('Admin user has no selected vessels, skipping live locations load');
      setLiveLocations([]);
      return;
    }

    // Users without IMEI (self-registered users) should not call PDS APIs.
    // An administrator reaches here only with a vessel already selected.
    if (currentUser.role !== 'admin' && currentUser.hasImei === false) {
      console.log('User has no IMEI (self-registered), skipping live locations load');
      setLiveLocations([]);
      return;
    }

    // For non-admin users, if they somehow have no IMEIs, log a warning but still try
    if (!currentUser.imeis || currentUser.imeis.length === 0) {
      console.warn('Non-admin user has no IMEIs, this might indicate a data issue, but attempting to load live locations anyway');
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Pass IMEIs if available, otherwise pass empty array (API will handle this)
      const userImeis = currentUser.imeis && currentUser.imeis.length > 0 ? currentUser.imeis : undefined;
      const locations = await fetchLiveLocations(userImeis);
      setLiveLocations(locations || []);
    } catch (err) {
      console.error('Error loading live locations:', err);
      setError('Failed to load live location data');
      setLiveLocations([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchLiveLocationsData();
  }, [currentUser, fetchLiveLocationsData]);

  return {
    liveLocations,
    loading,
    error,
    refetch: fetchLiveLocationsData
  };
}; 
