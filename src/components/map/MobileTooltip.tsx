import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from 'lucide-react';
import { MobileTooltip as MobileTooltipType, TripPoint, LiveLocation, GPSCoordinate, Waypoint } from '../../types';
import {
  formatTime,
  formatSpeed,
  getDirectionFromHeading,
  formatDuration,
  formatLocationTime,
  formatCoordinates,
} from '../../utils/formatters';
import { anonymizeBoatName, anonymizeImei } from '../../utils/demoData';
import { getWaypointColorHex } from '../../utils/waypointConfig';
import i18n from '../../i18n';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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

interface MobileTooltipProps {
  tooltip: MobileTooltipType;
  onClose: () => void;
  filteredTripById: Record<string, TripPoint[]>;
  selectedTripId?: string;
}

const MobileTooltipComponent: React.FC<MobileTooltipProps> = ({
  tooltip,
  onClose,
  filteredTripById,
  selectedTripId,
}) => {
  const { t } = useTranslation();
  const { object } = tooltip;
  const tooltipRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number>(0);
  const currentY = useRef<number>(0);
  const isDragging = useRef<boolean>(false);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isClosing, setIsClosing] = useState<boolean>(false);

  const handleClose = useCallback(() => {
    isDragging.current = false;
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 250);
  }, [onClose]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        !isDragging.current
      ) {
        handleClose();
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [handleClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startY.current = e.touches[0].clientY;
    currentY.current = startY.current;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    e.stopPropagation();

    currentY.current = e.touches[0].clientY;
    const deltaY = Math.max(0, currentY.current - startY.current);
    const resistance = Math.min(deltaY / 100, 1);
    setDragOffset(deltaY * (1 - resistance * 0.3));
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    e.stopPropagation();

    const deltaY = currentY.current - startY.current;
    isDragging.current = false;

    if (deltaY > 80) {
      handleClose();
    } else {
      setDragOffset(0);
    }
  };

  if (!object) return null;

  const renderDeviceLocationContent = (deviceLoc: GPSCoordinate) => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timestampDate = deviceLoc.timestamp ? new Date(deviceLoc.timestamp) : null;
    const lastPosition = timestampDate ? formatLocationTime(timestampDate, timezone) : 'Never';

    return (
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Coordinates:</span>
          <span className="font-mono font-medium">
            {formatCoordinates(deviceLoc.latitude, deviceLoc.longitude)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-muted-foreground">Last Position: </span>
            <span>{lastPosition}</span>
          </div>
          {deviceLoc.accuracy && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Accuracy:</span>
              <Badge variant="secondary">±{Math.round(deviceLoc.accuracy)}m</Badge>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderLiveLocationContent = (location: LiveLocation) => (
    <div className="flex flex-col gap-2 text-xs">
      <div>
        <div className="text-base font-semibold">
          {anonymizeBoatName(location.boatName || 'Unknown')}
        </div>
        <div className="text-muted-foreground">{anonymizeImei(location.imei)}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">Coordinates:</span>
        <span className="font-mono font-medium">
          {formatCoordinates(location.lat, location.lng)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Battery:</span>
          <Badge variant="secondary">{location.batteryState || 'Unknown'}</Badge>
        </div>
        <div>
          <span className="text-muted-foreground">Last Position: </span>
          <span>
            {location.lastGpsTs ? formatLocationTime(location.lastGpsTs, location.timezone) : 'Never'}
          </span>
        </div>
      </div>
      {location.directCustomerName && (
        <div className="text-muted-foreground">{location.directCustomerName}</div>
      )}
    </div>
  );

  const renderTripContent = (tripData: { tripId: string; path: number[][]; name?: string }) => {
    const tripPoints = filteredTripById[tripData.tripId] || [];
    const firstPoint = tripPoints[0];
    const lastPoint = tripPoints[tripPoints.length - 1];
    const duration =
      firstPoint && lastPoint
        ? formatDuration(new Date(lastPoint.time).getTime() - new Date(firstPoint.time).getTime())
        : 'Unknown';

    return (
      <div className="flex flex-col gap-2 text-xs">
        <div className="text-base font-semibold">
          {anonymizeBoatName(firstPoint?.boatName || 'Unknown')}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="text-muted-foreground">Started: </span>
            <span>{firstPoint ? formatTime(new Date(firstPoint.time)) : 'Unknown'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Duration: </span>
            <span>{duration}</span>
          </div>
        </div>
        {lastPoint && (
          <div className="text-muted-foreground">Ended: {formatTime(new Date(lastPoint.time))}</div>
        )}
      </div>
    );
  };

  const renderPointContent = (point: TripPoint) => (
    <div className="flex flex-col gap-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base font-semibold">{formatTime(new Date(point.time))}</span>
        <span className="text-muted-foreground">
          {anonymizeBoatName(point.boatName || 'Unknown')}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Speed:</span>
          <Badge variant="secondary">{formatSpeed(point.speed)}</Badge>
        </div>
        <div>
          <span className="text-muted-foreground">Heading: </span>
          <span>
            {point.heading.toFixed(0)}° {getDirectionFromHeading(point.heading)}
          </span>
        </div>
      </div>
      <div className="text-muted-foreground">Trip: {point.tripId || 'Unknown'}</div>
    </div>
  );

  const renderGridContent = (gridData: { count: number; position?: [number, number] }) => (
    <div className="flex flex-col gap-1.5 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Times visited:</span>
          <Badge>{gridData.count}</Badge>
        </div>
        <div>
          <span className="text-muted-foreground">Cell size: </span>
          <span>500×500m</span>
        </div>
      </div>
      {selectedTripId && <div className="text-muted-foreground">Trip: {selectedTripId}</div>}
    </div>
  );

  const renderWaypointContent = (waypoint: Waypoint) => (
    <div className="flex flex-col gap-2 text-xs">
      <div className="text-base font-semibold">{waypoint.name}</div>
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{t('waypoints.tooltips.type')}:</span>
        <Badge variant="secondary">{getWaypointTypeLabel(waypoint.type)}</Badge>
      </div>
      {waypoint.description && (
        <div>
          <span className="text-muted-foreground">{t('waypoints.tooltips.notes')}: </span>
          <span>{waypoint.description}</span>
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground">{t('waypoints.tooltips.location')}:</span>
        <span className="font-mono font-medium">
          {formatCoordinates(waypoint.coordinates.lat, waypoint.coordinates.lng)}
        </span>
      </div>
    </div>
  );

  let content: React.ReactNode;
  let headerTitle = '';
  let dotColor = 'var(--primary)';

  if ('_id' in object && 'coordinates' in object && 'type' in object && 'name' in object) {
    const waypoint = object as Waypoint;
    content = renderWaypointContent(waypoint);
    headerTitle = waypoint.name;
    dotColor = getWaypointColorHex(waypoint.type);
  } else if ('latitude' in object && 'longitude' in object && 'timestamp' in object) {
    content = renderDeviceLocationContent(object as GPSCoordinate);
    headerTitle = 'My Location';
    dotColor = 'var(--destructive)';
  } else if (
    'imei' in object &&
    'lat' in object &&
    object.lat !== undefined &&
    object.lat !== null &&
    'lng' in object &&
    object.lng !== undefined &&
    object.lng !== null
  ) {
    content = renderLiveLocationContent(object as LiveLocation);
    headerTitle = 'Live Location';
    dotColor = 'var(--destructive)';
  } else if ('tripId' in object && 'path' in object && object.tripId && object.path) {
    content = renderTripContent(
      object as unknown as { tripId: string; path: number[][]; name?: string }
    );
    headerTitle = 'Fishing Trip';
    dotColor = 'var(--primary)';
  } else if (
    'time' in object &&
    'latitude' in object &&
    'longitude' in object &&
    'speed' in object &&
    object.time
  ) {
    content = renderPointContent(object as unknown as TripPoint);
    headerTitle = 'GPS Position';
    dotColor = 'var(--chart-2)';
  } else if ('count' in object && object.count) {
    content = renderGridContent(object);
    headerTitle = 'Visited Location';
    dotColor = 'var(--primary)';
  } else {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-x-[5%] bottom-0 z-40 max-h-[60vh] overflow-hidden rounded-t-2xl border bg-card/95 text-card-foreground shadow-xl backdrop-blur touch-none"
      style={{
        transform: `translateY(${dragOffset}px) ${isClosing ? 'translateY(100%)' : ''}`,
        transition: isDragging.current
          ? 'none'
          : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-3 pb-2">
        <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 pb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
          <h6 className="text-sm font-semibold">{headerTitle}</h6>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('common.close')}
          onClick={(e) => {
            e.stopPropagation();
            handleClose();
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleClose();
          }}
        >
          <XIcon />
        </Button>
      </div>

      {/* Content */}
      <div className="max-h-[calc(60vh-80px)] overflow-y-auto px-4 py-3">{content}</div>
    </div>
  );
};

export default MobileTooltipComponent;
