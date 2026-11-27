import { TripPoint, LiveLocation, GPSCoordinate, Waypoint } from '../../types';
import i18n from '../../i18n';
import {
  formatTime,
  formatSpeed,
  getDirectionFromHeading,
  formatCoordinates,
  formatDuration,
  formatLocationTime,
} from '../../utils/formatters';
import { anonymizeBoatName, anonymizeImei, anonymizeText } from '../../utils/demoData';

interface MapTooltipProps {
  object:
    | TripPoint
    | LiveLocation
    | GPSCoordinate
    | Waypoint
    | { tripId: string; path: number[][]; name?: string }
    | { count: number; position?: [number, number] }
    | null;
  filteredTripById: Record<string, TripPoint[]>;
  selectedTripId?: string;
}

const getWaypointTypeLabel = (type: string): string => {
  switch (type) {
    case 'port':
      return i18n.t('waypoints.types.port');
    case 'anchorage':
      return i18n.t('waypoints.types.anchorage');
    case 'fishing_ground':
      return i18n.t('waypoints.types.fishing_ground');
    case 'favorite_spot':
      return i18n.t('waypoints.types.favorite_spot');
    case 'other':
    default:
      return i18n.t('waypoints.types.other');
  }
};

// Inline Lucide SVG paths so DeckGL HTML tooltips need no external icon font CDN.
const svgIcon = (path: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${path}</svg>`;

const ICONS = {
  pin: svgIcon('<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>'),
  anchor: svgIcon('<path d="M12 22V8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/><circle cx="12" cy="5" r="3"/>'),
  building: svgIcon('<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>'),
  star: svgIcon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  heart: svgIcon('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'),
  grid: svgIcon('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
};

const getWaypointIconSvg = (type: string): string => {
  switch (type) {
    case 'port':
      return ICONS.building;
    case 'anchorage':
      return ICONS.anchor;
    case 'fishing_ground':
      return ICONS.star;
    case 'favorite_spot':
      return ICONS.heart;
    case 'other':
    default:
      return ICONS.pin;
  }
};

export const createTooltipContent = ({
  object,
  filteredTripById,
  selectedTripId,
}: MapTooltipProps): string | null => {
  if (!object) return null;

  // Waypoint tooltip
  if ('_id' in object && 'coordinates' in object && 'type' in object) {
    const waypoint = object as Waypoint;
    const typeLabel = i18n.t('waypoints.tooltips.type');
    const notesLabel = i18n.t('waypoints.tooltips.notes');
    const locationLabel = i18n.t('waypoints.tooltips.location');
    return `
      <div class="tooltip-header">
        ${getWaypointIconSvg(waypoint.type)}
        <span>${waypoint.name}</span>
      </div>
      <div class="tooltip-content">
        <div class="tooltip-row"><span>${typeLabel}:</span> <span class="badge light">${getWaypointTypeLabel(waypoint.type)}</span></div>
        ${waypoint.description ? `<div class="tooltip-row"><span>${notesLabel}:</span> ${waypoint.description}</div>` : ''}
        <div class="tooltip-row"><span>${locationLabel}:</span> ${formatCoordinates(waypoint.coordinates.lat, waypoint.coordinates.lng)}</div>
      </div>
    `;
  }

  // Device location (non-PDS users)
  if ('latitude' in object && 'longitude' in object && 'timestamp' in object) {
    const deviceLoc = object as GPSCoordinate;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timestampDate = deviceLoc.timestamp ? new Date(deviceLoc.timestamp) : null;
    const lastPosition = timestampDate ? formatLocationTime(timestampDate, timezone) : 'Never';

    return `
      <div class="tooltip-header">
        ${ICONS.pin}
        <span>My Location</span>
      </div>
      <div class="tooltip-content">
        <div class="tooltip-row"><span>Coordinates:</span> ${formatCoordinates(deviceLoc.latitude, deviceLoc.longitude)}</div>
        <div class="tooltip-row"><span>Last Position:</span> ${lastPosition}</div>
        ${deviceLoc.accuracy ? `<div class="tooltip-row"><span>Accuracy:</span> <span class="badge light">±${Math.round(deviceLoc.accuracy)}m</span></div>` : ''}
      </div>
    `;
  }

  // Live location (PDS users)
  if ('imei' in object && 'lat' in object && 'lng' in object && object.imei && object.lat && object.lng) {
    const location = object as LiveLocation;
    return `
      <div class="tooltip-header">
        ${ICONS.pin}
        <span>My Location</span>
      </div>
      <div class="tooltip-content">
        <div class="tooltip-row"><span>Vessel:</span> ${anonymizeBoatName(location.boatName || 'Unknown')}</div>
        <div class="tooltip-row"><span>IMEI:</span> ${anonymizeImei(location.imei)}</div>
        <div class="tooltip-row"><span>Coordinates:</span> ${formatCoordinates(location.lat, location.lng)}</div>
        <div class="tooltip-row"><span>Last Position:</span> ${location.lastGpsTs ? formatLocationTime(location.lastGpsTs, location.timezone) : 'Never'}</div>
        ${location.batteryState ? `<div class="tooltip-row"><span>Battery:</span> <span class="badge light">${location.batteryState}</span></div>` : ''}
        ${location.directCustomerName ? `<div class="tooltip-row"><span>Community:</span> ${anonymizeText(location.directCustomerName, 'Demo Community')}</div>` : ''}
      </div>
    `;
  }

  // Grid cell tooltip
  if (object && 'count' in object && !('time' in object)) {
    const gridData = object as { count: number; position?: [number, number] };

    return `
      <div class="tooltip-header">
        ${ICONS.grid}
        <span>Visited Location</span>
      </div>
      <div class="tooltip-content">
        <div class="tooltip-row">
          <span>Times visited:</span> <span class="badge primary">${gridData.count}</span>
        </div>
        <div class="tooltip-row"><span>Cell size:</span> 500×500 meters</div>
        ${selectedTripId ? `<div class="tooltip-row"><span>Trip:</span> ${selectedTripId}</div>` : ''}
      </div>
    `;
  } else if ('tripId' in object && 'path' in object && object.tripId && object.path) {
    const tripData = object as { tripId: string; path: number[][]; name?: string };
    const firstPoint = filteredTripById[tripData.tripId]?.[0];
    const lastPoint = filteredTripById[tripData.tripId]?.[filteredTripById[tripData.tripId]?.length - 1];
    const duration =
      firstPoint && lastPoint
        ? formatDuration(new Date(lastPoint.time).getTime() - new Date(firstPoint.time).getTime())
        : 'Unknown';

    return `
      <div class="tooltip-header">
        ${ICONS.pin}
        <span>${tripData.name || 'Trip'}</span>
      </div>
      <div class="tooltip-content">
        <div class="tooltip-row"><span>Vessel:</span> ${anonymizeBoatName(firstPoint?.boatName || 'Unknown')}</div>
        ${firstPoint ? `<div class="tooltip-row"><span>Started:</span> ${formatTime(new Date(firstPoint.time))}</div>` : ''}
        ${lastPoint ? `<div class="tooltip-row"><span>Ended:</span> ${formatTime(new Date(lastPoint.time))}</div>` : ''}
        <div class="tooltip-row"><span>Duration:</span> ${duration}</div>
      </div>
    `;
  } else if (object && 'time' in object && 'latitude' in object && 'longitude' in object && 'speed' in object) {
    const pointData = object as unknown as TripPoint;
    return `
      <div class="tooltip-header">
        ${ICONS.pin}
        <span>GPS Position</span>
      </div>
      <div class="tooltip-content">
        <div class="tooltip-row"><span>Time:</span> ${formatTime(new Date(pointData.time))}</div>
        <div class="tooltip-row"><span>Speed:</span> <span class="badge light">${formatSpeed(pointData.speed)}</span></div>
        <div class="tooltip-row"><span>Heading:</span> ${pointData.heading.toFixed(0)}° ${getDirectionFromHeading(pointData.heading)}</div>
        <div class="tooltip-row"><span>Vessel:</span> ${anonymizeBoatName(pointData.boatName || 'Unknown')}</div>
        <div class="tooltip-row"><span>Trip ID:</span> ${pointData.tripId || 'Unknown'}</div>
      </div>
    `;
  }

  return null;
};
