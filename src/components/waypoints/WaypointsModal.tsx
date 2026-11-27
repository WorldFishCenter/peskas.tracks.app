import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CalendarIcon,
  CrosshairIcon,
  EyeIcon,
  MapPinIcon,
  MousePointerClickIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import { Waypoint, WaypointFormData, WaypointType, GPSCoordinate } from '../../types';
import { getAllWaypointTypeConfigs } from '../../utils/waypointConfig';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

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
  onShowWaypointOnMap,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<TabType>('add');

  const [name, setName] = useState('');
  const [type, setType] = useState<WaypointType>('favorite_spot');
  const [description, setDescription] = useState('');
  const [coordinates, setCoordinates] = useState<{ lat: number; lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const visibleCount = waypoints.filter((wp) => wp.visible !== false).length;

  useEffect(() => {
    if (selectedMapCoordinates) {
      setCoordinates(selectedMapCoordinates);
      setActiveTab('add');
    }
  }, [selectedMapCoordinates]);

  const handleUseCurrentGPS = () => {
    if (deviceLocation) {
      setCoordinates({ lat: deviceLocation.latitude, lng: deviceLocation.longitude });
    } else if (onGetMyLocation) {
      onGetMyLocation();
    }
  };

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
        coordinates,
      };

      await onSave(formData);

      setName('');
      setDescription('');
      setCoordinates(null);
      setType('favorite_spot');
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

  const waypointTypeConfigs = getAllWaypointTypeConfigs();
  const waypointTypes = waypointTypeConfigs.map((config) => ({
    value: config.value,
    label: t(config.labelKey),
    icon: config.icon,
    colorHex: config.colorHex,
  }));

  const typeSelectItems = waypointTypes.map((wt) => ({
    value: wt.value,
    label: wt.label,
  }));

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPinIcon className="size-5 text-primary" />
            {t('waypoints.title')}
          </DialogTitle>
          <DialogDescription className="sr-only">{t('waypoints.title')}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabType)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="w-full">
            <TabsTrigger value="add">
              <MapPinIcon />
              {t('waypoints.tabs.add')}
            </TabsTrigger>
            <TabsTrigger value="list">
              {t('waypoints.tabs.list')}
              {waypoints.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {waypoints.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            {/* Add Waypoint Tab */}
            <TabsContent value="add">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                  <Alert variant="destructive">
                    <XIcon />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <MousePointerClickIcon className="text-primary" />
                  <AlertTitle>{t('waypoints.form.instructionsTitle')}</AlertTitle>
                  <AlertDescription>
                    <ol className="mt-1 flex list-decimal flex-col gap-1 pl-4">
                      <li>{t('waypoints.form.instructionsGPS')}</li>
                      <li>{t('waypoints.form.instructionsMap')}</li>
                    </ol>
                  </AlertDescription>
                </Alert>

                <FieldGroup>
                  {/* Location Selection */}
                  <Field>
                    <FieldLabel>{t('waypoints.form.locationLabel')} *</FieldLabel>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={handleUseCurrentGPS}
                        disabled={isGettingLocation}
                      >
                        {isGettingLocation ? (
                          <>
                            <Spinner data-icon="inline-start" />
                            {t('waypoints.form.gettingGps')}
                          </>
                        ) : (
                          <>
                            <CrosshairIcon data-icon="inline-start" />
                            {t('waypoints.form.useGps')}
                          </>
                        )}
                      </Button>
                      {onRequestMapClick && (
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1"
                          onClick={onRequestMapClick}
                        >
                          <MousePointerClickIcon data-icon="inline-start" />
                          {t('waypoints.form.clickOnMap')}
                        </Button>
                      )}
                    </div>

                    {coordinates ? (
                      <Card size="sm" className="bg-muted/40">
                        <CardContent className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-xs text-muted-foreground">
                              {t('waypoints.form.latitude')}
                            </div>
                            <div className="font-mono text-sm font-semibold">
                              {coordinates.lat.toFixed(6)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">
                              {t('waypoints.form.longitude')}
                            </div>
                            <div className="font-mono text-sm font-semibold">
                              {coordinates.lng.toFixed(6)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setCoordinates(null)}
                          >
                            {t('waypoints.form.clear')}
                          </Button>
                        </CardContent>
                      </Card>
                    ) : (
                      <Card size="sm" className="bg-muted/50">
                        <CardContent className="flex flex-col items-center gap-1 py-2 text-center text-muted-foreground">
                          <MapPinIcon className="size-5" />
                          <div className="text-sm font-medium text-foreground">
                            {t('waypoints.form.noLocationSelectedTitle')}
                          </div>
                          <div className="text-xs">
                            {t('waypoints.form.noLocationSelectedSubtitle')}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </Field>

                  {/* Name field */}
                  <Field>
                    <FieldLabel htmlFor="waypoint-name">
                      {t('waypoints.form.nameLabel')} *
                    </FieldLabel>
                    <Input
                      id="waypoint-name"
                      type="text"
                      placeholder={t('waypoints.form.namePlaceholder')}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                    <FieldDescription>{t('waypoints.form.nameHint')}</FieldDescription>
                  </Field>

                  {/* Type field */}
                  <Field>
                    <FieldLabel>{t('waypoints.form.typeLabel')} *</FieldLabel>
                    <Select
                      items={typeSelectItems}
                      value={type}
                      onValueChange={(v) => {
                        if (v) setType(v as WaypointType);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {waypointTypes.map((wt) => (
                            <SelectItem key={wt.value} value={wt.value}>
                              {wt.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FieldDescription>{t('waypoints.form.typeHint')}</FieldDescription>
                  </Field>

                  {/* Description field */}
                  <Field>
                    <FieldLabel htmlFor="waypoint-description">
                      {t('waypoints.form.descriptionLabel')}
                    </FieldLabel>
                    <Textarea
                      id="waypoint-description"
                      rows={2}
                      placeholder={t('waypoints.form.descriptionPlaceholder')}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                    <FieldDescription>{t('waypoints.form.descriptionHint')}</FieldDescription>
                  </Field>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting || !name.trim() || !coordinates}
                  >
                    {isSubmitting ? (
                      <>
                        <Spinner data-icon="inline-start" />
                        {t('waypoints.form.saving')}
                      </>
                    ) : (
                      <>
                        <MapPinIcon data-icon="inline-start" />
                        {t('waypoints.form.saveButton')}
                      </>
                    )}
                  </Button>
                </FieldGroup>
              </form>
            </TabsContent>

            {/* Waypoints List Tab */}
            <TabsContent value="list">
              {waypoints.length === 0 ? (
                <Empty className="py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MapPinIcon />
                    </EmptyMedia>
                    <EmptyTitle>{t('waypoints.list.emptyTitle')}</EmptyTitle>
                    <EmptyDescription>
                      {t('waypoints.list.emptySubtitle', { tab: t('waypoints.tabs.add') })}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{t('waypoints.list.title')}</h3>
                      <Badge variant="secondary">
                        {t('waypoints.list.countLabel', {
                          visible: visibleCount,
                          total: waypoints.length,
                        })}
                      </Badge>
                    </div>
                    {onToggleAllWaypoints && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const allVisible = waypoints.every((wp) => wp.visible !== false);
                          onToggleAllWaypoints(!allVisible);
                        }}
                      >
                        {waypoints.every((wp) => wp.visible !== false)
                          ? t('waypoints.hideAll')
                          : t('waypoints.showAll')}
                      </Button>
                    )}
                  </div>

                  <Separator />

                  <div className="flex flex-col gap-3">
                    {waypoints.map((waypoint, index) => {
                      const typeInfo =
                        waypointTypes.find((wt) => wt.value === waypoint.type) || waypointTypes[3];
                      const TypeIcon = typeInfo.icon;
                      const createdDate = waypoint.createdAt ? new Date(waypoint.createdAt) : null;
                      const formattedDate = createdDate
                        ? createdDate.toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : null;

                      return (
                        <div key={waypoint._id} className="flex flex-col gap-3">
                          {index > 0 && <Separator />}
                          <div className="flex items-start gap-3">
                            {onToggleWaypoint && waypoint._id && (
                              <div className="pt-1">
                                <Switch
                                  checked={waypoint.visible !== false}
                                  onCheckedChange={() => onToggleWaypoint(waypoint._id!)}
                                  aria-label={t('waypoints.toggleVisibility')}
                                />
                              </div>
                            )}

                            <div className="pt-0.5">
                              <TypeIcon
                                className="size-6 shrink-0"
                                style={{ color: typeInfo.colorHex }}
                              />
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col gap-2">
                              <div>
                                <div className="font-semibold">{waypoint.name}</div>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <Badge variant="secondary">
                                    <span
                                      className="size-2 rounded-full"
                                      style={{ backgroundColor: typeInfo.colorHex }}
                                    />
                                    {typeInfo.label}
                                  </Badge>
                                  {formattedDate && (
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <CalendarIcon className="size-3.5" />
                                      {formattedDate}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                                <MapPinIcon className="size-3.5" />
                                <span>
                                  {waypoint.coordinates.lat.toFixed(4)},{' '}
                                  {waypoint.coordinates.lng.toFixed(4)}
                                </span>
                              </div>

                              {waypoint.description && (
                                <p className="text-xs text-muted-foreground">
                                  {waypoint.description}
                                </p>
                              )}

                              <div className="flex gap-2">
                                {onShowWaypointOnMap && (
                                  <Button
                                    className="h-10 flex-1"
                                    onClick={() => onShowWaypointOnMap(waypoint)}
                                  >
                                    <EyeIcon data-icon="inline-start" />
                                    {t('waypoints.showOnMap')}
                                  </Button>
                                )}
                                {waypoint._id && (
                                  <Button
                                    variant="destructive"
                                    size="icon"
                                    className="size-10"
                                    onClick={() => handleDelete(waypoint._id!)}
                                    disabled={deletingId === waypoint._id}
                                    title={t('waypoints.panel.delete')}
                                    aria-label={t('waypoints.panel.delete')}
                                  >
                                    {deletingId === waypoint._id ? <Spinner /> : <Trash2Icon />}
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WaypointsModal;
