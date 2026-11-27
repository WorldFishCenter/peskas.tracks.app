import React, { Suspense, useState } from 'react';
import MainLayout from '../layouts/MainLayout';
import DateRangeSelector from '../components/DateRangeSelector';
import TripsTable from '../components/TripsTable';
import {
  AlertTriangleIcon,
  CalendarRangeIcon,
  FishIcon,
  ShipIcon,
  UsersIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { subDays, differenceInDays } from 'date-fns';
import { Trip, LiveLocation, GPSCoordinate, Waypoint, WaypointFormData } from '../types';
import { formatDisplayDate } from '../utils/formatters';
import { hasTrackingDevice as userHasTrackingDevice } from '../utils/userInfo';
import { useVesselTracks } from '../hooks/useVesselTracks';
import { useWaypoints } from '../hooks/useWaypoints';
import VesselDetailsPanel from '../components/dashboard/VesselDetailsPanel';
import VesselInsightsPanel from '../components/dashboard/VesselInsightsPanel';
import { getCurrentGPSCoordinate } from '../utils/gpsUtils';

import TripSelectionModal from '../components/TripSelectionModal';
import ReportCatchForm from '../components/catch-form/ReportCatchForm';
import ReportCatchFooter from '../components/ReportCatchFooter';
import BoatSelectionModal from '../components/BoatSelectionModal';
import WaypointsModal from '../components/waypoints/WaypointsModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const FishersMap = React.lazy(() => import('../components/Map'));

const Dashboard: React.FC = () => {
  const { currentUser, updateUserImeis } = useAuth();
  const { t } = useTranslation();
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 7));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [selectedTripId, setSelectedTripId] = useState<string | undefined>(undefined);
  const [centerMapOnLiveLocations, setCenterMapOnLiveLocations] = useState(false);
  const [isViewingLiveLocations, setIsViewingLiveLocations] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Device location state (for self-registered fishers without a tracking device)
  const [deviceLocation, setDeviceLocation] = useState<GPSCoordinate | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Whether there is a device whose data we can show — for an administrator
  // that means the vessel they have selected.
  const hasTrackingDevice = userHasTrackingDevice(currentUser);
  const isAdminMode = currentUser?.role === 'admin';
  const adminHasNoVesselsSelected =
    isAdminMode && (!currentUser?.imeis || currentUser.imeis.length === 0);

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
    toggleAllWaypoints,
  } = useWaypoints();
  const [showWaypointsModal, setShowWaypointsModal] = useState(false);
  const [selectedMapCoordinates, setSelectedMapCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isWaypointSelectionMode, setIsWaypointSelectionMode] = useState(false);
  const [centeredWaypoint, setCenteredWaypoint] = useState<{ lat: number; lng: number } | null>(null);

  // Single deep vessel-tracks module: trips, points, tripById, live locations, insights
  const {
    trips,
    tripPoints,
    tripById,
    liveLocations,
    insights,
    loading,
    dataAvailable,
    errorMessage,
    refetch: refetchTracks,
    refresh: refreshTracks,
  } = useVesselTracks(dateFrom, dateTo);

  const clearSelection = () => setSelectedTripId(undefined);

  const handleSelectVessel = (vessel: LiveLocation | null) => {
    if (!vessel) {
      clearSelection();
      return;
    }

    // Select the most recent loaded trip for this vessel's IMEI, if any.
    const matchingTrips = trips
      .filter((trip) => trip.imei === vessel.imei)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

    setSelectedTripId(matchingTrips[0]?.id);
    setIsViewingLiveLocations(false);
  };

  const handleSelectTrip = (tripId: string) => {
    setSelectedTripId(tripId);
    setIsViewingLiveLocations(false);

    setTimeout(() => {
      const mapElement = document.querySelector('[data-map-container]');
      if (mapElement) {
        mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTracks();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleBoatSelect = (imei: string) => {
    if (currentUser && currentUser.role === 'admin') {
      updateUserImeis([imei]);
    }
    setShowBoatSelection(false);
  };

  const handleDateChange = (newDateFrom: Date, newDateTo: Date) => {
    setDateFrom(newDateFrom);
    setDateTo(newDateTo);
    clearSelection();
    setIsViewingLiveLocations(false);
  };

  const centerOnLiveLocations = () => {
    if (liveLocations.length > 0) {
      setCenterMapOnLiveLocations(true);
      setIsViewingLiveLocations(true);
      clearSelection();
      setTimeout(() => setCenterMapOnLiveLocations(false), 100);
    }
  };

  const getMyLocation = async () => {
    if (isGettingLocation) return;

    setIsGettingLocation(true);
    setLocationError(null);

    try {
      const result = await getCurrentGPSCoordinate();
      if (result.coordinate) {
        setDeviceLocation(result.coordinate);
        setIsViewingLiveLocations(true);
        clearSelection();
      } else if (result.error) {
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

  const handleReportCatchClick = () => {
    if (!hasTrackingDevice) {
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
        imei: '',
      };
      setSelectedTripForCatch(placeholderTrip);
    } else {
      setShowTripSelection(true);
    }
  };

  const handleTripSelect = (trip: Trip) => {
    setSelectedTripForCatch(trip);
    setShowTripSelection(false);
  };

  const handleConfirmWaypointLocation = (coordinates: { lat: number; lng: number }) => {
    setSelectedMapCoordinates(coordinates);
    setIsWaypointSelectionMode(false);
    setShowWaypointsModal(true);
  };

  const handleToggleWaypointsModal = () => {
    if (!isWaypointSelectionMode) {
      setShowWaypointsModal(!showWaypointsModal);
    }
  };

  const handleWaypointSave = async (formData: WaypointFormData) => {
    await addWaypoint(formData);
    setSelectedMapCoordinates(null);
  };

  const handleWaypointDelete = async (waypointId: string) => {
    await removeWaypoint(waypointId);
  };

  const handleWaypointModalClose = () => {
    setShowWaypointsModal(false);
    setSelectedMapCoordinates(null);
  };

  const handleShowWaypointOnMap = (waypoint: Waypoint) => {
    if (waypoint.visible === false && waypoint._id) {
      toggleWaypointVisibility(waypoint._id);
    }

    setCenteredWaypoint({ lat: waypoint.coordinates.lat, lng: waypoint.coordinates.lng });
    setShowWaypointsModal(false);
    clearSelection();
    setTimeout(() => setCenteredWaypoint(null), 100);
  };

  // Taller map for self-registered fishers since they have no trip table or vessel panels.
  const mapHeight = hasTrackingDevice ? '500px' : 'calc(100vh - 200px)';
  const showNoTripsMessage =
    hasTrackingDevice && dataAvailable === false && !loading && !errorMessage && !isViewingLiveLocations;

  const pageHeader = (
    <div className="border-b bg-background print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-3">
        {hasTrackingDevice && (
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t('dashboard.dateRange', {
              from: formatDisplayDate(dateFrom),
              to: formatDisplayDate(dateTo),
              days: differenceInDays(dateTo, dateFrom) + 1,
            })}
          </div>
        )}
        <h2 className="text-xl font-semibold tracking-tight">
          {hasTrackingDevice ? t('dashboard.title') : t('dashboard.titleNonPds')}
        </h2>
      </div>
    </div>
  );

  const stickyFooter = (
    <div className="md:hidden">
      <ReportCatchFooter onReportCatchClick={handleReportCatchClick} />
    </div>
  );

  return (
    <MainLayout pageHeader={pageHeader} stickyFooter={stickyFooter}>
      <div className="dashboard-layout">
        {/* Date range and Report Catch CTA */}
        <div className="dashboard-layout__controls flex flex-col gap-3">
          {hasTrackingDevice && (
            <Card size="sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarRangeIcon className="size-4 text-primary" />
                  {t('common.dateRange')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DateRangeSelector
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateChange={handleDateChange}
                />
              </CardContent>
            </Card>
          )}

          {/* Report Catch — mobile gets this from the sticky footer instead */}
          <Card size="sm" className="hidden md:flex">
            <CardContent className="flex flex-col gap-2">
              <Button size="lg" className="h-11 w-full font-semibold" onClick={handleReportCatchClick}>
                <FishIcon data-icon="inline-start" />
                {t('catch.reportCatch')}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {t('catch.reportFromRecentTrips')}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Map and its trips table */}
        <div className="dashboard-layout__map flex flex-col gap-3" data-map-container>
          <Card className="relative overflow-hidden py-0" style={{ height: mapHeight, minHeight: '400px' }}>
            <div className="relative size-full">
              <Suspense
                fallback={
                  <div className="flex size-full items-center justify-center">
                    <Spinner className="size-6 text-primary" />
                  </div>
                }
              >
                <FishersMap
                  tripPoints={tripPoints}
                  tripById={tripById}
                  onSelectVessel={handleSelectVessel}
                  selectedTripId={selectedTripId}
                  liveLocations={liveLocations}
                  centerOnLiveLocations={centerMapOnLiveLocations}
                  onCenterOnLiveLocations={centerOnLiveLocations}
                  onRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                  hasTrackingDevice={hasTrackingDevice}
                  deviceLocation={deviceLocation}
                  onGetMyLocation={getMyLocation}
                  isGettingLocation={isGettingLocation}
                  showNoTripsMessage={showNoTripsMessage}
                  waypoints={visibleWaypoints}
                  onEnterWaypointMode={() => setIsWaypointSelectionMode(true)}
                  onToggleWaypoints={handleToggleWaypointsModal}
                  waypointsCount={waypoints.length}
                  isWaypointSelectionMode={isWaypointSelectionMode}
                  onCancelWaypointMode={() => setIsWaypointSelectionMode(false)}
                  onConfirmWaypointLocation={handleConfirmWaypointLocation}
                  centeredWaypoint={centeredWaypoint}
                />
              </Suspense>

              {isAdminMode && adminHasNoVesselsSelected && !loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/95 backdrop-blur-xs">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon" className="size-12">
                        <UsersIcon className="size-6 text-primary" />
                      </EmptyMedia>
                      <EmptyTitle>{t('dashboard.adminMode')}</EmptyTitle>
                      <EmptyDescription>{t('dashboard.adminSelectVesselMessage')}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button size="lg" onClick={() => setShowBoatSelection(true)}>
                        <ShipIcon data-icon="inline-start" />
                        {t('dashboard.chooseVessel')}
                      </Button>
                    </EmptyContent>
                  </Empty>
                </div>
              )}

              {loading && (
                <div className="absolute top-1/2 left-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-md">
                  <Spinner className="text-primary" />
                  <span className="text-sm text-muted-foreground">{t('common.loadingVesselData')}</span>
                </div>
              )}

              {errorMessage && !loading && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 backdrop-blur-xs">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon" className="size-12 bg-destructive/10 text-destructive">
                        <AlertTriangleIcon className="size-6" />
                      </EmptyMedia>
                      <EmptyTitle>{t('common.errorLoadingData')}</EmptyTitle>
                      <EmptyDescription>{errorMessage}</EmptyDescription>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button size="lg" onClick={refetchTracks}>
                        {t('common.tryAgain')}
                      </Button>
                    </EmptyContent>
                  </Empty>
                </div>
              )}
            </div>
          </Card>

          {hasTrackingDevice && (
            <TripsTable
              trips={trips}
              onSelectTrip={handleSelectTrip}
              loading={loading}
              selectedTripId={selectedTripId}
            />
          )}
        </div>

        {/* Vessel panels */}
        <div className="dashboard-layout__panels flex flex-col gap-3">
          {hasTrackingDevice && (
            <>
              <VesselDetailsPanel
                liveLocations={liveLocations}
                onCenterOnLiveLocations={centerOnLiveLocations}
              />
              <VesselInsightsPanel insights={insights} tripsCount={trips.length} />
            </>
          )}
        </div>
      </div>

      {/* Admin Vessel Selection Modal */}
      {showBoatSelection && (
        <BoatSelectionModal
          onSelect={handleBoatSelect}
          onClose={() => setShowBoatSelection(false)}
        />
      )}

      {/* Trip Selection Modal */}
      {showTripSelection && (
        <TripSelectionModal
          onSelectTrip={handleTripSelect}
          onClose={() => setShowTripSelection(false)}
        />
      )}

      {/* Report Catch Form Modal */}
      {selectedTripForCatch && (
        <ReportCatchForm
          trip={selectedTripForCatch}
          onClose={() => setSelectedTripForCatch(null)}
          onSuccess={() => setSelectedTripForCatch(null)}
        />
      )}

      {/* GPS Error Dialog - for self-registered fishers */}
      <AlertDialog
        open={!hasTrackingDevice && Boolean(locationError)}
        onOpenChange={(open) => {
          if (!open) setLocationError(null);
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <AlertTriangleIcon className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>{t('common.error')}</AlertDialogTitle>
            <AlertDialogDescription>
              {locationError ? t(locationError) : ''}
            </AlertDialogDescription>
            {locationError === 'gps.permissionDenied' && (
              <p className="mt-2 text-left text-xs font-medium text-muted-foreground">
                {t('gps.androidInstructions')}
              </p>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setLocationError(null)}>
              {t('common.close')}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setLocationError(null);
                getMyLocation();
              }}
            >
              {t('common.tryAgain')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
