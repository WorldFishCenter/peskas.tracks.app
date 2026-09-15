// Core data types
//
// These are the shapes the Pelagic Analytics API is parsed into; the comments
// record which source field each one comes from. Declared here and nowhere
// else — pelagicDataService imports them rather than restating them.

/** One GPS fix within a trip, parsed from a row of the points CSV. */
export interface TripPoint {
  time: string;           // "2025-02-02 15:21:53+00"
  boat: string;           // "24422"
  tripId: string;         // "12951544"
  latitude: number;       // -5.99924
  longitude: number;      // 39.18637
  speed: number;
  range: number;
  heading: number;
  boatName: string;       // "Mashaallah"
  community: string;      // "Fuji"
  tripCreated: string;
  tripUpdated: string;

  // Derived rather than parsed
  timestamp: string;      // Alias for time
  imei?: string;          // Added from request parameters
  deviceId?: string;
  lastSeen?: string;      // Using tripUpdated as lastSeen
}

/** A vessel journey, built by aggregating the trip points that share a tripId. */
export interface Trip {
  id: string;              // From trip ID in points
  startTime: string;       // Earliest time in points
  endTime: string;         // Latest time in points
  boat: string;            // Boat number
  boatName: string;        // Boat name
  community: string;       // Community
  durationSeconds: number; // Calculated from points
  rangeMeters: number;     // Maximum range from points
  distanceMeters: number;  // Total distance from points
  created: string;         // From tripCreated
  updated: string;         // From tripUpdated
  imei?: string;           // Added from request
  lastSeen?: string;       // Using latest point time
  timezone?: string;       // Device timezone, for displaying local times
}

export interface LiveLocation {
  deviceIndex: string;
  boatName: string;
  directCustomerName: string;
  timezone: string;
  lastSeen: Date | null;
  imei: string;
  lat: number;
  lng: number;
  lastGpsTs: Date | null;
  batteryState?: string;
  externalBoatId?: string;
}

// UI Component types
export interface VesselDetails {
  id: string;
  name: string;
  captain?: string;
  registration?: string;
  lastUpdate: string;
  status: 'active' | 'docked' | 'unknown';
  fishing?: boolean;
  speed: number;
  distanceKm?: number;
  durationMinutes?: number;
  imei?: string;
  batteryState?: string;
  community?: string;
  region?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  lastGpsTime?: string;
  lastSeenTime?: string;
  externalBoatId?: string;
}

export interface MapProps {
  onSelectVessel?: (vessel: LiveLocation | null) => void;
  dateFrom?: Date;
  dateTo?: Date;
  selectedTripId?: string;
  liveLocations?: LiveLocation[];
  centerOnLiveLocations?: boolean;
  onCenterOnLiveLocations?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  hasTrackingDevice?: boolean;
  deviceLocation?: GPSCoordinate | null;
  onGetMyLocation?: () => void;
  isGettingLocation?: boolean;
  showNoTripsMessage?: boolean;
  waypoints?: Waypoint[];
  onEnterWaypointMode?: () => void;
  onToggleWaypoints?: () => void;
  waypointsCount?: number;
  isWaypointSelectionMode?: boolean;
  onCancelWaypointMode?: () => void;
  onConfirmWaypointLocation?: (coordinates: { lat: number; lng: number }) => void;
  centeredWaypoint?: { lat: number; lng: number } | null;
}

export interface TripsTableProps {
  trips: Trip[];
  onSelectTrip: (tripId: string) => void;
  loading?: boolean;
}

export interface DateRangeSelectorProps {
  dateFrom: Date;
  dateTo: Date;
  onDateChange: (dateFrom: Date, dateTo: Date) => void;
}

// Map-specific types
export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface MobileTooltip {
  object: TripPoint | LiveLocation | TripPath | Waypoint | { count: number; position?: [number, number] } | null;
  x: number;
  y: number;
  visible: boolean;
}

export interface TripPath {
  tripId: string;
  name: string;
  path: number[][];
  color: RGB;
  width: number;
}

// API types
export interface TripPointsParams {
  dateFrom: Date;
  dateTo: Date;
  imeis: string[];
  includeDeviceInfo?: boolean;
  includeLastSeen?: boolean;
}

export interface TripsParams {
  dateFrom: Date;
  dateTo: Date;
  imeis: string[];
  includeDeviceInfo?: boolean;
  includeLastSeen?: boolean;
}

// Statistics types
export interface VesselInsights {
  activeTrips: number;
  totalDistance: number;
  avgSpeed: number;
}

// Color types
export type RGB = [number, number, number];

