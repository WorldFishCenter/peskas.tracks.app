import { format, addDays, isToday, differenceInHours } from 'date-fns';
import type { Trip, TripPoint, LiveLocation } from '../types';
import { apiFetch, externalFetch } from './httpClient';

// Simple request cache to avoid repeated API calls with LRU eviction
const requestCache = new Map<string, { data: any; timestamp: number; expiry: number }>();
const MAX_CACHE_SIZE = 50; // Maximum cache entries to prevent memory leaks

// Dynamic cache duration based on data recency
const getCacheDuration = (dateTo: Date): number => {
  const now = new Date();
  const hoursFromNow = differenceInHours(now, dateTo);

  if (isToday(dateTo)) {
    return 1 * 60 * 1000; // 1 minute for today's data
  } else if (hoursFromNow < 24) {
    return 3 * 60 * 1000; // 3 minutes for last 24 hours
  } else {
    return 10 * 60 * 1000; // 10 minutes for historical data
  }
};

/**
 * Clear all cached data (useful for manual refresh)
 */
export const clearCache = (): void => {
  const size = requestCache.size;
  requestCache.clear();
  console.log(`🗑️ Cleared ${size} cached entries`);
};

// Cache utility functions
const getCacheKey = (dateFrom: Date, dateTo: Date, imeis?: string[], extra?: string): string => {
  const dateRange = `${format(dateFrom, 'yyyy-MM-dd')}-${format(dateTo, 'yyyy-MM-dd')}`;
  const imeiStr = imeis?.join(',') || 'no-imeis';
  return `${dateRange}:${imeiStr}${extra ? `:${extra}` : ''}`;
};

const getGenericCacheKey = (operation: string, params: any): string => {
  return `${operation}:${JSON.stringify(params || {})}`;
};

const getCachedData = (key: string): any | null => {
  const cached = requestCache.get(key);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  if (cached) {
    requestCache.delete(key);
  }
  return null;
};

const setCachedData = (key: string, data: any, cacheDuration: number): void => {
  // Implement LRU eviction: remove oldest entry if cache is full
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
  console.log(`📋 Cache SET (duration: ${cacheDuration / 1000}s)`);
};

// Get API credentials from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://analytics.pelagicdata.com/api';
const API_TOKEN = import.meta.env.VITE_API_TOKEN || '{$token}'; 
const API_SECRET = import.meta.env.VITE_API_SECRET || '{$secret}';

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

/**
 * Fetch trips metadata directly from Pelagic Data API /v1/trips endpoint
 * Returns trip summaries without all GPS points (more efficient for listing trips)
 */
