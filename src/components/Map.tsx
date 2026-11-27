import React, { useState, useEffect, useCallback } from 'react';
import Map, { type MapRef } from 'react-map-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import DeckGL from '@deck.gl/react';
import { AlertTriangleIcon } from 'lucide-react';
import { calculateCenterFromPoints } from '../api/pelagicDataService';
import { MAP_STYLE, SHOW_ATTRIBUTION } from '../config/mapConfig';
import 'mapbox-gl/dist/mapbox-gl.css';
import { LiveLocation, ViewState, MobileTooltip, MapProps } from '../types';
import { createMapLayers, type MapPickingInfo } from './map/MapLayers';
import { createTooltipContent } from './map/MapTooltip';
import MapControls from './map/MapControls';
import MapLegend from './map/MapLegend';
import MobileTooltipComponent from './map/MobileTooltip';
import WaypointCrosshair from './map/WaypointCrosshair';
import WaypointModeControls from './map/WaypointModeControls';
import { useMobileDetection } from '../hooks/useMobileDetection';
import { useTranslation } from 'react-i18next';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

// Get Mapbox token from environment variables
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'YOUR_MAPBOX_TOKEN';

// A usable Mapbox public token always starts with "pk.".
const hasValidToken = MAPBOX_TOKEN.startsWith('pk.');

const INITIAL_VIEW_STATE: ViewState = {
  longitude: 39.61,
  latitude: -4.4,
  zoom: 7,
  pitch: 40,
  bearing: 0,
};

const EMPTY_TRIP_BY_ID: Record<string, never[]> = {};

