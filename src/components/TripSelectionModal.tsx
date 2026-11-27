import React, { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarIcon, ClockIcon, FishIcon, MapPinIcon } from 'lucide-react';
import { Trip } from '../types';
import { getTripDayLabel } from '../utils/formatters';
import { format, subDays } from 'date-fns';
import { fetchTrips } from '../api/pelagicDataService';
import { useAuth } from '../contexts/AuthContext';
import { anonymizeBoatName } from '../utils/demoData';
import { hasTrackingDevice } from '../utils/userInfo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';

interface TripSelectionModalProps {
  onSelectTrip: (trip: Trip) => void;
  onClose: () => void;
}

interface TripsByDay {
  [dayLabel: string]: Trip[];
}

const TripSelectionModal: React.FC<TripSelectionModalProps> = ({ onSelectTrip, onClose }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  const hasDevice = hasTrackingDevice(currentUser);

  const [recentTrips, setRecentTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentTrips = async () => {
      if (!hasDevice) {
        setLoading(false);
        setRecentTrips([]);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const today = new Date();
        const fiveDaysAgo = subDays(today, 5);

        const trips = await fetchTrips({
          dateFrom: fiveDaysAgo,
          dateTo: today,
          imeis: currentUser?.imeis || [],
          includeDeviceInfo: false,
          includeLastSeen: false,
        });

        setRecentTrips(trips);
      } catch (err) {
        console.error('Error fetching recent trips:', err);
        setError(err instanceof Error ? err.message : 'Error fetching trips');
      } finally {
        setLoading(false);
      }
    };

    if (currentUser) {
      fetchRecentTrips();
    }
  }, [currentUser, hasDevice]);

  const tripsByDay = useMemo(() => {
    const grouped: TripsByDay = {};

    const sortedTrips = [...recentTrips].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

    sortedTrips.forEach((trip) => {
      const dayLabel = getTripDayLabel(trip.startTime, t);
      if (!grouped[dayLabel]) {
        grouped[dayLabel] = [];
      }
      grouped[dayLabel].push(trip);
    });

    return grouped;
  }, [recentTrips, t]);

  const formatTripTime = (startTime: string, endTime: string) => {
    const start = new Date(startTime);
    const end = new Date(endTime);
    return `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
  };

  const getDurationLabel = (durationSeconds: number) => {
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const handleDirectCatchReport = () => {
    const placeholderTrip: Trip = {
      id: `standalone_${Date.now()}`,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      boat: currentUser?.imeis?.[0] || '',
      boatName: t('catch.directCatchReport') || 'Direct Catch',
      community: currentUser?.name || t('common.unknown'),
      durationSeconds: 0,
      rangeMeters: 0,
      distanceMeters: 0,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      imei: currentUser?.imeis?.[0] || '',
    };

    onSelectTrip(placeholderTrip);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FishIcon className="size-5 text-primary" />
            {t('catch.reportCatch')}
          </DialogTitle>
          <DialogDescription>
            {hasDevice ? t('catch.chooseSpecificTrip') : t('catch.reportCatchWithoutTracking')}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {!hasDevice && (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FishIcon className="text-primary" />
                </EmptyMedia>
                <EmptyTitle>{t('catch.reportYourCatch')}</EmptyTitle>
                <EmptyDescription>{t('catch.reportCatchWithoutTracking')}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}

          {hasDevice && (
            <>
              {loading ? (
                <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Spinner className="size-6 text-primary" />
                  <p className="text-sm">{t('catch.loadingRecentTrips')}</p>
                </div>
              ) : error ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FishIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('common.error')}</EmptyTitle>
                    <EmptyDescription>{error}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : recentTrips.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <FishIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('catch.noRecentTrips')}</EmptyTitle>
                    <EmptyDescription>{t('catch.noRecentTripsMessage')}</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-5">
                  {Object.entries(tripsByDay).map(([dayLabel, dayTrips]) => (
                    <div key={dayLabel} className="flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <CalendarIcon className="size-4" />
                        <span>{dayLabel}</span>
                      </div>

                      <div className="flex flex-col gap-2">
                        {dayTrips.map((trip) => (
                          <button
                            key={trip.id}
                            type="button"
                            onClick={() => onSelectTrip(trip)}
                            className="flex min-h-20 w-full flex-col justify-center gap-1.5 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">
                                {anonymizeBoatName(trip.boatName)}
                              </span>
                              <span className="font-mono text-xs text-muted-foreground">
                                {t('catch.tripId')}:{' '}
                                {trip.id.length > 8 ? `${trip.id.slice(0, 8)}...` : trip.id}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <ClockIcon className="size-3.5" />
                                {formatTripTime(trip.startTime, trip.endTime)}
                              </span>
                              <Badge variant="secondary">
                                {getDurationLabel(trip.durationSeconds)}
                              </Badge>
                              <span className="flex items-center gap-1">
                                <MapPinIcon className="size-3.5" />
                                {trip.community || t('common.unknown')}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Direct Catch Report Callout */}
        <Card size="sm" className="bg-primary/5 ring-primary/30">
          <CardHeader className="items-center">
            <CardTitle className="text-primary">
              {!hasDevice ? t('catch.reportYourCatch') : t('catch.tripNotInList')}
            </CardTitle>
            <CardDescription className="text-xs">
              {!hasDevice ? t('catch.clickToContinue') : t('catch.reportWithoutTrip')}
            </CardDescription>
            <CardAction>
              <Button size="lg" onClick={handleDirectCatchReport}>
                <FishIcon data-icon="inline-start" />
                {t('catch.reportCatchButton')}
              </Button>
            </CardAction>
          </CardHeader>
        </Card>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TripSelectionModal;
