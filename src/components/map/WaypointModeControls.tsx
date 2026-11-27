import React from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface WaypointModeControlsProps {
  coordinates: { lat: number; lng: number } | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const WaypointModeControls: React.FC<WaypointModeControlsProps> = ({
  coordinates,
  onCancel,
  onConfirm,
}) => {
  const { t } = useTranslation();

  const formatCoordinate = (value: number): string => value.toFixed(3);

  return (
    <>
      {/* Instruction badge */}
      <div className="absolute bottom-16 left-2.5 z-10">
        <Badge variant="secondary" className="bg-card/90 shadow-sm backdrop-blur">
          {t('waypoints.dragToSelect', 'Drag map to select waypoint location')}
        </Badge>
      </div>

      {/* Control bar */}
      <div className="absolute right-16 bottom-2.5 left-2.5 z-10 flex items-center gap-1.5 rounded-xl border bg-card/95 p-1 shadow-md backdrop-blur">
        {coordinates && (
          <Input
            type="text"
            value={`${formatCoordinate(coordinates.lat)}, ${formatCoordinate(coordinates.lng)}`}
            readOnly
            className="h-9 flex-1 font-mono text-xs"
          />
        )}
        <Button
          type="button"
          className="h-9 shrink-0"
          onClick={onConfirm}
        >
          <span className="hidden sm:inline">
            {t('waypoints.saveLocation', 'Save Location')}
          </span>
          <span className="sm:hidden">Save</span>
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="h-9 shrink-0"
          onClick={onCancel}
        >
          <XIcon data-icon="inline-start" />
          <span className="hidden sm:inline">{t('common.cancel', 'Cancel')}</span>
        </Button>
      </div>
    </>
  );
};

export default WaypointModeControls;
