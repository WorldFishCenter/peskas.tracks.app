import React from 'react';
import { IconMapPins, IconGridDots, IconFilterOff, IconMathMaxMin, IconRefresh, IconCurrentLocation, IconMapPin } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { GPSCoordinate } from '../../types';

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
  isWaypointSelectionMode = false
}) => {
  const { t } = useTranslation();

  return (
    <>
      {/* Main controls - top right */}
      <div className="position-absolute" style={{ top: '10px', right: '10px', zIndex: 100 }}>
        <div className="d-flex flex-column gap-2">
          {/* Activity Grid Toggle Button with integrated indicator - only for tracking devices */}
          {hasTrackingDevice && (
            <div className="btn-group" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              <button
                className={`btn ${showActivityGrid ? 'btn-outline-light' : 'btn-primary'}`}
                onClick={() => onToggleActivityGrid(false)}
                disabled={!showActivityGrid}
                title={t('map.tripTracks')}
                style={{
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  opacity: showActivityGrid ? 0.7 : 1,
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  minHeight: '44px'
                }}
              >
                <IconMapPins size={20} stroke={1.5} />
                <span className="d-none d-lg-inline">{t('map.tripTracks')}</span>
              </button>
              <button
                className={`btn ${!showActivityGrid ? 'btn-outline-light' : 'btn-primary'}`}
                onClick={() => onToggleActivityGrid(true)}
                disabled={showActivityGrid}
                title={t('common.visitFrequency')}
                style={{
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  opacity: !showActivityGrid ? 0.7 : 1,
                  padding: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  minHeight: '44px'
                }}
              >
                <IconGridDots size={20} stroke={1.5} />
                <span className="d-none d-lg-inline">{t('common.visitFrequency')}</span>
              </button>
            </div>
          )}

          {/* Bathymetry toggle button */}
          {onToggleBathymetry && (
            <button
              className={`btn ${showBathymetry ? 'btn-primary' : 'btn-light'}`}
              onClick={() => onToggleBathymetry(!showBathymetry)}
              disabled={bathymetryLoading}
              title={t('map.showBathymetry')}
              aria-label={t('map.bathymetry')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                minHeight: '44px',
                position: 'relative',
                opacity: window.innerWidth < 768 ? 0.85 : 1
              }}
            >
              {bathymetryLoading ? (
                <div className="spinner-border spinner-border-sm" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
              ) : (
                <IconMathMaxMin size={20} stroke={1.5} />
              )}
              <span className="d-none d-lg-inline">{t('map.bathymetry')}</span>
              {/* <span className="badge bg-yellow text-dark position-absolute top-0 rounded-pill" style={{ fontSize: '0.65rem', right: '-1px', transform: 'translateY(-50%)' }}>
                NEW
              </span> */}
            </button>
          )}

          {/* Waypoints buttons - hide when in selection mode */}
          {(onEnterWaypointMode || onToggleWaypoints) && !isWaypointSelectionMode && (
            <div className="d-flex gap-2" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }}>
              <button
                className="btn btn-success"
                onClick={onToggleWaypoints}
                title={t('waypoints.viewWaypoints')}
                aria-label={t('waypoints.title')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  minHeight: '44px',
                  opacity: window.innerWidth < 768 ? 0.85 : 1
                }}
              >
                <IconMapPin size={20} stroke={1.5} />
                <span className="d-none d-lg-inline">{t('waypoints.title')}</span>
              </button>
              <button
                className="btn btn-success"
                onClick={onEnterWaypointMode}
                title={t('waypoints.addWaypoint')}
                aria-label={t('waypoints.addWaypoint')}
                style={{
                  padding: '0.5rem',
                  minHeight: '44px',
                  opacity: window.innerWidth < 768 ? 0.85 : 1
                }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path stroke="none" d="M0 0h24v24H0z" fill="none" />
                  <path d="M12 5l0 14" />
                  <path d="M5 12l14 0" />
                </svg>
              </button>
            </div>
          )}

          {/* Reset filter button - only show when a trip is selected and has tracking device */}
          {hasTrackingDevice && selectedTripId && onClearSelection && (
            <button
              className="btn btn-light"
              onClick={onClearSelection}
              title={t('common.showAllTrips')}
              aria-label={t('common.showAllTrips')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                minHeight: '44px'
              }}
            >
              <IconFilterOff size={20} stroke={1.5} />
              <span className="d-none d-lg-inline">{t('common.showAllTrips')}</span>
            </button>
          )}

          {/* Live Location button - only show when there are live locations and has tracking device */}
          {hasTrackingDevice && liveLocationsCount > 0 && onCenterOnLiveLocations && (
            <button
              className="btn btn-danger"
              onClick={onCenterOnLiveLocations}
              title={t('dashboard.centerOnLiveLocations')}
              aria-label={t('dashboard.centerOnLiveLocations')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                minHeight: '44px',
                position: 'relative',
                opacity: window.innerWidth < 768 ? 0.85 : 1
              }}
            >
              <IconCurrentLocation size={20} stroke={1.5} />
              <span className="d-none d-lg-inline">{t('dashboard.liveLocation')}</span>
              {liveLocationsCount > 1 && (
                <span className="badge bg-light text-dark position-absolute top-0 end-0" style={{ fontSize: '0.65rem', transform: 'translate(25%, -25%)' }}>
                  {liveLocationsCount}
                </span>
              )}
            </button>
          )}

          {/* Get My Location button - only show for non-PDS users */}
          {!hasTrackingDevice && onGetMyLocation && (
            <button
              className="btn btn-danger"
              onClick={onGetMyLocation}
              disabled={isGettingLocation}
              title={t('dashboard.getMyLocation')}
              aria-label={t('dashboard.getMyLocation')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                minHeight: '44px',
                position: 'relative',
                opacity: window.innerWidth < 768 ? 0.85 : 1
              }}
            >
              {isGettingLocation ? (
                <>
                  <div className="spinner-border spinner-border-sm" role="status">
                    <span className="visually-hidden">{t('common.loading')}</span>
                  </div>
                  <span className="d-none d-lg-inline">{t('dashboard.gettingLocation')}</span>
                </>
              ) : (
                <>
                  <IconCurrentLocation size={20} stroke={1.5} />
                  <span className="d-none d-lg-inline">{t('dashboard.myLocation')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Refresh button - bottom right, compact - only for tracking devices */}
      {hasTrackingDevice && onRefresh && (
        <div className="position-absolute" style={{ bottom: '10px', right: '10px', zIndex: 100 }}>
          <button
            className={`btn ${isRefreshing ? 'btn-secondary' : 'btn-cyan'}`}
            onClick={onRefresh}
            disabled={isRefreshing}
            title={t('common.refresh')}
            aria-label={t('common.refresh')}
            style={{
              width: '44px',
              height: '44px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              borderRadius: '8px'
            }}
          >
            {isRefreshing ? (
              <div className="spinner-border spinner-border-sm" role="status">
                <span className="visually-hidden">{t('common.loading')}</span>
              </div>
            ) : (
              <IconRefresh size={22} stroke={2} />
            )}
          </button>
        </div>
      )}
    </>
  );
};

export default MapControls; 