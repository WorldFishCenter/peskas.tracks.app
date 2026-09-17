import { Waypoint, WaypointFormData } from '../types';
import { isDemoMode, isAdminMode } from '../utils/demoData';
import { apiFetch } from './httpClient';
import { fetchDemoWaypoints } from './demoTracksService';

/**
 * Fetch all waypoints for a user
 */
export async function fetchWaypoints(userId: string): Promise<Waypoint[]> {
  // The demo shows places taken from its own tracks, never a real fisher's.
  if (isDemoMode()) {
    return fetchDemoWaypoints(userId);
  }

  try {
    const response = await apiFetch('/waypoints', { query: { userId } });

    if (!response.ok) {
      throw new Error(`Failed to fetch waypoints: ${response.status}`);
    }

    const waypoints = await response.json();
    return waypoints;
  } catch (error) {
    console.error('Error fetching waypoints:', error);
    throw error;
  }
}

/**
 * Create a new waypoint
 */
export async function createWaypoint(
  userId: string,
  data: WaypointFormData,
  imei?: string,
  username?: string
): Promise<Waypoint> {
  // Check if we're in demo mode
  if (isDemoMode()) {
    console.log('Demo mode: simulating waypoint creation');
    // Return a mock successful response
    return {
      _id: `demo-waypoint-${Date.now()}`,
      userId,
      imei: imei || undefined,
      username: username || undefined,
      name: data.name,
      description: data.description,
      coordinates: data.coordinates,
      type: data.type,
      isPrivate: true,
      metadata: {
        deviceInfo: navigator.userAgent,
        accuracy: undefined
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visible: true
    };
  }

  try {
    const payload = {
      userId,
      imei: imei || null,
      username: username || null,
      name: data.name,
      description: data.description || null,
      coordinates: data.coordinates,
      type: data.type,
      metadata: {
        deviceInfo: navigator.userAgent,
        accuracy: undefined
      },
      // Include admin flag to protect real data
      isAdmin: isAdminMode()
    };

    const response = await apiFetch('/waypoints', {
      method: 'POST',
      body: payload,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to create waypoint: ${response.status}`);
    }

    const waypoint = await response.json();
    return waypoint;
  } catch (error) {
    console.error('Error creating waypoint:', error);
    throw error;
  }
}

/**
 * Update an existing waypoint
 */
export async function updateWaypoint(
  waypointId: string,
  userId: string,
  data: Partial<WaypointFormData>
): Promise<Waypoint> {
  // Check if we're in demo mode or this is a demo waypoint
  if (isDemoMode() || waypointId.startsWith('demo-waypoint-')) {
    console.log('Demo mode: simulating waypoint update');
    // Return a mock updated waypoint
    return {
      _id: waypointId,
      userId,
      name: data.name || 'Updated Waypoint',
      description: data.description,
      coordinates: data.coordinates || { lat: 0, lng: 0 },
      type: data.type || 'other',
      isPrivate: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      visible: true
    };
  }

  try {
    const payload = {
      userId,
      ...data
    };

    const response = await apiFetch(`/waypoints/${waypointId}`, {
      method: 'PUT',
      body: payload,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to update waypoint: ${response.status}`);
    }

    const waypoint = await response.json();
    return waypoint;
  } catch (error) {
    console.error('Error updating waypoint:', error);
    throw error;
  }
}

/**
 * Delete a waypoint
 */
export async function deleteWaypoint(
  waypointId: string,
  userId: string
): Promise<void> {
  // Check if we're in demo mode or this is a demo waypoint
  if (isDemoMode() || waypointId.startsWith('demo-waypoint-')) {
    console.log('Demo mode: simulating waypoint deletion');
    // Just return success - the hook will handle removing from local state
    return;
  }

  try {
    const response = await apiFetch(`/waypoints/${waypointId}`, {
      method: 'DELETE',
      query: { userId },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `Failed to delete waypoint: ${response.status}`);
    }
  } catch (error) {
    console.error('Error deleting waypoint:', error);
    throw error;
  }
}
