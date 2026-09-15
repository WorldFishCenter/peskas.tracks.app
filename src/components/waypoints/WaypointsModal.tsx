import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IconMapPin, IconX, IconTrash, IconCurrentLocation, IconClick, IconEye } from '@tabler/icons-react';
import { Waypoint, WaypointFormData, WaypointType, GPSCoordinate } from '../../types';
import { getAllWaypointTypeConfigs } from '../../utils/waypointConfig';
import { useIsDarkMode } from '../../hooks/useIsDarkMode';
import ModalShell from '../ModalShell';

interface WaypointsModalProps {
  waypoints: Waypoint[];
  onSave: (data: WaypointFormData) => Promise<void>;
  onDelete: (waypointId: string) => Promise<void>;
  onClose: () => void;
  deviceLocation?: GPSCoordinate | null;
  onGetMyLocation?: () => void;
  isGettingLocation?: boolean;
  selectedMapCoordinates?: { lat: number; lng: number } | null;
  onRequestMapClick?: () => void;
  onToggleWaypoint?: (waypointId: string) => void;
  onToggleAllWaypoints?: (visible: boolean) => void;
  onShowWaypointOnMap?: (waypoint: Waypoint) => void;
}

type TabType = 'add' | 'list';

const WaypointsModal: React.FC<WaypointsModalProps> = ({
  waypoints,
  onSave,
  onDelete,
  onClose,
  deviceLocation,
  onGetMyLocation,
  isGettingLocation = false,
  selectedMapCoordinates,
  onRequestMapClick,
  onToggleWaypoint,
  onToggleAllWaypoints,
  onShowWaypointOnMap
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('add');

  // Form state
  const [name, setName] = useState('');
  const [type, setType] = useState<WaypointType>('favorite_spot');
  const [description, setDescription] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDarkMode = useIsDarkMode();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const visibleCount = waypoints.filter(wp => wp.visible !== false).length;

  // Update coordinates when selectedMapCoordinates prop changes
  useEffect(() => {
    if (selectedMapCoordinates) {
      setCoordinates(selectedMapCoordinates);
      setActiveTab('add'); // Switch to add tab when coordinates are selected
    }
  }, [selectedMapCoordinates]);

  const handleUseCurrentGPS = () => {
    if (deviceLocation) {
      setCoordinates({ lat: deviceLocation.latitude, lng: deviceLocation.longitude });
    } else if (onGetMyLocation) {
      onGetMyLocation();
    }
  };

  // Auto-populate GPS coordinates only when:
  // 1. deviceLocation is available (from "Get My Location" button)
  // 2. No coordinates are currently set
  // 3. No map coordinates were passed from drag-map mode (selectedMapCoordinates takes precedence)
  useEffect(() => {
    if (deviceLocation && !coordinates && !selectedMapCoordinates) {
      setCoordinates({ lat: deviceLocation.latitude, lng: deviceLocation.longitude });
    }
  }, [deviceLocation, coordinates, selectedMapCoordinates]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError(t('waypoints.errors.nameRequired'));
      return;
    }

    if (!coordinates) {
      setError(t('waypoints.errors.locationRequired'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData: WaypointFormData = {
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        coordinates
      };

      await onSave(formData);

      // Reset form
      setName('');
      setDescription('');
      setCoordinates(null);
      setType('favorite_spot');

      // Switch to list tab to show the new waypoint
      setActiveTab('list');
    } catch (err) {
      console.error('Error saving waypoint:', err);
      setError(err instanceof Error ? err.message : t('waypoints.errors.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (waypointId: string) => {
    if (!window.confirm(t('waypoints.list.deleteConfirm'))) {
      return;
    }

    setDeletingId(waypointId);
    try {
      await onDelete(waypointId);
    } catch (err) {
      console.error('Error deleting waypoint:', err);
      alert(t('waypoints.errors.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  // Get waypoint type configurations from centralized config
  const waypointTypeConfigs = getAllWaypointTypeConfigs();
  const waypointTypes = waypointTypeConfigs.map(config => ({
    value: config.value,
    label: t(config.labelKey),
    icon: config.icon,
    color: config.colorClass,
    colorHex: config.colorHex
  }));

  return (
    <ModalShell
      onClose={onClose}
      dialogClassName="modal-lg modal-dialog-scrollable"
      dismissible={!isSubmitting}
    >
            {/* Header */}
            <div className="modal-header">
              <h5 className="modal-title">
                <IconMapPin className="me-2" size={24} />
                {t('waypoints.title')}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={onClose}
                aria-label={t('common.close')}
              />
            </div>

            {/* Tabs */}
            <div className="card-tabs">
              <ul className="nav nav-tabs" role="tablist">
                <li className="nav-item" role="presentation">
                  <button
                    className={`nav-link ${activeTab === 'add' ? 'active' : ''}`}
                    onClick={() => setActiveTab('add')}
                    type="button"
                    role="tab"
                  >
                    <IconMapPin className="me-2" size={18} />
                    {t('waypoints.tabs.add')}
                  </button>
                </li>
                <li className="nav-item" role="presentation">
                  <button
                    className={`nav-link ${activeTab === 'list' ? 'active' : ''}`}
                    onClick={() => setActiveTab('list')}
                    type="button"
                    role="tab"
                  >
                    {t('waypoints.tabs.list')}
                    {waypoints.length > 0 && (
                      <span className="badge ms-2">{waypoints.length}</span>
                    )}
                  </button>
                </li>
              </ul>
            </div>

            {/* Tab Content */}
            <div className="modal-body">
              {/* Add Waypoint Tab */}
              {activeTab === 'add' && (
                <form onSubmit={handleSubmit}>
                  {/* Error message */}
                  {error && (
                    <div className="alert alert-danger" role="alert">
                      <div className="d-flex align-items-center">
                        <IconX className="me-2" size={20} />
                        <div>{error}</div>
                      </div>
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="alert alert-info mb-3">
                    <div className="d-flex align-items-start">
                      <IconClick className="me-2 mt-1" size={20} />
                      <div>
                        <strong>{t('waypoints.form.instructionsTitle')}</strong>
                        <ol className="mb-0 mt-2 ps-3">
                          <li>{t('waypoints.form.instructionsGPS')}</li>
                          <li>{t('waypoints.form.instructionsMap')}</li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  {/* Location Selection */}
                  <div className="mb-3">
                    <label className="form-label required">{t('waypoints.form.locationLabel')}</label>
                    <div className="btn-group w-100 mb-2">
                      <button
                        type="button"
                        className="btn btn-outline-primary"
                        onClick={handleUseCurrentGPS}
                        disabled={isGettingLocation}
                      >
                        {isGettingLocation ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" />
                            {t('waypoints.form.gettingGps')}
                          </>
                        ) : (
                          <>
                            <IconCurrentLocation className="me-2" size={18} />
                            {t('waypoints.form.useGps')}
                          </>
                        )}
                      </button>
                      {onRequestMapClick && (
                        <button
                          type="button"
                          className="btn btn-outline-success"
                          onClick={onRequestMapClick}
                        >
                          <IconClick className="me-2" size={18} />
                          {t('waypoints.form.clickOnMap')}
                        </button>
                      )}
                    </div>
                    {coordinates ? (
                      <div className="card bg-success-lt">
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="text-start">
                              <div className="text-muted small">{t('waypoints.form.latitude')}</div>
                              <div className="h4 mb-0">{coordinates.lat.toFixed(6)}</div>
                            </div>
                            <div className="text-start">
                              <div className="text-muted small">{t('waypoints.form.longitude')}</div>
                              <div className="h4 mb-0">{coordinates.lng.toFixed(6)}</div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost-danger"
                              onClick={() => setCoordinates(null)}
                            >
                              {t('waypoints.form.clear')}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="card bg-secondary-lt">
                        <div className="card-body p-3 text-center text-muted">
                          <IconMapPin size={24} className="mb-2" />
                          <div>{t('waypoints.form.noLocationSelectedTitle')}</div>
                          <small>{t('waypoints.form.noLocationSelectedSubtitle')}</small>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Name field */}
                  <div className="mb-3">
                    <label className="form-label required">{t('waypoints.form.nameLabel')}</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={t('waypoints.form.namePlaceholder')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <small className="form-hint">{t('waypoints.form.nameHint')}</small>
                  </div>

                  {/* Type field */}
                  <div className="mb-3">
                    <label className="form-label required">{t('waypoints.form.typeLabel')}</label>
                    <select
                      className="form-select"
                      value={type}
                      onChange={(e) => setType(e.target.value as WaypointType)}
                      required
                    >
                      {waypointTypes.map(wt => (
                        <option key={wt.value} value={wt.value}>
                          {wt.label}
                        </option>
                      ))}
                    </select>
                    <small className="form-hint">{t('waypoints.form.typeHint')}</small>
                  </div>

                  {/* Description field */}
                  <div className="mb-3">
                    <label className="form-label">{t('waypoints.form.descriptionLabel')}</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder={t('waypoints.form.descriptionPlaceholder')}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <small className="form-hint">{t('waypoints.form.descriptionHint')}</small>
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={isSubmitting || !name.trim() || !coordinates}
                  >
                    {isSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        {t('waypoints.form.saving')}
                      </>
                    ) : (
                      <>
                        <IconMapPin className="me-2" size={18} />
                        {t('waypoints.form.saveButton')}
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Waypoints List Tab */}
              {activeTab === 'list' && (
                <div>
                  {waypoints.length === 0 ? (
                    <div className="empty py-5">
                      <div className="empty-icon">
                        <IconMapPin size={48} className="text-muted" />
                      </div>
                      <p className="empty-title">{t('waypoints.list.emptyTitle')}</p>
                      <p className="empty-subtitle text-muted">
                        {t('waypoints.list.emptySubtitle', { tab: t('waypoints.tabs.add') })}
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Waypoints List Header with Bulk Controls */}
                      <div className="card-header">
                        <h3 className="card-title">
                          {t('waypoints.list.title')}
                          <span className="badge badge-pill ms-2">
                            {t('waypoints.list.countLabel', { visible: visibleCount, total: waypoints.length })}
                          </span>
                        </h3>
                        <div className="card-actions">
                          {onToggleAllWaypoints && (
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                const allVisible = waypoints.every(wp => wp.visible !== false);
                                onToggleAllWaypoints(!allVisible);
                              }}
                            >
                              {waypoints.every(wp => wp.visible !== false)
                                ? t('waypoints.hideAll')
                                : t('waypoints.showAll')}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Waypoints List */}
                      <div className="list-group list-group-flush">
                        {waypoints.map((waypoint) => {
                          const typeInfo = waypointTypes.find(t => t.value === waypoint.type) || waypointTypes[3];
                          const createdDate = waypoint.createdAt ? new Date(waypoint.createdAt) : null;
                          const formattedDate = createdDate ? createdDate.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          }) : null;

                          return (
                            <div
                              key={waypoint._id}
                              className="list-group-item"
                            >
                              {/* Mobile-optimized layout */}
                              <div className="d-flex align-items-start gap-3">
                                {/* Visibility Toggle */}
                                {onToggleWaypoint && waypoint._id && (
                                  <div className="pt-1">
                                    <label className="form-check form-switch mb-0">
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={waypoint.visible !== false}
                                        onChange={() => onToggleWaypoint(waypoint._id!)}
                                        title={t('waypoints.toggleVisibility')}
                                      />
                                    </label>
                                  </div>
                                )}

                                {/* Icon */}
                                <div className="pt-1">
                                  <i className={`ti ${typeInfo.icon} ${typeInfo.color}`} style={{ fontSize: '1.75rem' }}></i>
                                </div>

                                {/* Content - takes remaining space */}
                                <div className="flex-fill">
                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div className="flex-fill">
                                      <div className="fw-bold mb-1">{waypoint.name}</div>
                                      <div className="d-flex flex-wrap gap-2 align-items-center">
                                        {/* Colored badge with type name */}
                                        <span
                                          className="badge"
                                          style={{
                                            backgroundColor: typeInfo.colorHex,
                                            color: 'white',
                                            fontWeight: 500
                                          }}
                                        >
                                          {typeInfo.label}
                                        </span>
                                        {formattedDate && (
                                          <span className="text-muted small">
                                            <i className="ti ti-calendar me-1"></i>
                                            {formattedDate}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="text-secondary small mb-2">
                                    <i className="ti ti-map-pin me-1"></i>
                                    <span className="font-monospace">{waypoint.coordinates.lat.toFixed(4)}, {waypoint.coordinates.lng.toFixed(4)}</span>
                                  </div>

                                  {waypoint.description && (
                                    <div className="text-secondary small mb-2">
                                      {waypoint.description}
                                    </div>
                                  )}

                                  {/* Action Buttons - Full width on mobile */}
                                  <div className="d-flex gap-2 mt-2">
                                    {/* Show on Map Button */}
                                    {onShowWaypointOnMap && (
                                      <button
                                        className="btn btn-primary flex-fill"
                                        onClick={() => onShowWaypointOnMap(waypoint)}
                                        style={{ minHeight: '44px' }}
                                      >
                                        <IconEye size={20} className="me-2" />
                                        <span>{t('waypoints.showOnMap')}</span>
                                      </button>
                                    )}
                                    {/* Delete Button */}
                                    {waypoint._id && (
                                      <button
                                        className="btn btn-outline-danger"
                                        onClick={() => handleDelete(waypoint._id!)}
                                        disabled={deletingId === waypoint._id}
                                        title={t('waypoints.panel.delete')}
                                        style={{ minHeight: '44px', minWidth: '44px' }}
                                      >
                                        {deletingId === waypoint._id ? (
                                          <span className="spinner-border spinner-border-sm" />
                                        ) : (
                                          <IconTrash size={20} />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
              >
                {t('common.close')}
              </button>
            </div>
    </ModalShell>
  );
};

export default WaypointsModal;