// GPS coordinate types
export interface GPSCoordinate {
  latitude: number;
  longitude: number;
  accuracy?: number; // GPS accuracy in meters
  timestamp: string; // When GPS coordinate was captured
}

// Catch reporting types
export interface CatchEvent {
  _id?: string;
  tripId: string;
  date: string;
  fishGroup?: FishGroup; // Optional for no-catch events
  quantity?: number; // Optional for no-catch events
  photos?: string[]; // Base64 encoded photos
  gps_photo?: GPSCoordinate[]; // GPS coordinates for each photo (same index as photos array)
  catch_outcome: number; // 1 = has catch, 0 = no catch
  imei?: string; // IMEI for PDS users, undefined for non-PDS users
  username?: string; // Username for non-PDS users, undefined for PDS users
  boatName?: string;
  community?: string;
  reportedAt: string;
}

export type FishGroup = 'reef fish' | 'sharks/rays' | 'small pelagics' | 'large pelagics' | 'tuna/tuna-like';

export interface CatchEntry {
  fishGroup: FishGroup;
  quantity: number;
  id: string; // For managing multiple entries
  photos?: string[]; // Base64 encoded photos
  gps_photo?: GPSCoordinate[]; // GPS coordinates for each photo (same index as photos array)
}

export interface CatchEventFormData {
  tripId: string;
  date: Date;
  fishGroup: FishGroup;
  quantity: number;
  photos?: string[]; // Base64 encoded photos
  gps_photo?: GPSCoordinate[]; // GPS coordinates for each photo (same index as photos array)
}

export interface MultipleCatchFormData {
  tripId: string;
  date: Date;
  catches: CatchEntry[];
  noCatch: boolean;
}

// Fisher Statistics types
export interface FisherStatsSummary {
  totalCatch: number;
  totalTrips: number;
  successfulTrips: number;
  successRate: number;
  avgCatchPerTrip: number;
}

export interface CatchByType {
  fishGroup: string;
  totalKg: number;
  count: number;
}

export interface RecentTrip {
  tripId: string;
  date: string;
  catch_kg: number;
  fishGroup?: string;
}

export interface TimeSeriesPoint {
  date: string; // ISO date string YYYY-MM-DD
  catch_kg: number;
}

export interface FisherStatsComparison {
  type: 'community' | 'previous';
  avgCatch: number;
  avgSuccessRate: number;
  basedOn: string;
  hasData?: boolean; // Indicates if comparison period has actual data
}

export interface FisherStatsResponse {
  summary: FisherStatsSummary;
  catchByType: CatchByType[];
  recentTrips: RecentTrip[];
  timeSeries: TimeSeriesPoint[];
  comparison: FisherStatsComparison;
}

export interface FisherStatsParams {
  imei: string;
  dateFrom?: Date;
  dateTo?: Date;
  compareWith?: 'community' | 'previous';
}

// Fisher Performance types
export interface TripTypeStats {
  offshore: { count: number; avgCatch: number };
  'mid-range': { count: number; avgCatch: number };
  nearshore: { count: number; avgCatch: number };
}

export interface PerformanceMetric {
  yourAvg: number;
  comparisonAvg: number;
  percentDiff: number;
}

export interface PerformanceMetrics {
  cpue_kg_per_hour: PerformanceMetric;
  kg_per_liter: PerformanceMetric;
  search_ratio: PerformanceMetric;
}

export interface BestTrip {
  tripId: string;
  cpue: number;
  date: string;
  tripType: string;
}

export interface FisherPerformanceComparison {
  type: 'community' | 'previous';
  basedOn: string;
  hasData?: boolean; // Indicates if comparison period has actual data
}

export interface FisherPerformanceResponse {
  tripTypes: TripTypeStats;
  metrics: PerformanceMetrics;
  bestTrips: BestTrip[];
  comparison: FisherPerformanceComparison;
}

export interface FisherPerformanceParams {
  imei: string;
  dateFrom?: Date;
  dateTo?: Date;
  compareWith?: 'community' | 'previous';
}

// Waypoint types
export type WaypointType = 'port' | 'anchorage' | 'fishing_ground' | 'favorite_spot' | 'shallow_reef' | 'other';

export interface Waypoint {
  _id?: string;
  userId: string;
  imei?: string;
  username?: string;
  name: string;
  description?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  type: WaypointType;
  isPrivate: boolean;
  metadata?: {
    deviceInfo?: string;
    accuracy?: number;
  };
  createdAt: string;
  updatedAt: string;
  visible?: boolean; // Client-side only - controls map visibility
}

export interface WaypointFormData {
  name: string;
  type: WaypointType;
  description?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
} 
