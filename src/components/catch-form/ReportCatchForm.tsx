import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangleIcon,
  BanIcon,
  CalendarIcon,
  CheckCircle2Icon,
  CheckIcon,
  CloudUploadIcon,
  FishIcon,
  FuelIcon,
  MapPinIcon,
  PlusIcon,
  XIcon,
} from 'lucide-react';
import { Trip, MultipleCatchFormData, CatchEntry, GPSCoordinate } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { formatTripDate } from '../../utils/formatters';
import { usePhotoHandling } from './hooks/usePhotoHandling';
import { catchOutbox } from '../../api/catchOutbox';
import DateSelector from './DateSelector';
import CatchEntryForm from './CatchEntryForm';
import CatchSummary from './CatchSummary';
import NetworkStatus from '../NetworkStatus';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
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
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';

interface ReportCatchFormProps {
  trip: Trip;
  onClose: () => void;
  onSuccess: () => void;
}

const ReportCatchForm: React.FC<ReportCatchFormProps> = ({ trip, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [submissionInProgress, setSubmissionInProgress] = useState(false);

  const isDirectCatch = trip.id.startsWith('standalone_');

  const [formData, setFormData] = useState<MultipleCatchFormData>(() => ({
    tripId: trip.id,
    reportId: `report_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    date: isDirectCatch ? new Date() : new Date(trip.endTime),
    catches: [
      {
        id: `catch_${Date.now()}`,
        fishGroup: 'reef fish',
        quantity: 0,
        photos: [],
        gps_photo: [],
      },
    ],
    noCatch: false,
  }));

  const [gpsLocationEnabled, setGpsLocationEnabled] = useState(false);

  const addPhotoToCatch = (
    catchEntryId: string,
    base64Photo: string,
    gpsCoordinate?: GPSCoordinate
  ) => {
    setFormData((prev) => ({
      ...prev,
      catches: prev.catches.map((catchEntry) => {
        if (catchEntry.id === catchEntryId) {
          const currentPhotos = catchEntry.photos || [];
          const currentGPSCoordinates = catchEntry.gps_photo || [];

          if (currentPhotos.length >= 3) {
            setError(t('catch.maxPhotosReached'));
            return catchEntry;
          }

          return {
            ...catchEntry,
            photos: [...currentPhotos, base64Photo],
            gps_photo: gpsCoordinate
              ? [...currentGPSCoordinates, gpsCoordinate]
              : currentGPSCoordinates,
          };
        }
        return catchEntry;
      }),
    }));
    setError(null);
  };

  const removePhotoFromCatch = (catchEntryId: string, photoIndex: number) => {
    setFormData((prev) => ({
      ...prev,
      catches: prev.catches.map((catchEntry) => {
        if (catchEntry.id === catchEntryId) {
          const currentPhotos = catchEntry.photos || [];
          const currentGPSCoordinates = catchEntry.gps_photo || [];
          return {
            ...catchEntry,
            photos: currentPhotos.filter((_, index) => index !== photoIndex),
            gps_photo: currentGPSCoordinates.filter((_, index) => index !== photoIndex),
          };
        }
        return catchEntry;
      }),
    }));
  };

  const photoHandling = usePhotoHandling({
    onError: setError,
    onPhotoAdd: addPhotoToCatch,
    onPhotoRemove: removePhotoFromCatch,
    gpsLocationEnabled,
  });

  useEffect(() => {
    photoHandling.checkCameraSupport();
  }, [photoHandling]);

  const handleDateSelection = (daysAgo: number) => {
    const selectedDate = new Date();
    selectedDate.setDate(selectedDate.getDate() - daysAgo);
    setFormData((prev) => ({ ...prev, date: selectedDate }));
  };

  const addCatchEntry = () => {
    setFormData((prev) => ({
      ...prev,
      catches: [
        ...prev.catches,
        {
          id: `catch_${Date.now()}`,
          fishGroup: 'reef fish',
          quantity: 0,
          photos: [],
          gps_photo: [],
        },
      ],
    }));
  };

  const removeCatchEntry = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      catches: prev.catches.filter((catchEntry) => catchEntry.id !== id),
    }));
  };

  const updateCatchEntry = (id: string, field: keyof CatchEntry, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      catches: prev.catches.map((catchEntry) =>
        catchEntry.id === id ? { ...catchEntry, [field]: value } : catchEntry
      ),
    }));
  };

  const toggleNoCatch = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      noCatch: checked,
      catches: !checked
        ? [
            {
              id: `catch_${Date.now()}`,
              fishGroup: 'reef fish',
              quantity: 0,
              photos: [],
              gps_photo: [],
            },
          ]
        : [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submissionInProgress) return;

    const hasIdentifier = currentUser?.imeis?.[0] || currentUser?.username;
    if (!hasIdentifier) {
      setError(t('catch.errorNoImei'));
      return;
    }

    if (!formData.noCatch) {
      const validCatches = formData.catches.filter((catchEntry) => catchEntry.quantity > 0);
      if (validCatches.length === 0) {
        setError(t('catch.errorNoValidCatches'));
        return;
      }
    }

    setSubmissionInProgress(true);
    setLoading(true);
    setError(null);

    try {
      const outcome = await catchOutbox.enqueue({
        ...formData,
        imei: currentUser?.imeis?.[0] || null,
        username: currentUser?.username || null,
      });

      setIsOfflineMode(outcome.queuedOffline);
      setSuccess(true);

      setTimeout(() => {
        onSuccess();
      }, 3000);
    } catch (err) {
      console.error('Error submitting catch report:', err);
      setError(err instanceof Error ? err.message : t('catch.errorSubmitting'));
    } finally {
      setLoading(false);
      setSubmissionInProgress(false);
    }
  };

  if (success) {
    return (
      <Dialog open disablePointerDismissal>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader className="items-center py-6 text-center">
            {isOfflineMode ? (
              <CloudUploadIcon className="mb-2 size-12 text-muted-foreground" />
            ) : (
              <CheckCircle2Icon className="mb-2 size-12 text-primary" />
            )}
            <DialogTitle className={isOfflineMode ? 'text-foreground' : 'text-primary'}>
              {isOfflineMode ? t('catch.reportQueued') : t('catch.reportSubmitted')}
            </DialogTitle>
            <DialogDescription>
              {isOfflineMode
                ? t('catch.reportQueuedMessage')
                : t('catch.reportSubmittedMessage')}
            </DialogDescription>
            {isOfflineMode && (
              <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>{t('catch.offlineIndicator')}</span>
                <span>{t('catch.willRetryWhenOnline')}</span>
              </div>
            )}
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open disablePointerDismissal>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[95vh] flex-col sm:max-w-5xl"
      >
        <DialogHeader className="flex-row items-center justify-between border-b pb-3">
          <DialogTitle className="flex items-center gap-2">
            <FishIcon className="size-5 text-primary" />
            <span className="hidden sm:inline">{t('catch.reportCatch')}</span>
            <span className="sm:hidden">{t('catch.reportCatchButton')}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">{t('catch.reportCatch')}</DialogDescription>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={loading}
            aria-label={t('common.close')}
          >
            <XIcon />
          </Button>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-2 pr-1">
          <NetworkStatus compact={false} showDetails={true} />

          {isDirectCatch ? (
            <DateSelector
              selectedDate={formData.date}
              onDateSelection={handleDateSelection}
            />
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarIcon className="size-4" />
              <span>{formatTripDate(trip.endTime, t)}</span>
              <span>•</span>
              <span>
                {t('catch.tripIdLabel')} {trip.id.slice(0, 8)}...
              </span>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form id="report-catch-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Left Column - Catch Options */}
              <div className="flex flex-col gap-4 lg:col-span-8">
                {/* No Catch Option */}
                <Card size="sm">
                  <CardContent>
                    <FieldGroup>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldLabel
                            htmlFor="noCatchToggle"
                            className="cursor-pointer font-semibold"
                          >
                            <BanIcon className="size-4 text-muted-foreground" />
                            {t('catch.noCatch')}
                          </FieldLabel>
                          <FieldDescription className="text-xs">
                            {t('catch.reportNoCatchDescription')}
                          </FieldDescription>
                        </FieldContent>
                        <Switch
                          id="noCatchToggle"
                          checked={formData.noCatch}
                          onCheckedChange={toggleNoCatch}
                          disabled={loading}
                        />
                      </Field>
                    </FieldGroup>
                  </CardContent>
                </Card>

                {/* Fuel Used */}
                <Card size="sm">
                  <CardContent>
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="fuelLiters" className="font-semibold">
                          <FuelIcon className="size-4 text-primary" />
                          {t('catch.fuelUsed')}
                        </FieldLabel>
                        <FieldDescription className="text-xs">
                          {t('catch.fuelUsedDescription')}
                        </FieldDescription>
                        <Input
                          id="fuelLiters"
                          type="number"
                          inputMode="decimal"
                          className="h-11 text-base"
                          value={formData.fuel_liters ?? ''}
                          onChange={(e) => {
                            const liters = parseFloat(e.target.value);
                            setFormData((prev) => ({
                              ...prev,
                              fuel_liters: liters >= 0 ? liters : undefined,
                            }));
                          }}
                          onWheel={(e) => e.currentTarget.blur()}
                          placeholder="0.0"
                          min="0"
                          step="0.01"
                          disabled={loading}
                        />
                      </Field>
                    </FieldGroup>
                  </CardContent>
                </Card>

                {/* GPS Location Option for Direct Catch Reports */}
                {isDirectCatch && !formData.noCatch && (
                  <Card size="sm">
                    <CardContent>
                      <FieldGroup>
                        <Field orientation="horizontal">
                          <FieldContent>
                            <FieldLabel
                              htmlFor="gpsLocationToggle"
                              className="cursor-pointer font-semibold"
                            >
                              <MapPinIcon className="size-4 text-primary" />
                              {t('catch.photoLocationQuestion')}
                            </FieldLabel>
                            <FieldDescription className="text-xs">
                              {t('catch.photoLocationDescription')}
                            </FieldDescription>
                          </FieldContent>
                          <Switch
                            id="gpsLocationToggle"
                            checked={gpsLocationEnabled}
                            onCheckedChange={setGpsLocationEnabled}
                            disabled={loading}
                          />
                        </Field>
                      </FieldGroup>
                    </CardContent>
                  </Card>
                )}

                {/* Multiple Catch Entries */}
                {!formData.noCatch && (
                  <Card className="ring-primary/40">
                    <CardHeader className="items-center border-b bg-primary/5 py-3">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <FishIcon className="size-4 text-primary" />
                        <span className="hidden sm:inline">{t('catch.catchDetails')}</span>
                        <span className="sm:hidden">{t('catch.catches')}</span>
                      </CardTitle>
                      <CardAction>
                        <Button
                          type="button"
                          size="sm"
                          onClick={addCatchEntry}
                          disabled={loading || formData.catches.length >= 5}
                        >
                          <PlusIcon data-icon="inline-start" />
                          <span className="hidden sm:inline">{t('catch.addFishGroup')}</span>
                          <span className="sm:hidden">{t('catch.addCatch')}</span>
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4 pt-2">
                      {formData.catches.map((catchEntry, index) => (
                        <CatchEntryForm
                          key={catchEntry.id}
                          catchEntry={catchEntry}
                          index={index}
                          totalCatches={formData.catches.length}
                          loading={loading}
                          isDirectCatch={isDirectCatch}
                          fileInputRefs={photoHandling.fileInputRefs}
                          onUpdate={updateCatchEntry}
                          onRemove={removeCatchEntry}
                          onFileUpload={photoHandling.handleFileUpload}
                          onTriggerFileInput={photoHandling.triggerFileInput}
                          onRemovePhoto={photoHandling.removePhoto}
                        />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Right Column - Summary */}
              <div className="lg:col-span-4">
                <CatchSummary noCatch={formData.noCatch} catches={formData.catches} />
              </div>
            </div>
          </form>
        </div>

        <DialogFooter className="flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 flex-1"
            onClick={onClose}
            disabled={loading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="report-catch-form"
            size="lg"
            className="h-11 flex-1"
            disabled={
              loading ||
              submissionInProgress ||
              (!formData.noCatch && formData.catches.filter((c) => c.quantity > 0).length === 0)
            }
          >
            {loading ? (
              <>
                <Spinner data-icon="inline-start" />
                {t('common.loading')}...
              </>
            ) : (
              <>
                <CheckIcon data-icon="inline-start" />
                {formData.noCatch ? t('catch.reportNoCatch') : t('catch.submitReport')}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReportCatchForm;
