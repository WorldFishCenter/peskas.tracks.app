import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Map, { type MapRef } from 'react-map-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import DeckGL from '@deck.gl/react';
import { useAuth } from '../contexts/AuthContext';
import { fetchTripPoints, getDateRangeForLastDays } from '../api/pelagicDataService';
import { getMapConfig } from '../config/mapConfig';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TripPoint, LiveLocation, ViewState, MobileTooltip, MapProps, TripPath, Waypoint } from '../types';
import { formatPointsForLayers, calculateCenterFromPoints } from '../utils/mapData';
import { createMapLayers } from './map/MapLayers';
import { createTooltipContent } from './map/MapTooltip';
import MapControls from './map/MapControls';
import MapLegend from './map/MapLegend';
import MobileTooltipComponent from './map/MobileTooltip';
import WaypointCrosshair from './map/WaypointCrosshair';
import WaypointModeControls from './map/WaypointModeControls';
import { useMobileDetection } from '../hooks/useMobileDetection';
import { useTranslation } from 'react-i18next';
import './map/MapStyles.css';

// Get Mapbox token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN';

// A usable Mapbox public token always starts with "pk.". Anything else (missing
// var, leftover placeholder) would still mount a map that can never load a tile,
// so we check up front and skip initialization entirely — see hasValidToken below.
const hasValidToken = MAPBOX_TOKEN.startsWith('pk.');

const INITIAL_VIEW_STATE: ViewState = {
  longitude: 39.61, // East Africa coast (Zanzibar area based on sample data)
  latitude: -4.4,
  zoom: 7,
  pitch: 40,
  bearing: 0
};

