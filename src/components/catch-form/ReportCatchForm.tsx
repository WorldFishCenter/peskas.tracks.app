import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IconFish, IconCheck, IconAlertTriangle, IconCalendar, IconPlus, IconBan, IconCloudUpload } from '@tabler/icons-react';
import { Trip, MultipleCatchFormData, CatchEntry, GPSCoordinate } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { formatTripDate } from '../../utils/formatters';
import { usePhotoHandling } from './hooks/usePhotoHandling';
import { uploadManager } from '../../utils/uploadManager';
import PayloadOptimizer from '../../utils/payloadOptimizer';
import DateSelector from './DateSelector';
import CatchEntryForm from './CatchEntryForm';
import CatchSummary from './CatchSummary';
import ModalShell from '../ModalShell';
import { useIsDarkMode } from '../../hooks/useIsDarkMode';
import NetworkStatus from '../NetworkStatus';

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
  const isDarkMode = useIsDarkMode();
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [optimizationWarning, setOptimizationWarning] = useState<string[]>([]);
  const [submissionInProgress, setSubmissionInProgress] = useState(false);

  // Check if this is a direct catch report (standalone trip)
  const isDirectCatch = trip.id.startsWith('standalone_');

  // Form state for multiple catches
  const [formData, setFormData] = useState<MultipleCatchFormData>(() => ({
    tripId: trip.id,
    date: isDirectCatch ? new Date() : new Date(trip.endTime),
    catches: [{
      id: `catch_${Date.now()}`,
      fishGroup: 'reef fish',
      quantity: 0,
      photos: [],
      gps_photo: []
    }],
    noCatch: false
  }));

  // GPS location state for direct catch reports
  const [gpsLocationEnabled, setGpsLocationEnabled] = useState(false);

  // Photo handling
  const addPhotoToCatch = (catchEntryId: string, base64Photo: string, gpsCoordinate?: GPSCoordinate) => {
    
    setFormData(prev => {
      const newData = {
        ...prev,
        catches: prev.catches.map(catchEntry => {
          if (catchEntry.id === catchEntryId) {
            const currentPhotos = catchEntry.photos || [];
            const currentGPSCoordinates = catchEntry.gps_photo || [];
            
            if (currentPhotos.length >= 3) {
              setError(t('catch.maxPhotosReached'));
              return catchEntry;
            }
            
            const updatedEntry = {
              ...catchEntry,
              photos: [...currentPhotos, base64Photo],
              gps_photo: gpsCoordinate ? [...currentGPSCoordinates, gpsCoordinate] : currentGPSCoordinates
            };
            
            return updatedEntry;
          }
          return catchEntry;
        })
      };
      
      return newData;
    });
    setError(null);
    setOptimizationWarning([]); // Clear optimization warnings when photos change
  };

  const removePhotoFromCatch = (catchEntryId: string, photoIndex: number) => {
    setFormData(prev => ({
      ...prev,
      catches: prev.catches.map(catchEntry => {
        if (catchEntry.id === catchEntryId) {
          const currentPhotos = catchEntry.photos || [];
          const currentGPSCoordinates = catchEntry.gps_photo || [];
          return {
            ...catchEntry,
            photos: currentPhotos.filter((_, index) => index !== photoIndex),
            gps_photo: currentGPSCoordinates.filter((_, index) => index !== photoIndex)
          };
        }
        return catchEntry;
      })
    }));
  };

  const photoHandling = usePhotoHandling({
    onError: setError,
    onPhotoAdd: addPhotoToCatch,
    onPhotoRemove: removePhotoFromCatch,
    gpsLocationEnabled
  });

  // Initialize camera support check
  useEffect(() => {
    photoHandling.checkCameraSupport();
  }, [photoHandling]);

  // Date selection for direct catch reports
  const handleDateSelection = (daysAgo: number) => {
    const selectedDate = new Date();
    selectedDate.setDate(selectedDate.getDate() - daysAgo);
    setFormData(prev => ({ ...prev, date: selectedDate }));
  };

  // Add a new catch entry
  const addCatchEntry = () => {
    setFormData(prev => ({
      ...prev,
      catches: [...prev.catches, {
        id: `catch_${Date.now()}`,
        fishGroup: 'reef fish',
        quantity: 0,
        photos: [],
        gps_photo: []
      }]
    }));
  };

  // Remove a catch entry
  const removeCatchEntry = (id: string) => {
    setFormData(prev => ({
      ...prev,
      catches: prev.catches.filter(catchEntry => catchEntry.id !== id)
    }));
  };

  // Update a specific catch entry
  const updateCatchEntry = (id: string, field: keyof CatchEntry, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      catches: prev.catches.map(catchEntry => 
        catchEntry.id === id 
          ? { ...catchEntry, [field]: value }
          : catchEntry
      )
    }));
  };

  // Toggle no catch option
  const toggleNoCatch = () => {
    setFormData(prev => ({
      ...prev,
      noCatch: !prev.noCatch,
      catches: prev.noCatch ? [{
        id: `catch_${Date.now()}`,
        fishGroup: 'reef fish',
        quantity: 0,
        photos: [],
        gps_photo: []
      }] : []
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (submissionInProgress) {
      console.log('🚫 Submission already in progress, ignoring duplicate');
      return;
    }

    // Validate user has an identifier
    const hasIdentifier = currentUser?.imeis?.[0] || currentUser?.username;
    if (!hasIdentifier) {
      setError(t('catch.errorNoImei'));
      return;
    }

    // Validate form data
    if (!formData.noCatch) {
      const validCatches = formData.catches.filter(catchEntry => catchEntry.quantity > 0);
      if (validCatches.length === 0) {
        setError(t('catch.errorNoValidCatches'));
        return;
      }
    }

    setSubmissionInProgress(true);
    setLoading(true);
    setError(null);
    setOptimizationWarning([]);

    try {
      // Optimize payload before submission
      const optimizedPayloads = PayloadOptimizer.optimizePayload(formData);
      const suggestions = PayloadOptimizer.getOptimizationSuggestions(formData);
      
      if (suggestions.length > 0) {
        setOptimizationWarning(suggestions);
      }

      
      // Always use the upload manager for consistency
      // This ensures a single, robust submission path
      await handleOptimizedOfflineSubmission(optimizedPayloads);
    } catch (err) {
      console.error('Error submitting catch report:', err);
      setError(err instanceof Error ? err.message : t('catch.errorSubmitting'));
    } finally {
      setLoading(false);
      setSubmissionInProgress(false);
    }
  };

  const handleOptimizedOfflineSubmission = async (optimizedPayloads: MultipleCatchFormData[]) => {
    try {
      const uploadIds: string[] = [];

      // Add each optimized payload to upload queue
      for (const payload of optimizedPayloads) {
        const id = await uploadManager.addUpload('catch', {
          ...payload,
          // Store imei and username separately based on user type
          imei: currentUser?.imeis?.[0] || null,
          username: currentUser?.username || null
          // Let uploadManager handle offline storage creation
        }, 1); // High priority

        uploadIds.push(id);
      }

      // Track upload IDs for monitoring
      
      // Check if we're truly offline or just had a network failure
      const isOnline = navigator.onLine;
      if (isOnline) {
        // We're online but submission failed (probably 413 error)
        // The upload manager will retry automatically
        setIsOfflineMode(false); // Don't show offline message
        setSuccess(true);
      } else {
        // We're truly offline
        setIsOfflineMode(true);
        setSuccess(true);
      }
      
      // Show success message indicating queued submission
      setTimeout(() => {
        onSuccess();
      }, 3000); // Slightly longer to show the queued message
    } catch (queueError) {
      throw new Error(`Failed to queue submission: ${queueError instanceof Error ? queueError.message : 'Unknown error'}`);
    }
  };


  if (success) {
    return (
      <ModalShell onClose={onClose} dismissible={false}>
            <div className="modal-body text-center p-4">
              <div className={`mb-3 ${isOfflineMode ? 'text-warning' : 'text-success'}`}>
                {isOfflineMode ? (
                  <IconCloudUpload size={48} />
                ) : (
                  <IconCheck size={48} />
                )}
              </div>
              <h3 className={isOfflineMode ? 'text-warning' : 'text-success'}>
                {isOfflineMode ? t('catch.reportQueued') : t('catch.reportSubmitted')}
              </h3>
              <p className="text-muted">
                {isOfflineMode ? 
                  t('catch.reportQueuedMessage') : 
                  t('catch.reportSubmittedMessage')
                }
              </p>
              {isOfflineMode && (
                <div className="mt-3">
                  <small className="text-muted d-flex align-items-center justify-content-center gap-2">
                    <span>{t('catch.offlineIndicator')}</span>
                    <span>{t('catch.willRetryWhenOnline')}</span>
                  </small>
                </div>
              )}
            </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      onClose={onClose}
      dialogClassName="modal-dialog-scrollable modal-xl modal-fullscreen-md-down"
      dismissible={false}
    >
          <div className="modal-header p-3 p-lg-4">
            <h3 className="modal-title">
              <IconFish className="me-2" size={24} />
              <span className="d-none d-sm-inline">{t('catch.reportCatch')}</span>
              <span className="d-sm-none">{t('catch.reportCatchButton')}</span>
            </h3>
            <button
              type="button"
              className="btn-close"
              onClick={onClose}
              disabled={loading}
              style={{ minWidth: '44px', minHeight: '44px' }}
            ></button>
          </div>

          <div className="modal-body p-3 p-lg-4">
            {/* Network Status */}
            <NetworkStatus compact={false} showDetails={true} />

            {/* Trip Information or Direct Catch Date Selection */}
            {isDirectCatch ? (
              <DateSelector 
                selectedDate={formData.date}
                onDateSelection={handleDateSelection}
              />
            ) : (
              <div className="mb-3 mb-lg-4">
                <div className="d-flex align-items-center text-muted small">
                  <IconCalendar size={16} className="me-2" />
                  <span>{formatTripDate(trip.endTime, t)}</span>
                  <span className="mx-2">•</span>
                  <span>{t('catch.tripIdLabel')} {trip.id.slice(0, 8)}...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="alert alert-danger mb-4">
                <div className="d-flex">
                  <div>
                    <IconAlertTriangle className="me-2" />
                  </div>
                  <div>{error}</div>
                </div>
              </div>
            )}

            {optimizationWarning.length > 0 && (
              <div className="alert alert-info mb-4">
                <div className="d-flex">
                  <div>
                    <IconAlertTriangle className="me-2" />
                  </div>
                  <div>
                    <strong>{t('catch.photoOptimization')}</strong>
                    <ul className="mb-0 mt-1">
                      {optimizationWarning.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="row g-3">
                {/* Left Column - Catch Options */}
                <div className="col-12 col-lg-8">
                  {/* No Catch Option */}
                  <div className="card mb-3 mb-lg-4">
                    <div className="card-body p-3 p-lg-4">
                      <div className="d-flex align-items-center justify-content-between">
                        <div className="flex-grow-1">
                          <label htmlFor="noCatchToggle" className="d-flex align-items-center mb-2 fw-bold" style={{ cursor: 'pointer' }}>
                            <IconBan className="me-2" size={20} />
                            {t('catch.noCatch')}
                          </label>
                          <p className="text-muted mb-0 small">{t('catch.reportNoCatchDescription')}</p>
                        </div>
                        <div className="form-check form-switch mb-0">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="noCatchToggle"
                            checked={formData.noCatch}
                            onChange={toggleNoCatch}
                            disabled={loading}
                            style={{ minWidth: '52px', minHeight: '28px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* GPS Location Option for Direct Catch Reports */}
                  {isDirectCatch && !formData.noCatch && (
                    <div className="card mb-3 mb-lg-4">
                      <div className="card-body p-3 p-lg-4">
                        <div className="d-flex align-items-center justify-content-between">
                          <div className="flex-grow-1">
                            <label htmlFor="gpsLocationToggle" className="d-flex align-items-center mb-2 fw-bold" style={{ cursor: 'pointer' }}>
                              <span className="me-2">📍</span>
                              {t('catch.photoLocationQuestion')}
                            </label>
                            <p className="text-muted mb-0 small">{t('catch.photoLocationDescription')}</p>
                          </div>
                          <div className="form-check form-switch mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id="gpsLocationToggle"
                              checked={gpsLocationEnabled}
                              onChange={(e) => setGpsLocationEnabled(e.target.checked)}
                              disabled={loading}
                              style={{ minWidth: '52px', minHeight: '28px' }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Multiple Catch Entries */}
                  {!formData.noCatch && (
                    <div className="card card-borderless shadow-sm border-primary" style={{ borderWidth: '2px' }}>
                      <div className="card-header bg-primary-lt">
                        <h3 className="card-title d-flex align-items-center text">
                          <IconFish className="me-2" size={20} />
                          <span className="d-none d-sm-inline">{t('catch.catchDetails')}</span>
                          <span className="d-sm-none">{t('catch.catches')}</span>
                        </h3>
                        <div className="card-actions">
                          <button
                            type="button"
                            className="btn btn-primary d-flex align-items-center"
                            onClick={addCatchEntry}
                            disabled={loading || formData.catches.length >= 5}
                            style={{ minHeight: '44px', fontSize: '15px' }}
                          >
                            <IconPlus size={18} className="me-2" />
                            <span className="d-none d-sm-inline">{t('catch.addFishGroup')}</span>
                            <span className="d-sm-none">{t('catch.addCatch')}</span>
                          </button>
                        </div>
                      </div>
                      <div className="card-body p-3 p-lg-4">
                        {formData.catches.map((catchEntry, index) => (
                          <CatchEntryForm
                            key={catchEntry.id}
                            catchEntry={catchEntry}
                            index={index}
                            totalCatches={formData.catches.length}
                            loading={loading}
                            isDarkMode={isDarkMode}
                            isDirectCatch={isDirectCatch}
                            fileInputRefs={photoHandling.fileInputRefs}
                            onUpdate={updateCatchEntry}
                            onRemove={removeCatchEntry}
                            onFileUpload={photoHandling.handleFileUpload}
                            onTriggerFileInput={photoHandling.triggerFileInput}
                            onRemovePhoto={photoHandling.removePhoto}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Summary and Upload Progress */}
                <div className="col-12 col-lg-4">
                  <CatchSummary
                    noCatch={formData.noCatch}
                    catches={formData.catches}
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>
            </form>
          </div>

          <div className="modal-footer p-3 d-flex gap-2">
            <button
              type="button"
              className="btn btn-secondary flex-fill"
              onClick={onClose}
              disabled={loading}
              style={{ minHeight: '48px', fontSize: '16px' }}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="btn btn-primary flex-fill"
              onClick={handleSubmit}
              disabled={loading || submissionInProgress || (!formData.noCatch && formData.catches.filter(c => c.quantity > 0).length === 0)}
              style={{ minHeight: '48px', fontSize: '16px' }}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  {t('common.loading')}...
                </>
              ) : (
                <>
                  <IconCheck className="me-2" size={18} />
                  {formData.noCatch ? t('catch.reportNoCatch') : t('catch.submitReport')}
                </>
              )}
            </button>
          </div>
    </ModalShell>
  );
};

export default ReportCatchForm;