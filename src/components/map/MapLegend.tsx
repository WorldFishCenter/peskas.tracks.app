import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPinIcon } from 'lucide-react';
import { viridisColorRange } from '../../utils/colors';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface MapLegendProps {
  showActivityGrid: boolean;
  hasTrackingDevice?: boolean;
}

const MapLegend: React.FC<MapLegendProps> = ({ showActivityGrid, hasTrackingDevice = true }) => {
  const { t } = useTranslation();

  if (!hasTrackingDevice || !showActivityGrid) return null;

  const gradient = viridisColorRange
    .map((color) => {
      const [r, g, b, a] = [...color, 255].slice(0, 4);
      return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(2)})`;
    })
    .join(', ');

  return (
    <Card
      size="sm"
      className="absolute right-2.5 bottom-16 z-10 w-36 bg-card/85 shadow-md backdrop-blur md:right-16 md:bottom-3 md:w-48"
    >
      <CardContent className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <MapPinIcon className="size-3.5 shrink-0 text-primary" />
          <span className="truncate text-xs font-semibold">{t('common.visitFrequency')}</span>
        </div>

        <div
          className="h-1.5 w-full rounded-full"
          style={{ background: `linear-gradient(to right, ${gradient})` }}
        />

        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            {t('common.few')}
          </Badge>
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {t('common.many')}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default MapLegend;