export const fetchTripsFromAPI = async (filter: TripsFilter): Promise<Trip[]> => {
  // Check cache first
  const cacheKey = getCacheKey(filter.dateFrom, filter.dateTo, filter.imeis, 'trips');
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  // Fix timezone ambiguity: Add buffer day for "today" queries
  const adjustedDateTo = isToday(filter.dateTo) ? addDays(filter.dateTo, 1) : filter.dateTo;

  const dateFrom = format(filter.dateFrom, 'yyyy-MM-dd');
  const dateTo = format(adjustedDateTo, 'yyyy-MM-dd');

  console.log(`📅 Fetching trips metadata: ${dateFrom} to ${dateTo}${isToday(filter.dateTo) ? ' (today+1 buffer)' : ''}`);

  let url = `${API_BASE_URL}/${API_TOKEN}/v1/trips/${dateFrom}/${dateTo}`;

  // Add query parameters
  const params: string[] = [];

  if (filter.imeis && filter.imeis.length > 0) {
    params.push(`imeis=${filter.imeis.join(',')}`);
  }

  if (filter.includeDeviceInfo) {
    params.push('deviceInfo=true');
  }

  if (filter.includeLastSeen) {
    params.push('withLastSeen=true');
  }

  if (filter.tags && filter.tags.length > 0) {
    params.push(`tags=${filter.tags.join(',')}`);
  }

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  try {
    const response = await externalFetch(url, {
      headers: {
        'X-API-SECRET': API_SECRET,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      timeoutMs: 15000
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch trips: ${response.status} ${response.statusText}`);
    }

    const csvText = await response.text();

    if (csvText.trim() === '' || csvText.length < 5) {
      console.log('Empty or invalid CSV response');
      return [];
    }

    const trips = parseTripsCSV(csvText);
    console.log(`Parsed ${trips.length} trips from CSV`);

    // Cache the results with dynamic duration based on data recency
    const cacheDuration = getCacheDuration(filter.dateTo);
    setCachedData(cacheKey, trips, cacheDuration);

    return trips;
  } catch (error) {
    console.error('Error fetching trips:', error);

    // For non-IMEI requests, return empty array instead of throwing
    if (!filter.imeis || filter.imeis.length === 0) {
      return [];
    }

    throw error;
  }
};

/**
 * Parse trips CSV data from /v1/trips endpoint
 */
const parseTripsCSV = (csvText: string): Trip[] => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return []; // Need at least header + 1 data row

  const trips: Trip[] = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // CSV format from /v1/trips endpoint (based on typical Pelagic format):
    // tripId, boatId, boatName, community, startTime, endTime, duration, distance, created, updated, lastSeen, imei
    const parts = line.split(',');

    if (parts.length >= 10) {
      const trip: Trip = {
        id: parts[0]?.trim() || '',
        boat: parts[1]?.trim() || '',
        boatName: parts[2]?.trim() || '',
        community: parts[3]?.trim() || '',
        startTime: parts[4]?.trim() || '',
        endTime: parts[5]?.trim() || '',
        durationSeconds: parseFloat(parts[6]) || 0,
        distanceMeters: parseFloat(parts[7]) || 0,
        rangeMeters: parseFloat(parts[7]) || 0, // Use distance as range for now
        created: parts[8]?.trim() || '',
        updated: parts[9]?.trim() || '',
        lastSeen: parts.length > 10 ? parts[10]?.trim() : undefined,
        imei: parts.length > 11 ? parts[11]?.trim() : undefined
      };

      trips.push(trip);
    }
  }

  return trips;
};

/**
 * Fetch trips data from Pelagic Data API
 * This function first fetches points and then constructs trips from them
 */
export const fetchTrips = async (filter: TripsFilter): Promise<Trip[]> => {
  // First, fetch all the points for the time range
  const points = await fetchTripPoints(filter);
  
  if (points.length === 0) {
    console.log('No points found, returning empty trips array');
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
    
    // Note: samplePoint was unused, removed to fix linting
    
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
      imei: filter.imeis?.[0],
      lastSeen: lastPoint.time,
      timezone: undefined // Will be populated by live location data if available
    });
  }
  
  console.log(`Created ${trips.length} trips from points`);
  return trips;
};

/**
 * Fallback: fetch points via /v1/trips/{id}/points when /v1/points returns empty.
 */
const fetchTripPointsForTripId = async (tripId: string, imei?: string): Promise<TripPoint[]> => {
  const url = `${API_BASE_URL}/${API_TOKEN}/v1/trips/${tripId}/points`;

  try {
    const response = await externalFetch(url, {
      headers: {
        'X-API-SECRET': API_SECRET,
        'Accept': 'text/csv,*/*;q=0.8'
      },
      timeoutMs: 15000
    });

    if (!response.ok) {
      console.error(`Trip points request failed (${tripId}): ${response.status} ${response.statusText}`);
      return [];
    }

    const csvText = await response.text();
    if (csvText.trim() === '' || csvText.length < 5) {
      console.warn(`Trip points empty for trip ${tripId}`);
      return [];
    }

    return parsePointsCSV(csvText, imei);
  } catch (error) {
    console.error(`Error fetching trip points for trip ${tripId}:`, error);
    return [];
  }
};

const fetchTripPointsViaTripsFallback = async (filter: PointsFilter): Promise<TripPoint[]> => {
  try {
    const trips = await fetchTripsFromAPI(filter);
    if (!trips.length) {
      console.warn('No trips returned from /v1/trips during fallback lookup.');
      return [];
    }

    const tripIds = Array.from(new Set(trips.map(trip => trip.id).filter(Boolean)));
    if (!tripIds.length) {
      console.warn('Trips response contained no IDs; cannot fetch trip points.');
      return [];
    }

    console.warn(`Fallback: fetching points for ${tripIds.length} trip(s) via /v1/trips/{id}/points`);

    const tripPointsArrays = await Promise.all(
      tripIds.map(id => fetchTripPointsForTripId(id, filter.imeis?.[0]))
    );

    return tripPointsArrays.flat();
  } catch (fallbackError) {
    console.error('Fallback via /v1/trips failed:', fallbackError);
    return [];
  }
};

/**
 * Fallback: load trip points from local parquet snapshot served by backend.
 */
const fetchTripPointsFromLocalSnapshot = async (filter: PointsFilter): Promise<TripPoint[]> => {
  try {
    const response = await apiFetch('/fallback/points', {
      headers: { 'Accept': 'application/json' },
      query: {
        dateFrom: format(filter.dateFrom, 'yyyy-MM-dd'),
        dateTo: format(filter.dateTo, 'yyyy-MM-dd'),
        imeis: filter.imeis && filter.imeis.length ? filter.imeis.join(',') : undefined
      },
      timeoutMs: 10000
    });

    if (!response.ok) {
      console.warn(`Fallback parquet endpoint failed: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      console.warn('Fallback parquet endpoint returned non-array payload');
      return [];
    }

    return data as TripPoint[];
  } catch (error) {
    console.error('Error fetching fallback parquet points:', error);
    return [];
  }
};

/**
 * Fetch trip points data from Pelagic Data API
 */
export const fetchTripPoints = async (filter: PointsFilter): Promise<TripPoint[]> => {
  // Check cache first
  const cacheKey = getCacheKey(filter.dateFrom, filter.dateTo, filter.imeis, 'points');
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  // Fix timezone ambiguity: Add buffer day for "today" queries to ensure we capture recent data
  // When API receives "2025-11-20", it may interpret as start of day in UTC, potentially missing
  // recent hours if user is in a different timezone (e.g., EAT/UTC+3)
  const adjustedDateTo = isToday(filter.dateTo) ? addDays(filter.dateTo, 1) : filter.dateTo;

  const dateFrom = format(filter.dateFrom, 'yyyy-MM-dd');
  const dateTo = format(adjustedDateTo, 'yyyy-MM-dd');

  console.log(`📅 Date range: ${dateFrom} to ${dateTo}${isToday(filter.dateTo) ? ' (today+1 buffer)' : ''}`);
  
  let url = `${API_BASE_URL}/${API_TOKEN}/v1/points/${dateFrom}/${dateTo}`;
  
  // Add query parameters
  const params: string[] = [];
  
  if (filter.imeis && filter.imeis.length > 0) {
    params.push(`imeis=${filter.imeis.join(',')}`);
  }
  
  if (filter.includeDeviceInfo) {
    params.push('deviceInfo=true');
  }
  
  if (filter.includeErrant) {
    params.push('errant=true');
  }
  
  if (filter.includeLastSeen) {
    params.push('withLastSeen=true');
  }
  
  if (filter.tags && filter.tags.length > 0) {
    params.push(`tags=${filter.tags.join(',')}`);
  }
  
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  
  try {
    const response = await externalFetch(url, {
      headers: {
        'X-API-SECRET': API_SECRET,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      timeoutMs: 15000
    });
    
    if (!response.ok) {
      console.error(`API request failed with status: ${response.status}`);
      const errorText = await response.text();
      console.error(`Error response: ${errorText}`);
      
      // Handle specific 500 error with server-side file issue
      if (response.status === 500 && errorText.includes('empty_api_points.csv')) {
        console.warn('Server-side file system issue detected. This is a known API server problem.');
        return []; // Return empty array instead of mock data
      }
      
      // For non-IMEI requests (admin view), return empty array instead of throwing
      if (!filter.imeis || filter.imeis.length === 0) {
        console.warn('No IMEIs provided and API failed. Returning empty array for admin view.');
        return [];
      }
      
      throw new Error(`API request failed: ${response.statusText}`);
    }
    
    // API returns CSV, we need to parse it
    const csvText = await response.text();
    console.log(`Received CSV data of length: ${csvText.length}`);
    
    let points: TripPoint[] = [];

    if (csvText.trim() === '' || csvText.length < 5) {
      console.warn('Empty or invalid CSV response from /v1/points; attempting local snapshot fallback.');
      points = await fetchTripPointsFromLocalSnapshot(filter);

      if (!points.length) {
        console.warn('Local snapshot fallback returned no data; attempting trip-based fallback.');
        points = await fetchTripPointsViaTripsFallback(filter);
      }
    } else {
      points = parsePointsCSV(csvText, filter.imeis?.[0]);
      console.log(`Parsed ${points.length} points from CSV`);
    }

    // Cache the results with dynamic duration based on data recency
    const cacheDuration = getCacheDuration(filter.dateTo);
    setCachedData(cacheKey, points, cacheDuration);

    return points;
  } catch (error) {
    console.error('Error fetching trip points:', error);
    
    // For non-IMEI requests, return empty array instead of throwing
    if (!filter.imeis || filter.imeis.length === 0) {
      console.warn('No IMEIs provided and API failed. Returning empty array.');
      return [];
    }
    
    // For IMEI requests, try fallbacks before throwing
    console.warn('Primary API call failed; attempting fallbacks.');
    const localPoints = await fetchTripPointsFromLocalSnapshot(filter);
    if (localPoints.length) {
      return localPoints;
    }

    const tripFallbackPoints = await fetchTripPointsViaTripsFallback(filter);
    if (tripFallbackPoints.length) {
      return tripFallbackPoints;
    }

    throw error;
  }
};

/**
 * Parse CSV response for trip points data
 * Based on the actual CSV format: 
 * Time,Boat,Trip,Lat,Lng,Speed (M/S),Range (Meters),Heading,Boat Name,Community,Trip Created,Trip Updated
 */
const parsePointsCSV = (csv: string, imei?: string): TripPoint[] => {
  if (!csv || csv.trim() === '') {
    console.warn('Empty CSV data received from API');
    return [];
  }
  
  try {
    const lines = csv.trim().split('\n');
    
    if (lines.length < 2) {
      console.warn('CSV data contains only headers or is empty');
      return [];
    }
    
    const headers = lines[0].split(',').map(h => h.trim());
    console.log('Points CSV headers:', headers);
    
    // Define mapping for CSV fields to our object properties
    const headerIndexes: {[key: string]: number} = {};
    
    // Map the headers to their positions
    headers.forEach((header, index) => {
      // Handle specific headers we know about
      switch (header) {
        case 'Time': headerIndexes['time'] = index; break;
        case 'Boat': headerIndexes['boat'] = index; break;
        case 'Trip': headerIndexes['tripId'] = index; break;
        case 'Lat': headerIndexes['latitude'] = index; break;
        case 'Lng': headerIndexes['longitude'] = index; break;
        case 'Speed (M/S)': headerIndexes['speed'] = index; break;
        case 'Range (Meters)': headerIndexes['range'] = index; break;
        case 'Heading': headerIndexes['heading'] = index; break;
        case 'Boat Name': headerIndexes['boatName'] = index; break;
        case 'Community': headerIndexes['community'] = index; break;
        case 'Trip Created': headerIndexes['tripCreated'] = index; break;
        case 'Trip Updated': headerIndexes['tripUpdated'] = index; break;
        // Add any other known headers here
        default:
          // For unrecognized headers, use a lowercase version of the header name
          headerIndexes[header.toLowerCase().replace(/ /g, '')] = index;
      }
    });
    
    const points: TripPoint[] = [];
    
    // Skip the header row and process all data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines
      
      try {
        // Split the CSV line while handling quoted fields
        const values = line.split(',');
        
        // Create a point object using the mapped indices
        const point: Partial<TripPoint> = {
          timestamp: '', // Will be set from time field below
          imei: imei || '' // Add IMEI from filter
        };
        
        // Process each field based on the header mapping
        Object.keys(headerIndexes).forEach(key => {
          const index = headerIndexes[key];
          const value = values[index]?.trim() || '';
          
          if (['latitude', 'longitude', 'speed', 'heading', 'range'].includes(key)) {
            // Convert numeric fields
            (point as any)[key] = parseFloat(value) || 0;
          } else {
            // String fields
            (point as any)[key] = value;
          }
        });
        
        // Convert speed from m/s to km/h if needed
        if (point.speed !== undefined) {
          // If it seems like the speed is in m/s (common values < 20),
          // convert to km/h for consistency with our app
          if (point.speed < 20) {
            point.speed = point.speed * 3.6; // m/s to km/h
          }
        }
        
        // Add standard timestamp field for compatibility
        if (point.time) {
          point.timestamp = point.time;
        }
        
        // Add deviceId for compatibility
        point.deviceId = point.boat || `device-${imei?.slice(-4)}`;
        
        // Add lastSeen for compatibility
        point.lastSeen = point.tripUpdated || point.time;
        
        points.push(point as TripPoint);
      } catch (lineError) {
        console.error(`Error parsing CSV line ${i}:`, lineError, line);
      }
    }
    
    console.log(`Successfully parsed ${points.length} points`);
    return points;
  } catch (error) {
    console.error('Error parsing points CSV:', error);
    return [];
  }
};

/**
 * Convert timestamp string to Date object with timezone support
 */
const convertTimestamp = (timestamp: string | null): Date | null => {
  if (!timestamp) return null;
  
  try {
    // Try to parse the timestamp directly first
    const date = new Date(timestamp);
    if (!isNaN(date.getTime())) {
      return date;
    }
    
    // If that fails, try adding timezone info
    const timestampWithTz = timestamp.includes('+') || timestamp.includes('Z') 
      ? timestamp 
      : `${timestamp}+00:00`; // Assume UTC if no timezone
    
    return new Date(timestampWithTz);
  } catch (error) {
    console.warn(`Failed to parse timestamp: ${timestamp}`, error);
    return null;
  }
};

// Helper function to get a date range for the last N days
export const getDateRangeForLastDays = (days: number): {dateFrom: Date, dateTo: Date} => {
  const dateTo = new Date();
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - days);
  
  return { dateFrom, dateTo };
}; 

// Pelagic Analytics API Service for Live Location Data
// Uses the new authentication-based API instead of token/secret

// Get API credentials from environment variables
const PELAGIC_API_BASE_URL = import.meta.env.VITE_PELAGIC_API_BASE_URL || 'https://analytics.pelagicdata.com/api';
const API_USERNAME = import.meta.env.VITE_PELAGIC_USERNAME;
const API_PASSWORD = import.meta.env.VITE_PELAGIC_PASSWORD;
const CUSTOMER_ID = import.meta.env.VITE_PELAGIC_CUSTOMER_ID;

// Cache for authentication token
const authCache: {
  token: string | null,
  refreshToken: string | null,
  expiresAt: Date | null
} = {
  token: null,
  refreshToken: null,
  expiresAt: null
};

/**
 * Authenticate with Pelagic Analytics API
 */
const authenticate = async (): Promise<{token: string | null, refreshToken: string | null}> => {
  // Check if we have a valid cached token
  if (authCache.token && authCache.expiresAt && new Date() < authCache.expiresAt) {
    return {
      token: authCache.token,
      refreshToken: authCache.refreshToken
    };
  }

  console.log('Authenticating with Pelagic Analytics API...');
  
  // Validate that API credentials are configured
  if (!API_USERNAME || !API_PASSWORD || !CUSTOMER_ID) {
    throw new Error('Pelagic API credentials not configured');
  }
  
  try {
    const response = await externalFetch(`${PELAGIC_API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Accept-Encoding': 'gzip, deflate, br'
      },
      body: {
        username: API_USERNAME,
        password: API_PASSWORD
      },
      timeoutMs: 10000 // 10 second timeout for auth
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status} ${response.statusText}`);
    }

    const authData = await response.json();
    
    // Cache the token (assume it expires in 1 hour if not specified)
    authCache.token = authData.token;
    authCache.refreshToken = authData.refreshToken;
    authCache.expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
    
    console.log('Successfully authenticated with Pelagic Analytics API');
    return authData;
  } catch (error) {
    console.error('Failed to authenticate:', error);
    throw error;
  }
};

