import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  DropletIcon,
  GaugeIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TrophyIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { useFisherPerformance } from '../../hooks/useFisherStats';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

interface EfficiencyTabProps {
  dateFrom: Date;
  dateTo: Date;
  compareWith: 'community' | 'previous';
}

const EfficiencyTab: React.FC<EfficiencyTabProps> = ({ dateFrom, dateTo, compareWith }) => {
  const { t } = useTranslation();
  const { performance, loading, error } = useFisherPerformance(dateFrom, dateTo, compareWith);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
        <Spinner className="size-6 text-primary" />
        <p className="text-sm">{t('stats.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t('stats.error')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!performance) {
    return (
      <Alert>
        <AlertTitle>{t('stats.noData')}</AlertTitle>
        <AlertDescription>{t('stats.tryDifferentPeriod')}</AlertDescription>
      </Alert>
    );
  }

  const { metrics, tripTypes, bestTrips, comparison } = performance;

  const hasPerformanceData =
    bestTrips.length > 0 && Object.values(tripTypes).some((data) => data && data.count > 0);

  const getComparisonLabel = () => {
    if (comparison.type === 'community') {
      return t('stats.comparison.community');
    }
    return comparison.basedOn || t('stats.comparison.lastPeriod');
  };

  const getNoDataMessage = () => {
    if (comparison.type === 'community') {
      return t('stats.comparison.noCommunityData');
    }
    return `${t('stats.comparison.noDataIn')} ${comparison.basedOn}`;
  };

  if (!hasPerformanceData) {
    return (
      <Alert>
        <AlertTitle>{t('stats.performance.noData')}</AlertTitle>
        <AlertDescription>{t('stats.performance.noDataMessage')}</AlertDescription>
      </Alert>
    );
  }

  const totalTrips = Object.values(tripTypes).reduce((sum, data) => sum + (data?.count || 0), 0);

  const renderMetricCard = (
    icon: React.ReactNode,
    title: string,
    description: string,
    yourAvg: number,
    comparisonAvg: number,
    percentDiff: number,
    lowerIsBetter: boolean = false
  ) => {
    const isGood = lowerIsBetter ? percentDiff < 0 : percentDiff > 0;
    const isBad = lowerIsBetter ? percentDiff > 0 : percentDiff < 0;

    return (
      <Card>
        <CardHeader className="flex-row items-center gap-2.5">
          {icon}
          <div className="flex flex-col gap-0.5">
            <CardTitle className="text-sm">{title}</CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="text-3xl font-bold tabular-nums">{yourAvg.toFixed(2)}</div>

          {comparison.basedOn &&
          comparison.basedOn.length > 0 &&
          comparison.basedOn !== '0' &&
          comparison.hasData !== false ? (
            <div className="flex items-center gap-1 text-xs">
              {isGood ? (
                <>
                  <TrendingUpIcon className="size-4 text-primary" />
                  <span className="text-primary">
                    +{Math.abs(percentDiff)}% vs {getComparisonLabel()}
                  </span>
                </>
              ) : isBad ? (
                <>
                  <TrendingDownIcon className="size-4 text-destructive" />
                  <span className="text-destructive">
                    {Math.abs(percentDiff)}% vs {getComparisonLabel()}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">{t('stats.comparison.same')}</span>
              )}
            </div>
          ) : comparison.basedOn && comparison.basedOn.length > 0 ? (
            <div className="text-xs text-muted-foreground">{getNoDataMessage()}</div>
          ) : (
            <div className="text-xs text-muted-foreground">{t('stats.noComparisonData')}</div>
          )}

          {comparison.basedOn && comparison.basedOn.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {t('stats.comparison.yourAvg')}: {yourAvg.toFixed(2)} |{' '}
              {t('stats.comparison.comparison', { type: comparison.type })}:{' '}
              {comparisonAvg.toFixed(2)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const validBestTrips = bestTrips.filter((trip) => trip.cpue > 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Performance Metrics */}
      <div className="flex flex-col gap-3">
        <h4 className="text-base font-semibold">{t('stats.performance.title')}</h4>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {renderMetricCard(
            <GaugeIcon className="size-6 text-primary" />,
            t('stats.performance.cpue'),
            t('stats.performance.cpueDesc'),
            metrics.cpue_kg_per_hour.yourAvg,
            metrics.cpue_kg_per_hour.comparisonAvg,
            metrics.cpue_kg_per_hour.percentDiff
          )}
          {renderMetricCard(
            <DropletIcon className="size-6 text-primary" />,
            t('stats.performance.fuelEfficiency'),
            t('stats.performance.fuelDesc'),
            metrics.kg_per_liter.yourAvg,
            metrics.kg_per_liter.comparisonAvg,
            metrics.kg_per_liter.percentDiff
          )}
        </div>
      </div>

      {/* Trip Types & Best Trips */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('stats.performance.tripTypes')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {Object.entries(tripTypes).map(([type, data]) => {
              if (!data || data.count === 0) return null;

              const typeLabel =
                type === 'mid-range'
                  ? t('stats.performance.midRange')
                  : t(`stats.performance.${type}`);

              const percentage = totalTrips > 0 ? (data.count / totalTrips) * 100 : 0;

              return (
                <div key={type} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize">{typeLabel}</span>
                    <span className="font-semibold tabular-nums">
                      {data.count} {t('stats.summary.trips')} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <Progress value={percentage} />
                  <div className="text-xs text-muted-foreground">
                    {data.avgCatch > 0
                      ? `${t('stats.summary.avgCatch')}: ${data.avgCatch.toFixed(1)} ${t('stats.summary.kg')}`
                      : t('stats.noCatchesYet')}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrophyIcon className="size-5 text-primary" />
              {t('stats.performance.bestTrips')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {validBestTrips.length > 0 ? (
              <div className="flex flex-col gap-3">
                {validBestTrips.map((trip, index) => (
                  <div key={index} className="flex flex-col gap-3">
                    {index > 0 && <Separator />}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(trip.date), 'MMM dd, yyyy')}
                        </div>
                        <div className="text-sm capitalize">{trip.tripType}</div>
                      </div>
                      <Badge variant="secondary">
                        {trip.cpue.toFixed(1)} {t('stats.performance.cpueDesc')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('stats.performance.noData')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Comparison Info */}
      {comparison.basedOn && comparison.basedOn.length > 0 && comparison.basedOn !== '0' && (
        <Alert>
          <AlertDescription>
            <strong className="text-foreground">
              {comparison.type === 'community'
                ? t('stats.comparison.comparedTo')
                : t('stats.comparison.comparedToPrevious')}
              :
            </strong>{' '}
            {comparison.basedOn}
            {comparison.hasData === false && ` - ${t('stats.comparison.noData')}`}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default EfficiencyTab;
