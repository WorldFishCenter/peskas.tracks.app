import React, { useState } from 'react';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ClockIcon,
  LineChartIcon,
  RouteIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from 'cn';
import { VesselInsights } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

interface VesselInsightsPanelProps {
  insights: VesselInsights;
  tripsCount: number;
}

const VesselInsightsPanel: React.FC<VesselInsightsPanelProps> = ({ insights, tripsCount }) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  const insightsContent = (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <RouteIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{t('insights.totalTrips')}</div>
          <div className="text-xs text-muted-foreground">
            {tripsCount} {t('common.total')} ({insights.activeTrips} {t('vessel.active')})
          </div>
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <ClockIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{t('insights.averageSpeed')}</div>
          <div className="text-xs text-muted-foreground">{insights.avgSpeed} km/h</div>
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
          <RouteIcon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{t('insights.totalDistance')}</div>
          <div className="text-xs text-muted-foreground">{insights.totalDistance} km</div>
        </div>
      </div>
    </div>
  );

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
            <LineChartIcon className="size-4 text-primary" />
            {t('dashboard.vesselInsights')}
          </span>
          {isExpanded ? (
            <ChevronUpIcon className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="size-4 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-3">{insightsContent}</CardContent>
        </CollapsibleContent>
      </Collapsible>

      {/* Desktop: Always visible */}
      <div className="hidden md:flex md:flex-col md:gap-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <LineChartIcon className="size-4 text-primary" />
            {t('dashboard.vesselInsights')}
          </CardTitle>
        </CardHeader>
        <CardContent>{insightsContent}</CardContent>
      </div>
    </Card>
  );
};

export default VesselInsightsPanel;