/**
 * Fetch live location data for specific devices
 */
export const fetchLiveLocations = async (imeis?: string[]): Promise<LiveLocation[]> => {
  // Check cache first
  const cacheKey = getGenericCacheKey('liveLocations', { imeis });
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    console.log('📋 Using cached live locations data');
    return cachedData;
  }
  
  try {
    // Authenticate first
    const { token } = await authenticate();
    
    // Prepare request body with filters
    const requestBody = {
      customers: [
        {
          entityType: "CUSTOMER",
          id: CUSTOMER_ID
        }
      ],
      boats: [],
      imeis: imeis ? imeis.map(imei => parseInt(imei)) : []
    };
    
    console.log('📡 Fetching live locations from API');
    
    const response = await externalFetch(`${PELAGIC_API_BASE_URL}/pds/devices`, {
      method: 'POST',
      headers: {
        'X-Authorization': `Bearer ${token}`,
        'Accept-Encoding': 'gzip, deflate, br'
      },
      body: requestBody,
      timeoutMs: 15000
    });
    
    if (!response.ok) {
      console.error(`❌ API request failed: ${response.status} ${response.statusText}`);
      
      if (response.status === 401) {
        // Token might be expired, clear cache and retry once
        authCache.token = null;
        authCache.expiresAt = null;
        console.log('🔑 Token expired, retrying authentication...');
        
        const { token: newToken } = await authenticate();
        const retryResponse = await externalFetch(`${PELAGIC_API_BASE_URL}/pds/devices`, {
          method: 'POST',
          headers: {
            'X-Authorization': `Bearer ${newToken}`,
            'Accept-Encoding': 'gzip, deflate, br'
          },
          body: requestBody,
          timeoutMs: 15000
        });
        
        if (!retryResponse.ok) {
          throw new Error(`API request failed after retry: ${retryResponse.status} ${retryResponse.statusText}`);
        }
        
        const retryData = await retryResponse.json();
        console.log(`✅ Successfully retrieved ${retryData.length} device records after retry (REAL API DATA)`);
        const parsedRetryData = parseLiveLocationData(retryData);

        // Cache the results with 1-minute duration (live data should refresh frequently)
        const liveLocationCacheDuration = 1 * 60 * 1000; // 1 minute
        setCachedData(cacheKey, parsedRetryData, liveLocationCacheDuration);

        return parsedRetryData;
      }
      
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log(`✅ Successfully retrieved ${data.length} device records (REAL API DATA)`);
    
    const parsedData = parseLiveLocationData(data);

    // Cache the results with 1-minute duration (live data should refresh frequently)
    const liveLocationCacheDuration = 1 * 60 * 1000; // 1 minute
    setCachedData(cacheKey, parsedData, liveLocationCacheDuration);

    return parsedData;
  } catch (error) {
    console.error('❌ Error fetching live locations:', error);
    
    // Just throw the error - no mock data fallbacks
    throw error;
  }
};

