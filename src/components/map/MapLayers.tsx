import { PathLayer, ScatterplotLayer, IconLayer } from '@deck.gl/layers';
import { GridLayer } from '@deck.gl/aggregation-layers';
import type { PickingInfo } from '@deck.gl/core';
import { TripPoint, LiveLocation, TripPath, GPSCoordinate, Waypoint, MobileTooltip } from '../../types';
import { petalPink, viridisColorRange } from '../../utils/colors';
import { getWaypointColor } from '../../utils/waypointConfig';

export type MapPickingInfo = PickingInfo<NonNullable<MobileTooltip['object']>>;

interface MapLayersProps {
  filteredTripPoints: TripPoint[];
  filteredTripById: Record<string, TripPoint[]>;
  selectedTripId?: string;
  showActivityGrid: boolean;
  liveLocations: LiveLocation[];
  deviceLocation?: GPSCoordinate | null;
  waypoints?: Waypoint[];
  onHover: (info: MapPickingInfo) => void;
  onClick: (info: MapPickingInfo) => void;
}

export const createMapLayers = ({
  filteredTripPoints,
  filteredTripById,
  selectedTripId,
  showActivityGrid,
  liveLocations,
  deviceLocation,
  waypoints = [],
  onHover,
  onClick
}: MapLayersProps): (PathLayer | ScatterplotLayer | GridLayer | IconLayer)[] => {
  const layers: (PathLayer | ScatterplotLayer | GridLayer | IconLayer)[] = [];

  // Always add the grid layer if activity view is enabled
  if (showActivityGrid) {
    const gridLayer = new GridLayer<TripPoint>({
      id: 'activity-grid',
      data: filteredTripPoints,
      pickable: true,
      extruded: true,
      cellSize: 500,  // Cell size in meters
      elevationScale: 10,
      getPosition: (d: TripPoint) => [d.longitude, d.latitude],
      // Use point count for both color and elevation to represent activity density
      getColorWeight: () => 1,  // Count of points represents activity
      getElevationWeight: () => 1,  // Count of points
      colorScaleType: 'quantize',
      // Viridis-inspired color range
      colorRange: viridisColorRange,
      // Material for 3D lighting
      material: {
        ambient: 0.64,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [51, 51, 51]
      },
      // GridLayer's typings want a boolean back; false means not handled, as before.
      onHover: info => { onHover(info); return false; },
      onClick: info => { onClick(info); return false; }
    });
    
    layers.push(gridLayer);
  }

  // Add trip paths and points layers if not showing only grid or if a specific trip is selected
  if (!showActivityGrid || selectedTripId) {
    // Trip paths using PathLayer
    const pathLayer = new PathLayer({
      id: 'trip-paths',
      data: Object.keys(filteredTripById).map((tripId): TripPath | null => {
        const points = filteredTripById[tripId];
        if (!points || points.length < 2) return null;

        return {
          tripId,
          name: `Trip ${tripId} - ${points[0]?.boatName || 'Vessel'}`,
          path: points.map(p => [p.longitude, p.latitude]),
          color: petalPink,
          width: selectedTripId === tripId ? 4 : 2
        };
      }).filter((item): item is TripPath => item !== null),
      getPath: (d: TripPath) => d.path,
      getColor: (d: TripPath) => d.color,
      getWidth: (d: TripPath) => d.width,
      widthUnits: 'pixels',
      pickable: true,
      jointRounded: true,
      capRounded: true,
      onHover,
      onClick
    });
    
    layers.push(pathLayer);

  }

  // Add live location markers with modern boat-style markers
  if (liveLocations.length > 0) {
    const liveLayer = new ScatterplotLayer({
      id: 'live-locations',
      data: liveLocations,
      getPosition: (d: LiveLocation) => [d.lng, d.lat],
      getFillColor: [194, 9, 90],
      getRadius: 180, // Larger radius for better visibility
      radiusUnits: 'meters',
      pickable: true,
      onHover,
      onClick,
      // Add a stroke for better definition
      stroked: true,
      getLineColor: [255, 255, 255, 255], // White border
      getLineWidth: 2,
      lineWidthUnits: 'pixels'
    });
    layers.push(liveLayer);
  }

  // Add device location marker for non-PDS users
  if (deviceLocation) {
    const deviceLayer = new ScatterplotLayer({
      id: 'device-location',
      data: [deviceLocation],
      getPosition: (d: GPSCoordinate) => [d.longitude, d.latitude],
      getFillColor: [194, 9, 90], // Same red as live locations
      getRadius: 180, // Same size as live locations
      radiusUnits: 'meters',
      pickable: true,
      onHover,
      onClick,
      // Add a stroke for better definition
      stroked: true,
      getLineColor: [255, 255, 255, 255], // White border
      getLineWidth: 2,
      lineWidthUnits: 'pixels'
    });
    layers.push(deviceLayer);
  }

  // Add waypoint markers with enhanced visibility
  if (waypoints.length > 0) {
    // Filter only visible waypoints
    const visibleWaypoints = waypoints.filter(w => w.visible !== false);

    const waypointLayer = new ScatterplotLayer({
      id: 'waypoints',
      data: visibleWaypoints,
      getPosition: (d: Waypoint) => [d.coordinates.lng, d.coordinates.lat],
      getFillColor: (d: Waypoint) => getWaypointColor(d.type),

      // Enhanced zoom-independent sizing
      getRadius: 8, // Base size in pixels (screen space)
      radiusUnits: 'pixels', // Consistent size at all zoom levels
      radiusMinPixels: 6, // Minimum 6px (never too small)
      radiusMaxPixels: 20, // Maximum 20px (never too large)

      pickable: true,
      onHover,
      onClick,

      // Enhanced stroke for better visibility
      stroked: true,
      getLineColor: [255, 255, 255, 255], // White border
      getLineWidth: 2, // Cleaner look with 2px border
      lineWidthUnits: 'pixels',

      // Slightly more opaque for better visibility
      opacity: 0.95,

      // Update triggers for dynamic updates
      updateTriggers: {
        getFillColor: visibleWaypoints.map(w => w.type),
        getRadius: visibleWaypoints.map(w => w.visible)
      }
    });
    layers.push(waypointLayer);
  }

  return layers;
}; 