const FishersMap: React.FC<MapProps> = ({
  onSelectVessel,
  dateFrom,
  dateTo,
  selectedTripId,
  liveLocations = [],
  centerOnLiveLocations = false,
  onCenterOnLiveLocations,
  onRefresh,
  isRefreshing = false,
  hasTrackingDevice = true,
  deviceLocation,
  onGetMyLocation,
  isGettingLocation = false,
  showNoTripsMessage = false,
  waypoints = [],
  onEnterWaypointMode,
  onToggleWaypoints,
  waypointsCount,
  isWaypointSelectionMode = false,
  onCancelWaypointMode,
  onConfirmWaypointLocation,
  centeredWaypoint
}) => {
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const [tripPoints, setTripPoints] = useState<TripPoint[]>([]);
  const [tripById, setTripById] = useState<Record<string, TripPoint[]>>({});
  // Hover functionality can be added back if needed in the future
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  // Read once per mount: getMapConfig() builds a fresh object on every call, and
  // passing a new object into the render path on each render buys us nothing.
  const mapConfig = useMemo(() => getMapConfig(), []);
  const [mapStyle] = useState(mapConfig.defaultMapStyle);
  // Base map failures (revoked/over-quota token, bad style URL) are otherwise
  // silent: deck.gl keeps drawing overlays over an empty canvas.
  const [basemapError, setBasemapError] = useState<string | null>(
    hasValidToken ? null : 'missingToken'
  );
  const [showActivityGrid, setShowActivityGrid] = useState(false);
  const [showBathymetry, setShowBathymetry] = useState(false);
  const [bathymetryLoading, setBathymetryLoading] = useState(false);
  // Held in state, not a ref: react-map-gl populates the imperative handle from
  // an async import, so it is still null when this component's mount effects
  // run. State makes the effects below re-run once the map actually arrives.
  const [mapInstance, setMapInstance] = useState<MapboxMap | null>(null);

  // Stable identity is required: an inline ref callback is a new function every
  // render, which makes React detach (null) and reattach it on each pass and
  // fire setState twice per render. Memoized, it only runs when the underlying
  // map handle actually changes.
  const handleMapRef = useCallback((ref: MapRef | null) => {
    setMapInstance(ref?.getMap() ?? null);
  }, []);

  // Mobile-friendly tooltip state
  const [mobileTooltip, setMobileTooltip] = useState<MobileTooltip | null>(null);
  const { isMobile } = useMobileDetection();

  // Waypoint selection mode - track map center coordinates
  const [mapCenterCoordinates, setMapCenterCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  // Fetch trip points data for the current user (only if they have tracking device)
  useEffect(() => {
    const loadTripPoints = async () => {
      if (!currentUser) return;

      // Skip loading trip points for users without tracking devices
      if (!hasTrackingDevice) {
        console.log('User has no tracking device, skipping trip points load');
        setTripPoints([]);
        setTripById({});
        return;
      }

      try {
        // Always use the user's IMEIs, regardless of role
        const imeis = currentUser.imeis;

        // Use default date range if none provided (last 7 days)
        const defaultDates = getDateRangeForLastDays(7);
        const effectiveDateFrom = dateFrom || defaultDates.dateFrom;
        const effectiveDateTo = dateTo || defaultDates.dateTo;

        const points = await fetchTripPoints({
          dateFrom: effectiveDateFrom,
          dateTo: effectiveDateTo,
          imeis,
          includeDeviceInfo: true,
          includeLastSeen: true
        });

        console.log(`Loaded ${points.length} trip points`);

        setTripPoints(points);
        const formatted = formatPointsForLayers(points);
        setTripById(formatted);

        // If we have points, adjust the view to focus on them
        if (points.length > 0) {
          const center = calculateCenterFromPoints(points);
          setViewState(prevState => ({
            ...prevState,
            latitude: center.latitude,
            longitude: center.longitude,
            zoom: 10
          }));
        }
      } catch (err) {
        console.error('Error loading trip points:', err);
      }
    };

    loadTripPoints();
  }, [currentUser, dateFrom, dateTo, hasTrackingDevice]);

  // When selectedTripId changes, focus the view on that trip
  useEffect(() => {
    if (selectedTripId && tripById[selectedTripId] && tripById[selectedTripId].length > 0) {
      const tripPoints = tripById[selectedTripId];
      const center = calculateCenterFromPoints(tripPoints);

      // Set a higher zoom level for selected trips to see details better
      const zoomLevel = 11;

      setViewState({
        longitude: center.longitude,
        latitude: center.latitude,
        zoom: zoomLevel,
        pitch: 40,
        bearing: 0
      });
    }
  }, [selectedTripId, tripById]);

  // Filter points based on selectedTripId
  const filteredTripById = selectedTripId
    ? { [selectedTripId]: tripById[selectedTripId] || [] }
    : tripById;

  const filteredTripPoints = selectedTripId
    ? tripPoints.filter(p => p.tripId === selectedTripId)
    : tripPoints;

  // Initialize waypoint coordinates when entering selection mode
  useEffect(() => {
    if (isWaypointSelectionMode) {
      // Set initial coordinates from current viewState
      setMapCenterCoordinates({
        lat: viewState.latitude,
        lng: viewState.longitude
      });
    } else {
      setMapCenterCoordinates(null);
    }
    // Only run when mode changes, not when viewState changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWaypointSelectionMode]);

  // Event handlers
  // Hover handler for map layers
  const handleHover = () => {
    // Currently no-op, hover functionality can be added back if needed
    // This prevents the reference error in createMapLayers
  };

  const handleClick = (info: { object?: TripPoint | LiveLocation | TripPath | Waypoint | undefined; x: number; y: number; coordinate?: [number, number]; }) => {
    // Don't process clicks in waypoint selection mode
    if (isWaypointSelectionMode) {
      return;
    }

    // Handle mobile tooltips
    if (isMobile && info.object) {
      // Show mobile tooltip on tap with a small delay to ensure stability
      setTimeout(() => {
        setMobileTooltip({
          object: info.object || null,
          x: info.x,
          y: info.y,
          visible: true
        });
      }, 10);

    } else if (info.object && onSelectVessel) {
      // Select vessel/trip when clicking on it
      // Check if it's a LiveLocation or TripPoint and handle accordingly
      if ('imei' in info.object && 'lat' in info.object) {
        // It's a LiveLocation
        onSelectVessel(info.object as LiveLocation);
      } else if ('_id' in info.object && 'coordinates' in info.object) {
        // It's a Waypoint - don't select vessel, just show tooltip
        // Do nothing here, tooltip will show
      } else {
        // It's a TripPoint - we can't pass it to onSelectVessel directly
        // so pass null to clear selection
        onSelectVessel(null);
      }
    } else if (!info.object && onSelectVessel) {
      // Clear selection when clicking on empty space
      onSelectVessel(null);
    }
  };

  // Create layers
  const layers = createMapLayers({
    filteredTripPoints,
    filteredTripById,
    selectedTripId,
    showActivityGrid,
    liveLocations,
    deviceLocation,
    waypoints,
    onHover: handleHover,
    onClick: handleClick
  });

  // Function to center map on live locations
  const centerOnLiveLocationsHandler = useCallback(() => {
    if (liveLocations.length > 0) {
      // Calculate center of all live locations
      const totalLat = liveLocations.reduce((sum, loc) => sum + loc.lat, 0);
      const totalLng = liveLocations.reduce((sum, loc) => sum + loc.lng, 0);
      const avgLat = totalLat / liveLocations.length;
      const avgLng = totalLng / liveLocations.length;
      
      setViewState({
        longitude: avgLng,
        latitude: avgLat,
        zoom: 12, // Closer zoom to see live locations clearly
        pitch: 40,
        bearing: 0
      });
    }
  }, [liveLocations]);

  // Center map on live locations when flag is true
  useEffect(() => {
    if (centerOnLiveLocations && liveLocations.length > 0) {
      centerOnLiveLocationsHandler();
    }
  }, [centerOnLiveLocations, liveLocations, centerOnLiveLocationsHandler]);

  // Center map on device location when obtained (for non-PDS users)
  useEffect(() => {
    if (deviceLocation) {
      setViewState({
        longitude: deviceLocation.longitude,
        latitude: deviceLocation.latitude,
        zoom: 11, // Same zoom as live locations
        pitch: 40,
        bearing: 0
      });
    }
  }, [deviceLocation]);

  // Center map on waypoint when requested
  useEffect(() => {
    if (centeredWaypoint) {
      setViewState({
        longitude: centeredWaypoint.lng,
        latitude: centeredWaypoint.lat,
        zoom: 11, // Closer zoom to see waypoint clearly
        pitch: 40,
        bearing: 0
      });
    }
  }, [centeredWaypoint]);

  // Bathymetry layer management with vector tiles
  useEffect(() => {
    const map = mapInstance;
    if (!map || !map.isStyleLoaded()) return;

    const sourceId = 'bathymetry-source';
    const lineLayerId = 'bathymetry-lines';
    const labelLayerId = 'bathymetry-labels';

    // Abandon an in-flight GeoJSON fetch if this effect tears down first,
    // otherwise the resumed closure mutates a map that now belongs elsewhere.
    const abortController = new AbortController();

    const addBathymetryLayers = async () => {
      if (showBathymetry) {
        // Show loading indicator
        setBathymetryLoading(true);

        try {
          // Add GeoJSON source if it doesn't exist
          if (!map.getSource(sourceId)) {
            console.log('Loading bathymetry GeoJSON...');

            // Use fetch with progress for better UX
            const response = await fetch('/bathymetry/bathymetry_contours_wio.geojson', {
              signal: abortController.signal
            });
            const data = await response.json();

            // Re-check after awaiting: another mount may have added the source
            // while this fetch was in flight, and addSource would throw.
            if (abortController.signal.aborted || map.getSource(sourceId)) return;

            map.addSource(sourceId, {
              type: 'geojson',
              data: data,
              // Performance optimizations
              tolerance: 0.375, // Simplify geometry at lower zooms (default is 0.375)
              buffer: 128 // Tile buffer for smooth panning
            });
          }

          // Add line layer if it doesn't exist
          if (!map.getLayer(lineLayerId)) {
            map.addLayer({
              id: lineLayerId,
              type: 'line',
              source: sourceId,
              // No source-layer needed for GeoJSON
              minzoom: 4,
              maxzoom: 22, // Allow rendering at all zooms
              paint: {
                'line-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'depth_m'],
                  0, '#a6cee3',
                  50, '#1f78b4',
                  100, '#3182bd',
                  200, '#08519c',
                  500, '#54278f'
                ],
                'line-width': [
                  'match',
                  ['get', 'depth_m'],
                  [5, 10, 20, 50, 100, 200, 500], 2,
                  1
                ],
                'line-opacity': 0.7
              },
              layout: {
                'line-join': 'round',
                'line-cap': 'round'
              }
            });
          }

          // Add label layer for key depths
          if (!map.getLayer(labelLayerId)) {
            map.addLayer({
              id: labelLayerId,
              type: 'symbol',
              source: sourceId,
              // No source-layer needed for GeoJSON
              minzoom: 8,
              maxzoom: 22, // Allow rendering at all zooms
              filter: [
                'in',
                ['get', 'depth_m'],
                ['literal', [5, 10, 20, 50, 100, 200, 500]]
              ],
              layout: {
                'text-field': ['get', 'depth_label'],
                'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
                'text-size': 12,
                'text-anchor': 'center',
                'symbol-placement': 'line',
                'symbol-spacing': 150,
                'text-padding': 5,
                'text-max-angle': 45,
                'text-allow-overlap': false,
                'text-ignore-placement': false
              },
              paint: {
                'text-color': '#08519c',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2,
                'text-halo-blur': 0.5
              }
            });
          }
        } catch (error) {
          // An aborted fetch is an expected teardown, not a failure
          if ((error as Error)?.name !== 'AbortError') {
            console.error('Error adding bathymetry layers:', error);
          }
        } finally {
          // Hide loading indicator
          setBathymetryLoading(false);
        }
      } else {
        // Remove layers when toggled off (keep data cached)
        if (map.getLayer(labelLayerId)) {
          map.removeLayer(labelLayerId);
        }
        if (map.getLayer(lineLayerId)) {
          map.removeLayer(lineLayerId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
        setBathymetryLoading(false);
      }
    };

    addBathymetryLayers();

    // reuseMaps={true} means the map instance outlives this component: it is
    // pooled on unmount rather than destroyed. Without this cleanup the
    // contours stay attached and the next mount inherits them while its own
    // toggle reads "off" — and every add-guard below short-circuits, so the
    // user cannot clear them.
    return () => {
      abortController.abort();
      if (!map.style) return;
      if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
      if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [showBathymetry, mapInstance]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Add Bootstrap icons CSS for tooltip icons */}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.2/font/bootstrap-icons.min.css" />

      <DeckGL
        viewState={viewState}
        onViewStateChange={(evt) => {
          const newViewState = evt.viewState as ViewState;
          setViewState({
            longitude: newViewState.longitude,
            latitude: newViewState.latitude,
            zoom: newViewState.zoom,
            pitch: newViewState.pitch || 0,
            bearing: newViewState.bearing || 0
          });

          // Update waypoint coordinates in real-time when in selection mode
          if (isWaypointSelectionMode) {
            setMapCenterCoordinates({
              lat: newViewState.latitude,
              lng: newViewState.longitude
            });
          }
        }}
        controller={{
          touchRotate: false,
          scrollZoom: true,
          doubleClickZoom: true,
          keyboard: false
        }}
        layers={layers}
        getTooltip={({object}) => {
          if (!object || isMobile) return null;
          
          const tooltipContent = createTooltipContent({
            object,
            filteredTripById,
            selectedTripId
          });
          
          return tooltipContent ? { html: tooltipContent } : null;
        }}
      >
        {hasValidToken && (
          <Map
            ref={handleMapRef}
            mapStyle={mapStyle}
            mapboxAccessToken={MAPBOX_TOKEN}
            attributionControl={mapConfig.showAttribution}
            trackResize={true}
            // Mapbox bills one "map load" per Map initialization, not per render,
            // pan or zoom. Reusing the instance across mount/unmount (breakpoint
            // switches, route changes) keeps a session at a single billable load.
            // Trade-off: a pooled map is never destroyed, so one WebGL context
            // stays retained for the life of the page.
            reuseMaps={true}
            onLoad={() => {
              // Recovered — drop a warning raised by an earlier failed attempt
              setBasemapError(prev => (prev === 'loadFailed' ? null : prev));
            }}
            onError={(evt) => {
              console.error('Mapbox base map error:', evt.error);
              // mapbox-gl fires `error` for every non-404 tile failure, so an
              // offline vessel or a single 5xx would otherwise latch the banner
              // for the rest of the session. Only auth failures are fatal.
              const status = (evt.error as { status?: number })?.status;
              const isAuthFailure =
                status === 401 ||
                status === 403 ||
                /valid Mapbox access token/i.test(evt.error?.message ?? '');

              if (isAuthFailure) {
                setBasemapError('loadFailed');
              }
            }}
          />
        )}
      </DeckGL>

      {/* Base map unavailable notice — overlays sit on an empty canvas otherwise */}
      {basemapError && (
        <div
          className="alert alert-warning m-0 shadow-sm"
          style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            maxWidth: '90%'
          }}
        >
          <div className="fw-bold">{t('map.basemapUnavailable')}</div>
          <div className="small">
            {basemapError === 'missingToken'
              ? t('map.basemapTokenHint')
              : t('map.basemapRejectedHint')}
          </div>
        </div>
      )}

      {/* Map Controls */}
      <MapControls
        showActivityGrid={showActivityGrid}
        onToggleActivityGrid={setShowActivityGrid}
        selectedTripId={selectedTripId}
        onClearSelection={() => onSelectVessel && onSelectVessel(null)}
        onCenterOnLiveLocations={onCenterOnLiveLocations}
        liveLocationsCount={liveLocations.length}
        showBathymetry={showBathymetry}
        onToggleBathymetry={setShowBathymetry}
        bathymetryLoading={bathymetryLoading}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        hasTrackingDevice={hasTrackingDevice}
        deviceLocation={deviceLocation}
        onGetMyLocation={onGetMyLocation}
        isGettingLocation={isGettingLocation}
        onEnterWaypointMode={onEnterWaypointMode}
        onToggleWaypoints={onToggleWaypoints}
        waypointsCount={waypointsCount}
        isWaypointSelectionMode={isWaypointSelectionMode}
      />

      {/* Bathymetry Loading Indicator */}
      {bathymetryLoading && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            padding: '20px 30px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <div style={{ fontSize: '14px', color: '#495057', fontWeight: 500 }}>
            Loading bathymetry data...
          </div>
        </div>
      )}

      {/* Waypoint Selection Mode UI */}
      {isWaypointSelectionMode && (
        <>
          {/* Semi-transparent overlay to indicate mode */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(32, 107, 196, 0.05)',
              pointerEvents: 'none',
              zIndex: 5
            }}
          />

          {/* Crosshair */}
          <WaypointCrosshair />

          {/* Mode Controls */}
          <WaypointModeControls
            coordinates={mapCenterCoordinates}
            onCancel={onCancelWaypointMode || (() => {})}
            onConfirm={() => {
              if (mapCenterCoordinates && onConfirmWaypointLocation) {
                onConfirmWaypointLocation(mapCenterCoordinates);
              }
            }}
          />
        </>
      )}

      {/* No Trips Message - responsive positioning */}
      {hasTrackingDevice && showNoTripsMessage && (
        <>
          {/* Desktop: top center */}
          <div 
            className="card border-0 shadow-sm d-none d-md-block"
            style={{
              position: 'absolute',
              // Drop below the base map warning when both are on screen
              top: basemapError ? '92px' : '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 100,
              backgroundColor: 'rgba(var(--tblr-body-bg-rgb), 0.7)',
              backdropFilter: 'blur(10px)',
              borderRadius: '8px',
              maxWidth: '320px',
              width: 'auto'
            }}
          >
            <div 
              className="card-body p-2 d-flex align-items-center gap-2"
              style={{ fontSize: '0.875rem', whiteSpace: 'nowrap' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-danger" style={{ flexShrink: 0 }}>
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M12 9v4" />
                <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
                <path d="M12 16h.01" />
              </svg>
              <span className="text-danger">{t('map.noTripsShort')}</span>
            </div>
          </div>

          {/* Mobile: top left */}
          <div 
            className="card border-0 shadow-sm d-md-none"
            style={{
              position: 'absolute',
              // Drop below the base map warning when both are on screen
              top: basemapError ? '92px' : '10px',
              left: '10px',
              zIndex: 100,
              backgroundColor: 'rgba(var(--tblr-body-bg-rgb), 0.7)',
              backdropFilter: 'blur(10px)',
              borderRadius: '8px',
              width: 'auto'
            }}
          >
            <div 
              className="card-body p-2 d-flex align-items-center gap-2"
              style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-danger" style={{ flexShrink: 0 }}>
                <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                <path d="M12 9v4" />
                <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
                <path d="M12 16h.01" />
              </svg>
              <span className="text-danger">{t('map.noTripsShort')}</span>
            </div>
          </div>
        </>
      )}

      {/* Legend */}
      <MapLegend showActivityGrid={showActivityGrid} hasTrackingDevice={hasTrackingDevice} />

      {/* Mobile Tooltip */}
      {mobileTooltip && mobileTooltip.visible && (
        <MobileTooltipComponent
          tooltip={mobileTooltip}
          onClose={() => setMobileTooltip(null)}
          filteredTripById={filteredTripById}
          selectedTripId={selectedTripId}
        />
      )}
    </div>
  );
};

export default FishersMap; 
