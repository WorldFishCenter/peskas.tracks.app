import React, { useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import DateRangeSelector from '../components/DateRangeSelector';
import TripsTable from '../components/TripsTable';
import { IconCalendarStats, IconFish } from '@tabler/icons-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { subDays, differenceInDays } from 'date-fns';
import { Trip, LiveLocation, GPSCoordinate, Waypoint, WaypointFormData } from '../types';
import { calculateVesselInsights } from '../utils/calculations';
import { formatDisplayDate } from '../utils/formatters';
import { renderNoImeiDataMessage } from '../utils/userInfo';
import { useTripData } from '../hooks/useTripData';
import { useLiveLocations } from '../hooks/useLiveLocations';
import { useVesselSelection } from '../hooks/useVesselSelection';
import { useWaypoints } from '../hooks/useWaypoints';
import { useIsDesktopLayout } from '../hooks/useIsDesktopLayout';
import VesselDetailsPanel from '../components/dashboard/VesselDetailsPanel';
import VesselInsightsPanel from '../components/dashboard/VesselInsightsPanel';
import { clearCache } from '../api/pelagicDataService';
import { getCurrentGPSCoordinate } from '../utils/gpsUtils';

import MapContainer from '../components/dashboard/MapContainer';
import TripSelectionModal from '../components/TripSelectionModal';
import ReportCatchForm from '../components/ReportCatchForm';
import ReportCatchFooter from '../components/ReportCatchFooter';
import BoatSelectionModal from '../components/BoatSelectionModal';
import WaypointsModal from '../components/waypoints/WaypointsModal';

const Dashboard: React.FC = () => {
  const { currentUser, updateUserImeis } = useAuth();
  const { t } = useTranslation();
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 7));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [centerMapOnLiveLocations, setCenterMapOnLiveLocations] = useState(false);
  const [isViewingLiveLocations, setIsViewingLiveLocations] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Device location state (for non-PDS users)
  const [deviceLocation, setDeviceLocation] = useState<GPSCoordinate | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Check if user has tracking device (PDS)
  // A user has a tracking device if:
  // 1. hasImei is explicitly true, OR
  // 2. hasImei is not explicitly false AND they have at least one IMEI
  const hasTrackingDevice = currentUser?.hasImei === true ||
                            (currentUser?.hasImei !== false && (currentUser?.imeis?.length ?? 0) > 0);

  // Catch reporting state
  const [showTripSelection, setShowTripSelection] = useState(false);
  const [selectedTripForCatch, setSelectedTripForCatch] = useState<Trip | null>(null);

  // Admin vessel selection state
  const [showBoatSelection, setShowBoatSelection] = useState(false);

  // Waypoints state and hooks
  const {
    waypoints,
    visibleWaypoints,
    addWaypoint,
    removeWaypoint,
    toggleWaypointVisibility,
    toggleAllWaypoints
  } = useWaypoints();
  const [showWaypointsModal, setShowWaypointsModal] = useState(false);
  const [selectedMapCoordinates, setSelectedMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isWaypointSelectionMode, setIsWaypointSelectionMode] = useState(false);
  const [centeredWaypoint, setCenteredWaypoint] = useState<{ lat: number; lng: number } | null>(null);

  // Custom hooks for data management
  const {
    trips,
    tripPoints,
    loading,
    dataAvailable,
    errorMessage,
    refetch: refetchTripData
  } = useTripData(dateFrom, dateTo);

  const {
    liveLocations
  } = useLiveLocations();

  const {
    selectedTripId,
    handleSelectVessel: originalHandleSelectVessel,
    handleSelectTrip: originalHandleSelectTrip,
    clearSelection
  } = useVesselSelection(trips, tripPoints, liveLocations);

  // The mobile and desktop layouts are both mounted and toggled with CSS. The
  // map must render in only one of them: each Mapbox instance is a billable map
  // load, so rendering both doubles the cost for a map the user never sees.
  const isDesktopLayout = useIsDesktopLayout();

  // Wrapper for handleSelectVessel that also resets live location view
  const handleSelectVessel = (vessel: LiveLocation | null) => {
    const mappedVessel = vessel ? {
      id: vessel.imei,
      name: vessel.boatName
    } : null;
    originalHandleSelectVessel(mappedVessel);
    setIsViewingLiveLocations(false);
  };

  // Wrapper for handleSelectTrip that also resets live location view and scrolls to map
  const handleSelectTrip = (tripId: string) => {
    originalHandleSelectTrip(tripId);
    setIsViewingLiveLocations(false);

    // Scroll to map on mobile devices after a short delay to allow state to update
    setTimeout(() => {
      const mapElement = document.querySelector('[data-map-container]');
      if (mapElement) {
        mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Manual refresh handler - clears cache and refetches data
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      clearCache();
      await refetchTripData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Admin vessel selection handlers
  const handleShowBoatSelection = () => {
    setShowBoatSelection(true);
  };

  const handleBoatSelect = (imei: string) => {
    // For admin users, update their IMEIs to include the selected vessel
    if (currentUser && currentUser.role === 'admin') {
      updateUserImeis([imei]);
    }
    setShowBoatSelection(false);
  };

  const handleCloseBoatSelection = () => {
    setShowBoatSelection(false);
  };

  const handleDateChange = (newDateFrom: Date, newDateTo: Date) => {
    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
    // Reset selection when date range changes
    clearSelection();
    // Reset live location view when user changes date range
    setIsViewingLiveLocations(false);
  };


  // Function to center map on live locations (PDS users)
  const centerOnLiveLocations = () => {
    if (liveLocations.length > 0) {
      setCenterMapOnLiveLocations(true);
      setIsViewingLiveLocations(true);
      // Clear trip selection when viewing live locations
      clearSelection();
      // Reset the flag after a short delay
      setTimeout(() => setCenterMapOnLiveLocations(false), 100);
    }
  };

  // Function to get and center on device location (non-PDS users)
  const getMyLocation = async () => {
    if (isGettingLocation) return;

    setIsGettingLocation(true);
    setLocationError(null); // Clear any previous errors

    try {
      const result = await getCurrentGPSCoordinate();
      if (result.coordinate) {
        setDeviceLocation(result.coordinate);
        setIsViewingLiveLocations(true);
        clearSelection();
        console.log('✅ Device location obtained:', result.coordinate);
      } else if (result.error) {
        // Set error message using translation key
        setLocationError(result.error.message);
        console.warn('⚠️ Could not get device location:', result.error.code);
      }
    } catch (error) {
      console.error('Error getting device location:', error);
      setLocationError('gps.unknownError');
    } finally {
      setIsGettingLocation(false);
    }
  };

  // Catch reporting handlers
  const handleReportCatchClick = () => {
    // For non-PDS users, skip trip selection and go directly to catch form
    if (currentUser?.hasImei === false) {
      // Create a placeholder trip for direct catch reporting
      const placeholderTrip: Trip = {
        id: `standalone_${Date.now()}`,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        boat: currentUser?.name || '',
        boatName: currentUser?.name || 'Direct Catch',
        community: currentUser?.community || currentUser?.name || 'Unknown',
        durationSeconds: 0,
        rangeMeters: 0,
        distanceMeters: 0,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        imei: ''
      };
      setSelectedTripForCatch(placeholderTrip);
    } else {
      // For PDS users, show trip selection modal
      setShowTripSelection(true);
    }
  };

  const handleTripSelectionClose = () => {
    setShowTripSelection(false);
  };

  const handleTripSelect = (trip: Trip) => {
    setSelectedTripForCatch(trip);
    setShowTripSelection(false);
  };

  const handleCatchFormClose = () => {
    setSelectedTripForCatch(null);
  };

  const handleCatchFormSuccess = () => {
    setSelectedTripForCatch(null);
  };

  // Waypoint handlers
  const handleEnterWaypointMode = () => {
    setIsWaypointSelectionMode(true);
  };

  const handleCancelWaypointMode = () => {
    setIsWaypointSelectionMode(false);
  };

  const handleConfirmWaypointLocation = (coordinates: { lat: number; lng: number }) => {
    // Store coordinates, exit selection mode, and open modal
    setSelectedMapCoordinates(coordinates);
    setIsWaypointSelectionMode(false);
    setShowWaypointsModal(true);
  };

  const handleToggleWaypointsModal = () => {
    // If not in selection mode, just toggle the modal
    if (!isWaypointSelectionMode) {
      setShowWaypointsModal(!showWaypointsModal);
    }
  };

  const handleWaypointSave = async (formData: WaypointFormData) => {
    try {
      await addWaypoint(formData);
      // Don't close modal - user might want to add more waypoints
      setSelectedMapCoordinates(null);
    } catch (err) {
      console.error('Error saving waypoint:', err);
      throw err;
    }
  };

  const handleWaypointDelete = async (waypointId: string) => {
    try {
      await removeWaypoint(waypointId);
    } catch (err) {
      console.error('Error deleting waypoint:', err);
      throw err;
    }
  };

  const handleWaypointModalClose = () => {
    setShowWaypointsModal(false);
    setSelectedMapCoordinates(null);
  };

  const handleShowWaypointOnMap = (waypoint: Waypoint) => {
    // If waypoint is hidden, make it visible
    if (waypoint.visible === false && waypoint._id) {
      toggleWaypointVisibility(waypoint._id);
    }

    // Center map on the waypoint coordinates
    setCenteredWaypoint({ lat: waypoint.coordinates.lat, lng: waypoint.coordinates.lng });
    // Close the modal to show the map
    setShowWaypointsModal(false);
    // Clear trip selection to focus on waypoint
    clearSelection();
    // Reset after a short delay
    setTimeout(() => setCenteredWaypoint(null), 100);
  };

  // Calculate trip statistics for vessel insights
  const insights = calculateVesselInsights(tripPoints);

  // Create the page header
  const pageHeader = (
    <div className="page-header d-print-none">
      <div className="container-xl">
        {hasTrackingDevice && (
          <div className="page-pretitle text-secondary fs-sm">
            {t('dashboard.dateRange', {
              from: formatDisplayDate(dateFrom),
              to: formatDisplayDate(dateTo),
              days: differenceInDays(dateTo, dateFrom) + 1
            })}
          </div>
        )}
        <h2 className="page-title mb-0 mt-0">
          {hasTrackingDevice ? t('dashboard.title') : t('dashboard.titleNonPds')}
        </h2>
      </div>
    </div>
  );

  // Create the sticky footer (mobile only)
  const stickyFooter = (
    <div className="d-md-none">
      <ReportCatchFooter onReportCatchClick={handleReportCatchClick} />
    </div>
  );

  return (
    <MainLayout pageHeader={pageHeader} stickyFooter={stickyFooter}>
      <div className="row g-2">
        {/* Mobile-first order */}
        <div className="col-12">

          {/* 2. Date Range Selector - Second on mobile (PDS users only) */}
          {hasTrackingDevice && (
            <div className="card mb-2 d-md-none">
              <div className="card-body p-2">
                <div className="d-flex align-items-center mb-2">
                  <IconCalendarStats className="icon me-2 text-primary" />
                  <h3 className="card-title m-0">{t('common.dateRange')}</h3>
                </div>

                <DateRangeSelector
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateChange={handleDateChange}
                />
              </div>
            </div>
          )}

          {/* 1. Map - First on mobile, stays in right column on desktop */}
          <div className="d-md-none mb-2" data-map-container>
            {!isDesktopLayout && (
            <MapContainer
              loading={loading}
              errorMessage={errorMessage}
              dataAvailable={dataAvailable}
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedTripId={selectedTripId}
              liveLocations={liveLocations}
              centerOnLiveLocations={centerMapOnLiveLocations}
              onSelectVessel={handleSelectVessel}
              onRetry={refetchTripData}
              onTryWiderDateRange={() => handleDateChange(subDays(new Date(), 90), new Date())}
              renderNoImeiDataMessage={() => renderNoImeiDataMessage(currentUser, t)}
              isViewingLiveLocations={isViewingLiveLocations}
              onCenterOnLiveLocations={centerOnLiveLocations}
              isAdminMode={currentUser?.role === 'admin'}
              adminHasNoVesselsSelected={currentUser?.role === 'admin' && (!currentUser?.imeis || currentUser.imeis.length === 0)}
              onShowVesselSelection={handleShowBoatSelection}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              hasTrackingDevice={hasTrackingDevice}
              deviceLocation={deviceLocation}
              onGetMyLocation={getMyLocation}
            isGettingLocation={isGettingLocation}
            showNoTripsMessage={hasTrackingDevice && dataAvailable === false && !loading && !errorMessage && !isViewingLiveLocations}
            waypoints={visibleWaypoints}
            onEnterWaypointMode={handleEnterWaypointMode}
            onToggleWaypoints={handleToggleWaypointsModal}
            waypointsCount={waypoints.length}
            isWaypointSelectionMode={isWaypointSelectionMode}
            onCancelWaypointMode={handleCancelWaypointMode}
            onConfirmWaypointLocation={handleConfirmWaypointLocation}
            centeredWaypoint={centeredWaypoint}
          />
          )}
          </div>



          {/* 3. Trips Table - Third on mobile (PDS users only) */}
          {hasTrackingDevice && (
            <div className="d-md-none mb-2">
              <TripsTable
                trips={trips}
                onSelectTrip={handleSelectTrip}
                loading={loading}
                selectedTripId={selectedTripId}
              />
            </div>
          )}

          {/* 4. Vessel Details Panel - Fourth on mobile (PDS users only) */}
          {hasTrackingDevice && (
            <div className="d-md-none mb-2">
              <VesselDetailsPanel
                liveLocations={liveLocations}
                onCenterOnLiveLocations={centerOnLiveLocations}
              />
            </div>
          )}

          {/* 5. Vessel Insights - Fifth on mobile (PDS users only) */}
          {hasTrackingDevice && (
            <div className="d-md-none mb-2">
              <VesselInsightsPanel insights={insights} tripsCount={trips.length} />
            </div>
          )}
        </div>

        {/* Desktop Layout - Hidden on mobile */}
        <div className="d-none d-md-flex row g-2 w-100">
          {/* Desktop Sidebar */}
          <div className="col-lg-3 col-md-4">
            {/* Date Range Selector (PDS users only) */}
            {hasTrackingDevice && (
              <div className="card mb-2">
                <div className="card-body p-2">
                  <div className="d-flex align-items-center mb-2">
                    <IconCalendarStats className="icon me-2 text-primary" />
                    <h3 className="card-title m-0">{t('common.dateRange')}</h3>
                  </div>

                  <DateRangeSelector
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    onDateChange={handleDateChange}
                  />
                </div>
              </div>
            )}

            {/* Report Catch Button */}
            <div className="card mb-2">
              <div className="card-body p-2">
                <button
                  className="btn btn-primary w-100 d-flex align-items-center justify-content-center position-relative"
                  onClick={handleReportCatchClick}
                  style={{ minHeight: '45px' }}
                >
                  <IconFish className="me-2" size={20} />
                  <span className="fw-bold">{t('catch.reportCatch')}</span>
                </button>
                <small className="text-muted mt-2 d-block text-center">
                  {t('catch.reportFromRecentTrips')}
                </small>
              </div>
            </div>

            {/* Vessel Details Panel (PDS users only) */}
            {hasTrackingDevice && (
              <VesselDetailsPanel
                liveLocations={liveLocations}
                onCenterOnLiveLocations={centerOnLiveLocations}
              />
            )}

            {/* Vessel Insights (PDS users only) */}
            {hasTrackingDevice && (
              <VesselInsightsPanel insights={insights} tripsCount={trips.length} />
            )}
          </div>

          {/* Desktop Map Area */}
          <div className="col-lg-9 col-md-8" data-map-container>
            {isDesktopLayout && (
            <MapContainer
              loading={loading}
              errorMessage={errorMessage}
              dataAvailable={dataAvailable}
              dateFrom={dateFrom}
              dateTo={dateTo}
              selectedTripId={selectedTripId}
              liveLocations={liveLocations}
              centerOnLiveLocations={centerMapOnLiveLocations}
              onSelectVessel={handleSelectVessel}
              onRetry={refetchTripData}
              waypoints={visibleWaypoints}
              onTryWiderDateRange={() => handleDateChange(subDays(new Date(), 90), new Date())}
              renderNoImeiDataMessage={() => renderNoImeiDataMessage(currentUser, t)}
              isViewingLiveLocations={isViewingLiveLocations}
              onCenterOnLiveLocations={centerOnLiveLocations}
              isAdminMode={currentUser?.role === 'admin'}
              adminHasNoVesselsSelected={currentUser?.role === 'admin' && (!currentUser?.imeis || currentUser.imeis.length === 0)}
              onShowVesselSelection={handleShowBoatSelection}
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              hasTrackingDevice={hasTrackingDevice}
              deviceLocation={deviceLocation}
              onGetMyLocation={getMyLocation}
              isGettingLocation={isGettingLocation}
              showNoTripsMessage={hasTrackingDevice && dataAvailable === false && !loading && !errorMessage && !isViewingLiveLocations}
              onEnterWaypointMode={handleEnterWaypointMode}
              onToggleWaypoints={handleToggleWaypointsModal}
              waypointsCount={waypoints.length}
              isWaypointSelectionMode={isWaypointSelectionMode}
              onCancelWaypointMode={handleCancelWaypointMode}
              onConfirmWaypointLocation={handleConfirmWaypointLocation}
              centeredWaypoint={centeredWaypoint}
            />
            )}

            {/* Trips Table - Below the map (PDS users only) */}
            {hasTrackingDevice && (
              <div className="mt-2">
                <TripsTable
                  trips={trips}
                  onSelectTrip={handleSelectTrip}
                  loading={loading}
                  selectedTripId={selectedTripId}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Admin Boat Selection Modal */}
      {showBoatSelection && (
        <BoatSelectionModal
          onSelect={handleBoatSelect}
          onClose={handleCloseBoatSelection}
        />
      )}

      {/* Trip Selection Modal */}
      {showTripSelection && (
        <TripSelectionModal
          onSelectTrip={handleTripSelect}
          onClose={handleTripSelectionClose}
        />
      )}

      {/* Report Catch Form Modal */}
      {selectedTripForCatch && (
        <ReportCatchForm
          trip={selectedTripForCatch}
          onClose={handleCatchFormClose}
          onSuccess={handleCatchFormSuccess}
        />
      )}

      {/* GPS Error Modal - for non-PDS users */}
      {!hasTrackingDevice && locationError && (
        <div className="modal modal-blur fade show" style={{ display: 'block' }} tabIndex={-1} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-sm modal-dialog-centered" role="document">
            <div className="modal-content">
              <button
                type="button"
                className="btn-close"
                onClick={() => setLocationError(null)}
                aria-label={t('common.close')}
              />
              <div className="modal-status bg-warning"></div>
              <div className="modal-body text-center py-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon mb-2 text-warning icon-lg" width="24" height="24" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round">
                  <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                  <path d="M12 9v4" />
                  <path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z" />
                  <path d="M12 16h.01" />
                </svg>
                <h3>{t('common.error')}</h3>
                <div className="text-secondary">{t(locationError)}</div>
                {locationError === 'gps.permissionDenied' && (
                  <div className="text-secondary mt-3" style={{ fontSize: '0.875rem', textAlign: 'left' }}>
                    <strong>{t('gps.androidInstructions')}</strong>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <div className="w-100">
                  <div className="row">
                    <div className="col">
                      <button
                        type="button"
                        className="btn w-100"
                        onClick={() => setLocationError(null)}
                      >
                        {t('common.close')}
                      </button>
                    </div>
                    <div className="col">
                      <button
                        type="button"
                        className="btn btn-danger w-100"
                        onClick={() => {
                          setLocationError(null);
                          getMyLocation();
                        }}
                      >
                        {t('common.tryAgain')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {!hasTrackingDevice && locationError && <div className="modal-backdrop fade show"></div>}

      {/* Waypoints Modal */}
      {showWaypointsModal && (
        <WaypointsModal
          waypoints={waypoints}
          onSave={handleWaypointSave}
          onDelete={handleWaypointDelete}
          onClose={handleWaypointModalClose}
          selectedMapCoordinates={selectedMapCoordinates}
          deviceLocation={deviceLocation}
          onGetMyLocation={getMyLocation}
          isGettingLocation={isGettingLocation}
          onToggleWaypoint={toggleWaypointVisibility}
          onToggleAllWaypoints={toggleAllWaypoints}
          onShowWaypointOnMap={handleShowWaypointOnMap}
        />
      )}
    </MainLayout>
  );
};

export default Dashboard; 