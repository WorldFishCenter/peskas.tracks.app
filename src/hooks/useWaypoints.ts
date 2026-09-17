import { useState, useEffect, useCallback, useMemo } from 'react';
import { Waypoint, WaypointFormData } from '../types';
import { fetchWaypoints, createWaypoint, updateWaypoint, deleteWaypoint } from '../api/waypointsService';
import { useAuth } from '../contexts/AuthContext';

interface UseWaypointsReturn {
  waypoints: Waypoint[];
  visibleWaypoints: Waypoint[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addWaypoint: (data: WaypointFormData) => Promise<Waypoint>;
  editWaypoint: (waypointId: string, data: Partial<WaypointFormData>) => Promise<Waypoint>;
  removeWaypoint: (waypointId: string) => Promise<void>;
  toggleWaypointVisibility: (waypointId: string) => void;
  toggleAllWaypoints: (visible: boolean) => void;
  allWaypointsVisible: boolean;
}

/**
 * Custom hook for managing waypoints
 * Fetches, creates, updates, and deletes waypoints for the current user
 */
export function useWaypoints(): UseWaypointsReturn {
  const { currentUser } = useAuth();
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch waypoints for the current user
  const loadWaypoints = useCallback(async () => {
    if (!currentUser?.id) {
      console.log('No user logged in, skipping waypoint fetch');
      setWaypoints([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchWaypoints();
      // Initialize all waypoints as visible by default
      const waypointsWithVisibility = data.map(wp => ({ ...wp, visible: wp.visible !== false }));
      setWaypoints(waypointsWithVisibility);
      console.log(`Loaded ${data.length} waypoints for user ${currentUser.id}`);
    } catch (err) {
      console.error('Error loading waypoints:', err);
      setError(err instanceof Error ? err.message : 'Failed to load waypoints');
      setWaypoints([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.id]);

  // Load waypoints when user changes
  useEffect(() => {
    loadWaypoints();
  }, [loadWaypoints]);

  // Add a new waypoint
  const addWaypoint = useCallback(
    async (data: WaypointFormData): Promise<Waypoint> => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      try {
        // Get IMEI and username from user
        const imei = currentUser.imeis && currentUser.imeis.length > 0 ? currentUser.imeis[0] : undefined;
        const username = currentUser.username || undefined;

        const newWaypoint = await createWaypoint(currentUser.id, data, imei, username);

        // Add to local state with visible=true by default
        setWaypoints(prev => [{ ...newWaypoint, visible: true }, ...prev]);

        console.log('Waypoint created successfully:', newWaypoint);
        return newWaypoint;
      } catch (err) {
        console.error('Error adding waypoint:', err);
        throw err;
      }
    },
    [currentUser]
  );

  // Edit an existing waypoint
  const editWaypoint = useCallback(
    async (waypointId: string, data: Partial<WaypointFormData>): Promise<Waypoint> => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      try {
        const updatedWaypoint = await updateWaypoint(waypointId, currentUser.id, data);

        // Update local state
        setWaypoints(prev =>
          prev.map(wp => (wp._id === waypointId ? updatedWaypoint : wp))
        );

        console.log('Waypoint updated successfully:', updatedWaypoint);
        return updatedWaypoint;
      } catch (err) {
        console.error('Error editing waypoint:', err);
        throw err;
      }
    },
    [currentUser]
  );

  // Remove a waypoint
  const removeWaypoint = useCallback(
    async (waypointId: string): Promise<void> => {
      if (!currentUser?.id) {
        throw new Error('User not authenticated');
      }

      try {
        await deleteWaypoint(waypointId, currentUser.id);

        // Remove from local state
        setWaypoints(prev => prev.filter(wp => wp._id !== waypointId));

        console.log('Waypoint deleted successfully:', waypointId);
      } catch (err) {
        console.error('Error removing waypoint:', err);
        throw err;
      }
    },
    [currentUser]
  );

  // Toggle visibility of a single waypoint
  const toggleWaypointVisibility = useCallback((waypointId: string) => {
    setWaypoints(prev =>
      prev.map(wp =>
        wp._id === waypointId ? { ...wp, visible: wp.visible !== false ? false : true } : wp
      )
    );
  }, []);

  // Toggle all waypoints visibility
  const toggleAllWaypoints = useCallback((visible: boolean) => {
    setWaypoints(prev => prev.map(wp => ({ ...wp, visible })));
  }, []);

  // Compute visible waypoints (memoized)
  const visibleWaypoints = useMemo(() => {
    return waypoints.filter(wp => wp.visible !== false);
  }, [waypoints]);

  // Check if all waypoints are visible
  const allWaypointsVisible = useMemo(() => {
    return waypoints.length > 0 && waypoints.every(wp => wp.visible !== false);
  }, [waypoints]);

  return {
    waypoints,
    visibleWaypoints,
    loading,
    error,
    refetch: loadWaypoints,
    addWaypoint,
    editWaypoint,
    removeWaypoint,
    toggleWaypointVisibility,
    toggleAllWaypoints,
    allWaypointsVisible,
  };
}