/**
 * Parse the API response into LiveLocation objects
 */
const parseLiveLocationData = (data: unknown[]): LiveLocation[] => {
  if (!Array.isArray(data)) {
    console.warn('Expected array from API, got:', typeof data);
    return [];
  }
  
  return data.map((device, index) => {
    // Flatten nested structures (similar to your R code)
    const flattened = flattenObject(device as Record<string, unknown>);
    
    // Extract the fields we need
    const liveLocation: LiveLocation = {
      deviceIndex: (index + 1).toString(),
      boatName: (flattened.boatName || flattened['boat.name'] || '') as string,
      directCustomerName: (flattened.directCustomerName || flattened['directCustomer.name'] || '') as string,
      timezone: (flattened.timezone || 'UTC') as string,
      lastSeen: convertTimestamp(flattened.lastSeen as string),
      imei: (flattened.imei || '') as string,
      lat: parseFloat((flattened.lat as string) || '0') || 0,
      lng: parseFloat((flattened.lng as string) || '0') || 0,
      lastGpsTs: convertTimestamp(flattened.lastGpsTs as string),
      batteryState: flattened.batteryState as string | undefined,
      externalBoatId: flattened.externalBoatId as string | undefined
    };
    
    return liveLocation;
  }).filter(location => location.imei); // Only return devices with valid IMEI
};