const FishersMap: React.FC<MapProps> = ({
  onSelectVessel,
  tripPoints = [],
  tripById = EMPTY_TRIP_BY_ID,
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
  centeredWaypoint,
}) => {
  const { t } = useTranslation();
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [tokenRejected, setTokenRejected] = useState(false);
  const basemapUnavailable = !hasValidToken || tokenRejected;
  const [showActivityGrid, setShowActivityGrid] = useState(false);
  const [showBathymetry, setShowBathymetry] = useState(false);
  const [bathymetryLoading, setBathymetryLoading] = useState(false);
  // Held in state, not a ref: react-map-gl populates the imperative handle from
  // an async import, so it is still null when this component's mount effects
  // run. State makes the effects below re-run once the map actually arrives.
  const [mapInstance, setMapInstance] = useState<MapboxMap | null>(null);

  // Stable identity: an inline ref callback would detach and reattach on every
  // render, firing setState twice each pass.
  const handleMapRef = useCallback((ref: MapRef | null) => {
    setMapInstance(ref?.getMap() ?? null);
  }, []);

  const handleMapLoad = useCallback(() => setTokenRejected(false), []);

  const handleMapError = useCallback((evt: { error: Error }) => {
    console.error('Mapbox base map error:', evt.error);
    // mapbox-gl fires `error` for every non-404 tile failure, so an offline
    // vessel or a single 5xx would otherwise latch the banner for the rest of
    // the session. Only auth failures are fatal.
    const status = (evt.error as { status?: number })?.status;
    const isAuthFailure =
      status === 401 ||
      status === 403 ||
      /valid Mapbox access token/i.test(evt.error?.message ?? '');

    if (isAuthFailure) {
      setTokenRejected(true);
    }
  }, []);

  // Top-anchored notices drop below the base map warning when it is on screen.
  // 92px clears the two-line banner at its usual width.
  const noticeTop = basemapUnavailable ? '92px' : '10px';

  const [mobileTooltip, setMobileTooltip] = useState<MobileTooltip | null>(null);
  const isMobile = useMobileDetection();

  const [mapCenterCoordinates, setMapCenterCoordinates] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (tripPoints.length > 0 && !selectedTripId) {
      const center = calculateCenterFromPoints(tripPoints);
      setViewState((prevState) => ({
        ...prevState,
        latitude: center.latitude,
        longitude: center.longitude,
        zoom: 10,
      }));
    }
  }, [tripPoints, selectedTripId]);

  useEffect(() => {
    if (selectedTripId && tripById[selectedTripId] && tripById[selectedTripId].length > 0) {
      const selectedPoints = tripById[selectedTripId];
      const center = calculateCenterFromPoints(selectedPoints);

      setViewState({
        longitude: center.longitude,
        latitude: center.latitude,
        zoom: 11,
        pitch: 40,
        bearing: 0,
      });
    }
  }, [selectedTripId, tripById]);

  const filteredTripById = selectedTripId
    ? { [selectedTripId]: tripById[selectedTripId] || [] }
    : tripById;

  const filteredTripPoints = selectedTripId
    ? tripPoints.filter((p) => p.tripId === selectedTripId)
    : tripPoints;

  useEffect(() => {
    if (isWaypointSelectionMode) {
      setMapCenterCoordinates({
        lat: viewState.latitude,
        lng: viewState.longitude,
      });
    } else {
      setMapCenterCoordinates(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWaypointSelectionMode]);

  const handleHover = () => {};

  const handleClick = (info: MapPickingInfo) => {
    if (isWaypointSelectionMode) return;

    if (isMobile && info.object) {
      setTimeout(() => {
        setMobileTooltip({
          object: info.object || null,
          x: info.x,
          y: info.y,
          visible: true,
        });
      }, 10);
    } else if (info.object && onSelectVessel) {
      if ('imei' in info.object && 'lat' in info.object) {
        onSelectVessel(info.object as LiveLocation);
      } else if ('_id' in info.object && 'coordinates' in info.object) {
        // Waypoint click handled by tooltip
      } else {
        onSelectVessel(null);
      }
    } else if (!info.object && onSelectVessel) {
      onSelectVessel(null);
    }
  };

  const layers = createMapLayers({
    filteredTripPoints,
    filteredTripById,
    selectedTripId,
    showActivityGrid,
    liveLocations,
    deviceLocation,
    waypoints,
    onHover: handleHover,
    onClick: handleClick,
  });

  const centerOnLiveLocationsHandler = useCallback(() => {
    if (liveLocations.length > 0) {
      const totalLat = liveLocations.reduce((sum, loc) => sum + loc.lat, 0);
      const totalLng = liveLocations.reduce((sum, loc) => sum + loc.lng, 0);
      setViewState({
        longitude: totalLng / liveLocations.length,
        latitude: totalLat / liveLocations.length,
        zoom: 12,
        pitch: 40,
        bearing: 0,
      });
    }
  }, [liveLocations]);

  useEffect(() => {
    if (centerOnLiveLocations && liveLocations.length > 0) {
      centerOnLiveLocationsHandler();
    }
  }, [centerOnLiveLocations, liveLocations, centerOnLiveLocationsHandler]);

  useEffect(() => {
    if (deviceLocation) {
      setViewState({
        longitude: deviceLocation.longitude,
        latitude: deviceLocation.latitude,
        zoom: 11,
        pitch: 40,
        bearing: 0,
      });
    }
  }, [deviceLocation]);

  useEffect(() => {
    if (centeredWaypoint) {
      setViewState({
        longitude: centeredWaypoint.lng,
        latitude: centeredWaypoint.lat,
        zoom: 11,
        pitch: 40,
        bearing: 0,
      });
    }
  }, [centeredWaypoint]);

  useEffect(() => {
    const map = mapInstance;
    if (!map || !map.isStyleLoaded()) return;

    const sourceId = 'bathymetry-source';
    const lineLayerId = 'bathymetry-lines';
    const labelLayerId = 'bathymetry-labels';

    const abortController = new AbortController();

    const addBathymetryLayers = async () => {
      if (showBathymetry) {
        setBathymetryLoading(true);

        try {
          if (!map.getSource(sourceId)) {
            const response = await fetch('/bathymetry/bathymetry_contours_wio.geojson', {
              signal: abortController.signal,
            });
            const data = await response.json();

            if (abortController.signal.aborted || map.getSource(sourceId)) return;

            map.addSource(sourceId, {
              type: 'geojson',
              data,
              tolerance: 0.375,
              buffer: 128,
            });
          }

          if (!map.getLayer(lineLayerId)) {
            map.addLayer({
              id: lineLayerId,
              type: 'line',
              source: sourceId,
              minzoom: 4,
              maxzoom: 22,
              paint: {
                'line-color': [
                  'interpolate',
                  ['linear'],
                  ['get', 'depth_m'],
                  0,
                  '#a6cee3',
                  50,
                  '#1f78b4',
                  100,
                  '#3182bd',
                  200,
                  '#08519c',
                  500,
                  '#54278f',
                ],
                'line-width': ['match', ['get', 'depth_m'], [5, 10, 20, 50, 100, 200, 500], 2, 1],
                'line-opacity': 0.7,
              },
              layout: {
                'line-join': 'round',
                'line-cap': 'round',
              },
            });
          }

          if (!map.getLayer(labelLayerId)) {
            map.addLayer({
              id: labelLayerId,
              type: 'symbol',
              source: sourceId,
              minzoom: 8,
              maxzoom: 22,
              filter: ['in', ['get', 'depth_m'], ['literal', [5, 10, 20, 50, 100, 200, 500]]],
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
                'text-ignore-placement': false,
              },
              paint: {
                'text-color': '#08519c',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2,
                'text-halo-blur': 0.5,
              },
            });
          }
        } catch (error) {
          if ((error as Error)?.name !== 'AbortError') {
            console.error('Error adding bathymetry layers:', error);
          }
        } finally {
          setBathymetryLoading(false);
        }
      } else {
        if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId);
        if (map.getLayer(lineLayerId)) map.removeLayer(lineLayerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
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
    <div className="relative size-full">
      <DeckGL
        viewState={viewState}
        onViewStateChange={(evt) => {
          // Ignore DeckGL replay events that carry no interaction or transition flag.
          const { isDragging, isPanning, isRotating, isZooming, inTransition } =
            evt.interactionState;
          if (!isDragging && !isPanning && !isRotating && !isZooming && !inTransition) {
            return;
          }

          const newViewState = evt.viewState as ViewState;
          setViewState({
            longitude: newViewState.longitude,
            latitude: newViewState.latitude,
            zoom: newViewState.zoom,
            pitch: newViewState.pitch || 0,
            bearing: newViewState.bearing || 0,
          });

          if (isWaypointSelectionMode) {
            setMapCenterCoordinates({
              lat: newViewState.latitude,
              lng: newViewState.longitude,
            });
          }
        }}
        controller={{
          touchRotate: false,
          scrollZoom: true,
          doubleClickZoom: true,
          keyboard: false,
        }}
        layers={layers}
        getTooltip={({ object }) => {
          if (!object || isMobile) return null;

          const tooltipContent = createTooltipContent({
            object,
            filteredTripById,
            selectedTripId,
          });

          return tooltipContent ? { html: tooltipContent } : null;
        }}
      >
        {hasValidToken && (
          <Map
            ref={handleMapRef}
            mapStyle={MAP_STYLE}
            mapboxAccessToken={MAPBOX_TOKEN}
            attributionControl={SHOW_ATTRIBUTION}
            trackResize={true}
            // Mapbox bills one "map load" per Map initialization, not per render,
            // pan or zoom. Reusing the instance across mount/unmount (breakpoint
            // switches, route changes) keeps a session at a single billable load.
            // Trade-off: a pooled map is never destroyed, so one WebGL context
            // stays retained for the life of the page.
            reuseMaps={true}
            onLoad={handleMapLoad}
            onError={handleMapError}
          />
        )}
      </DeckGL>

      {/* Base map unavailable notice — overlays sit on an empty canvas otherwise */}
      {basemapUnavailable && (
        <div className="absolute top-2.5 left-1/2 z-10 w-max max-w-[90%] -translate-x-1/2">
          <Alert variant="destructive" className="bg-card/95 shadow-md backdrop-blur">
            <AlertTriangleIcon />
            <AlertTitle>{t('map.basemapUnavailable')}</AlertTitle>
            <AlertDescription>
              {hasValidToken ? t('map.basemapRejectedHint') : t('map.basemapTokenHint')}
            </AlertDescription>
          </Alert>
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
        <div className="absolute top-1/2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 rounded-xl border bg-card/95 px-6 py-4 shadow-md backdrop-blur">
          <Spinner className="size-5 text-primary" />
          <span className="text-sm font-medium text-foreground">Loading bathymetry data...</span>
        </div>
      )}

      {/* Waypoint Selection Mode UI */}
      {isWaypointSelectionMode && (
        <>
          <div className="pointer-events-none absolute inset-0 z-[5] bg-primary/5" />
          <WaypointCrosshair />
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

      {/* No Trips Message */}
      {hasTrackingDevice && showNoTripsMessage && (
        <div
          className="absolute left-2.5 z-10 flex items-center gap-2 rounded-lg border bg-card/85 px-3 py-1.5 text-xs font-medium text-destructive shadow-sm backdrop-blur md:left-1/2 md:-translate-x-1/2 md:text-sm"
          style={{ top: noticeTop }}
        >
          <AlertTriangleIcon className="size-4 shrink-0" />
          <span className="whitespace-nowrap">{t('map.noTripsShort')}</span>
        </div>
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
