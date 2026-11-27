import React from 'react';
import {
  CrosshairIcon,
  FilterXIcon,
  Grid2x2Icon,
  MapPinIcon,
  MapPinnedIcon,
  PlusIcon,
  RefreshCwIcon,
  WavesIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import { GPSCoordinate } from '../../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

interface MapControlsProps {
  showActivityGrid: boolean;
  onToggleActivityGrid: (show: boolean) => void;
  selectedTripId?: string;
  onClearSelection?: () => void;
  onCenterOnLiveLocations?: () => void;
  liveLocationsCount?: number;
  showBathymetry?: boolean;
  onToggleBathymetry?: (show: boolean) => void;
  bathymetryLoading?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  hasTrackingDevice?: boolean;
  deviceLocation?: GPSCoordinate | null;
  onGetMyLocation?: () => void;
  isGettingLocation?: boolean;
  onEnterWaypointMode?: () => void;
  onToggleWaypoints?: () => void;
  waypointsCount?: number;
  isWaypointSelectionMode?: boolean;
}

const MapControls: React.FC<MapControlsProps> = ({
  showActivityGrid,
  onToggleActivityGrid,
  selectedTripId,
  onClearSelection,
  onCenterOnLiveLocations,
  liveLocationsCount = 0,
  showBathymetry = false,
  onToggleBathymetry,
  bathymetryLoading = false,
  onRefresh,
  isRefreshing = false,
  hasTrackingDevice = true,
  onGetMyLocation,
  isGettingLocation = false,
  onEnterWaypointMode,
  onToggleWaypoints,
  isWaypointSelectionMode = false,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Main controls - top right */}
      <div className="absolute top-2.5 right-2.5 z-10 flex flex-col items-end gap-2">
        {/* Trip Tracks / Visit Frequency Toggle */}
        {hasTrackingDevice && (
          <ToggleGroup
            value={[showActivityGrid ? 'grid' : 'tracks']}
            onValueChange={(values) => {
              const next = values[0];
              if (next === 'tracks') onToggleActivityGrid(false);
              if (next === 'grid') onToggleActivityGrid(true);
            }}
            spacing={0}
            variant="outline"
            className="bg-card/90 shadow-md backdrop-blur"
          >
            <ToggleGroupItem value="tracks" title={t('map.tripTracks')} className="h-10 gap-1.5 px-2.5">
              <MapPinnedIcon />
              <span className="hidden lg:inline">{t('map.tripTracks')}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" title={t('common.visitFrequency')} className="h-10 gap-1.5 px-2.5">
              <Grid2x2Icon />
              <span className="hidden lg:inline">{t('common.visitFrequency')}</span>
            </ToggleGroupItem>
          </ToggleGroup>
        )}

        {/* Bathymetry toggle button */}
        {onToggleBathymetry && (
          <Button
            variant={showBathymetry ? 'default' : 'outline'}
            className={cn('h-10 shadow-md', !showBathymetry && 'bg-card/90 backdrop-blur')}
            onClick={() => onToggleBathymetry(!showBathymetry)}
            disabled={bathymetryLoading}
            title={t('map.showBathymetry')}
            aria-label={t('map.bathymetry')}
          >
            {bathymetryLoading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <WavesIcon data-icon="inline-start" />
            )}
            <span className="hidden lg:inline">{t('map.bathymetry')}</span>
          </Button>
        )}

        {/* Waypoints buttons */}
        {(onEnterWaypointMode || onToggleWaypoints) && !isWaypointSelectionMode && (
          <div className="flex gap-1.5">
            <Button
              variant="secondary"
              className="h-10 shadow-md"
              onClick={onToggleWaypoints}
              title={t('waypoints.viewWaypoints')}
              aria-label={t('waypoints.title')}
            >
              <MapPinIcon data-icon="inline-start" />
              <span className="hidden lg:inline">{t('waypoints.title')}</span>
            </Button>
            <Button
              variant="secondary"
              size="icon"
              className="size-10 shadow-md"
              onClick={onEnterWaypointMode}
              title={t('waypoints.addWaypoint')}
              aria-label={t('waypoints.addWaypoint')}
            >
              <PlusIcon />
            </Button>
          </div>
        )}

        {/* Reset filter button */}
        {hasTrackingDevice && selectedTripId && onClearSelection && (
          <Button
            variant="outline"
            className="h-10 bg-card/90 shadow-md backdrop-blur"
            onClick={onClearSelection}
            title={t('common.showAllTrips')}
            aria-label={t('common.showAllTrips')}
          >
            <FilterXIcon data-icon="inline-start" />
            <span className="hidden lg:inline">{t('common.showAllTrips')}</span>
          </Button>
        )}

        {/* Live Location button */}
        {hasTrackingDevice && liveLocationsCount > 0 && onCenterOnLiveLocations && (
          <Button
            variant="destructive"
            className="relative h-10 bg-card/90 shadow-md backdrop-blur"
            onClick={onCenterOnLiveLocations}
            title={t('dashboard.centerOnLiveLocations')}
            aria-label={t('dashboard.centerOnLiveLocations')}
          >
            <CrosshairIcon data-icon="inline-start" />
            <span className="hidden lg:inline">{t('dashboard.liveLocation')}</span>
            {liveLocationsCount > 1 && (
              <Badge
                variant="secondary"
                className="absolute -top-2 -right-2 px-1.5 text-[10px]"
              >
                {liveLocationsCount}
              </Badge>
            )}
          </Button>
        )}

        {/* Get My Location button (non-PDS users) */}
        {!hasTrackingDevice && onGetMyLocation && (
          <Button
            variant="destructive"
            className="h-10 bg-card/90 shadow-md backdrop-blur"
            onClick={onGetMyLocation}
            disabled={isGettingLocation}
            title={t('dashboard.getMyLocation')}
            aria-label={t('dashboard.getMyLocation')}
          >
            {isGettingLocation ? (
              <>
                <Spinner data-icon="inline-start" />
                <span className="hidden lg:inline">{t('dashboard.gettingLocation')}</span>
              </>
            ) : (
              <>
                <CrosshairIcon data-icon="inline-start" />
                <span className="hidden lg:inline">{t('dashboard.myLocation')}</span>
              </>
            )}
          </Button>
        )}
      </div>

      {/* Refresh button - bottom right */}
      {hasTrackingDevice && onRefresh && (
        <div className="absolute right-2.5 bottom-2.5 z-10">
          <Button
            variant={isRefreshing ? 'secondary' : 'default'}
            size="icon"
            className="size-11 shadow-md"
            onClick={onRefresh}
            disabled={isRefreshing}
            title={t('common.refresh')}
            aria-label={t('common.refresh')}
          >
            {isRefreshing ? <Spinner /> : <RefreshCwIcon />}
          </Button>
        </div>
      )}
    </>
  );
};

export default MapControls;
