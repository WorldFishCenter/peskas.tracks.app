import React, { useState } from 'react';
import {
  AnchorIcon,
  BatteryIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  InfoIcon,
  MapPinnedIcon,
  SailboatIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import { LiveLocation } from '../../types';
import { getBatteryBadgeVariant } from '../../utils/colors';
import { formatCoordinates, formatLocationTime } from '../../utils/formatters';
import { anonymizeBoatName, anonymizeText, isDemoMode } from '../../utils/demoData';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Separator } from '@/components/ui/separator';

interface VesselDetailsPanelProps {
  liveLocations: LiveLocation[];
  onCenterOnLiveLocations: () => void;
}

const VesselDetailsPanel: React.FC<VesselDetailsPanelProps> = ({
  liveLocations,
  onCenterOnLiveLocations,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const renderBody = () => {
    if (liveLocations.length === 0) {
      return (
        <Empty className="py-6">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <InfoIcon />
            </EmptyMedia>
            <EmptyTitle>{t('dashboard.noData')}</EmptyTitle>
            <EmptyDescription>{t('dashboard.noDataMessage')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {liveLocations.map((location, index) => (
          <div key={location.imei || index} className="flex flex-col gap-3">
            {index > 0 && <Separator />}

            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {anonymizeBoatName(location.boatName || 'Unknown Vessel')}
                </div>
                {location.directCustomerName && (
                  <div className="truncate text-xs text-muted-foreground">
                    {anonymizeText(location.directCustomerName, 'Demo Community')}
                  </div>
                )}
              </div>
              {location.batteryState && (
                <Badge variant={getBatteryBadgeVariant(location.batteryState)}>
                  <BatteryIcon data-icon="inline-start" />
                  {location.batteryState}
                </Badge>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {!isDemoMode() && (
                <div className="flex items-center gap-2">
                  <MapPinnedIcon className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-muted-foreground">{t('vessel.coordinates')}</div>
                    <div className="font-mono text-xs font-semibold">
                      {formatCoordinates(location.lat, location.lng)}
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center gap-2">
                <ClockIcon className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground">{t('vessel.lastPosition')}</div>
                  <div className="text-sm font-semibold">
                    {location.lastGpsTs
                      ? formatLocationTime(location.lastGpsTs, location.timezone)
                      : 'Never'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card size="sm">
      {/* Mobile: Collapsible */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="md:hidden">
        <CollapsibleTrigger
          render={
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between px-3 py-1 text-left font-medium transition-colors',
                isExpanded && 'text-primary'
              )}
            />
          }
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <AnchorIcon className="size-4 text-primary" />
            {t('dashboard.vesselDetails')}
          </span>
          {isExpanded ? (
            <ChevronUpIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="max-h-[480px] overflow-y-auto pt-3">
            {renderBody()}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Desktop: Always visible */}
      <div className="hidden max-h-[480px] overflow-y-auto md:flex md:flex-col md:gap-3">
        <CardHeader className="items-center">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AnchorIcon className="size-4 text-primary" />
            {t('dashboard.vesselDetails')}
          </CardTitle>
          <CardAction>
            <Button
              variant="destructive"
              size="sm"
              onClick={onCenterOnLiveLocations}
              title={t('dashboard.centerOnLiveLocations')}
            >
              <SailboatIcon data-icon="inline-start" />
              {t('dashboard.liveLocation')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>{renderBody()}</CardContent>
      </div>
    </Card>
  );
};

export default VesselDetailsPanel;