/**
 * Flatten nested object (similar to your R flatten_safely function)
 */
const flattenObject = (obj: Record<string, unknown>, prefix = ''): Record<string, unknown> => {
  const result: { [key: string]: unknown } = {};
  
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        // Recursively flatten objects
        Object.assign(result, flattenObject(obj[key] as Record<string, unknown>, newKey));
      } else {
        // Keep primitive values
        result[newKey] = obj[key];
      }
    }
  }
  
  return result;
};

/**
 * Get live location for a single device by IMEI
 */
export const fetchDeviceLiveLocation = async (imei: string): Promise<LiveLocation | null> => {
  const locations = await fetchLiveLocations([imei]);
  return locations.length > 0 ? locations[0] : null;
};

/**
 * Check if a location is recent (within last 24 hours)
 */
export const isLocationRecent = (location: LiveLocation): boolean => {
  if (!location.lastGpsTs) return false;
  
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  return location.lastGpsTs > oneDayAgo;
};

/**
 * Format location timestamp for display
 */
export const formatLocationTime = (date: Date): string => {
  if (!date) return 'Never';
  
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  
  return date.toLocaleDateString();
};

/**
 * Convert LiveLocation to TripPoint format for compatibility
 */
export const liveLocationToTripPoint = (location: LiveLocation): TripPoint => {
  const timeStr = location.lastGpsTs?.toISOString() || new Date().toISOString();
  
  return {
    time: timeStr,
    timestamp: timeStr,
    boat: location.externalBoatId || location.deviceIndex,
    tripId: `live-${location.imei}`,
    latitude: location.lat,
    longitude: location.lng,
    speed: 0, // Live location doesn't include speed
    range: 0, // Live location doesn't include range
    heading: 0, // Live location doesn't include heading
    boatName: location.boatName,
    community: location.directCustomerName,
    tripCreated: timeStr,
    tripUpdated: timeStr,
    imei: location.imei,
    deviceId: location.externalBoatId || location.deviceIndex,
    lastSeen: location.lastSeen?.toISOString()
  };
};
