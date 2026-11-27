import React, { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { FishIcon, LineChartIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { useFisherStats } from '../../hooks/useFisherStats';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';

const CatchTrendChart = lazy(() => import('./CatchTrendChart'));

interface CatchesTabProps {
  dateFrom: Date;
  dateTo: Date;
  compareWith: 'community' | 'previous';
}

const CatchesTab: React.FC<CatchesTabProps> = ({ dateFrom, dateTo, compareWith }) => {
  const { t } = useTranslation();
  const { stats, loading, error } = useFisherStats(dateFrom, dateTo, compareWith);

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

  if (!stats) {
    return (
      <Alert>
        <AlertTitle>{t('stats.noData')}</AlertTitle>
        <AlertDescription>{t('stats.tryDifferentPeriod')}</AlertDescription>
      </Alert>
    );
  }

  const { summary, catchByType, timeSeries, comparison } = stats;

  if (summary.totalTrips === 0) {
    return (
      <Alert>
        <AlertTitle>{t('stats.noTripsYet')}</AlertTitle>
        <AlertDescription>{t('stats.keepFishing')}</AlertDescription>
      </Alert>
    );
  }

  const successRateDiff = summary.successRate - comparison.avgSuccessRate;
  const catchDiff = summary.avgCatchPerTrip - comparison.avgCatch;
  const hasComparisonData = Boolean(comparison.basedOn && comparison.basedOn.length > 0);

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

  return (
    <div className="flex flex-col gap-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card size="sm">
          <CardContent className="flex h-full flex-col gap-1">
            <div className="text-xs text-muted-foreground">{t('stats.summary.totalCatch')}</div>
            <div className="text-2xl font-bold tabular-nums">{summary.totalCatch.toFixed(1)}</div>
            <div className="mt-auto text-xs text-muted-foreground">{t('stats.summary.kg')}</div>
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="flex h-full flex-col gap-1">
            <div className="text-xs text-muted-foreground">{t('stats.summary.avgCatch')}</div>
            <div className="text-2xl font-bold tabular-nums">
              {summary.avgCatchPerTrip.toFixed(1)}
            </div>
            {hasComparisonData && comparison.hasData !== false ? (
              <div className="mt-auto flex items-center gap-1 text-xs">
                {catchDiff > 0 ? (
                  <>
                    <TrendingUpIcon className="size-3.5 shrink-0 text-primary" />
                    <span className="text-primary">
                      +{catchDiff.toFixed(1)} {t('stats.catchByType.kg')}{' '}
                      {t('stats.comparison.vs')} {getComparisonLabel()}
                    </span>
                  </>
                ) : catchDiff < 0 ? (
                  <>
                    <TrendingDownIcon className="size-3.5 shrink-0 text-destructive" />
                    <span className="text-destructive">
                      {catchDiff.toFixed(1)} {t('stats.catchByType.kg')} {t('stats.comparison.vs')}{' '}
                      {getComparisonLabel()}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">{t('stats.comparison.same')}</span>
                )}
              </div>
            ) : hasComparisonData ? (
              <div className="mt-auto text-xs text-muted-foreground">{getNoDataMessage()}</div>
            ) : (
              <div className="mt-auto text-xs">&nbsp;</div>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="flex h-full flex-col gap-1">
            <div className="text-xs text-muted-foreground">{t('stats.summary.successRate')}</div>
            <div className="text-2xl font-bold tabular-nums">
              {(summary.successRate * 100).toFixed(0)}%
            </div>
            {hasComparisonData && comparison.hasData !== false ? (
              <div className="mt-auto flex items-center gap-1 text-xs">
                {successRateDiff > 0 ? (
                  <>
                    <TrendingUpIcon className="size-3.5 shrink-0 text-primary" />
                    <span className="text-primary">
                      +{(successRateDiff * 100).toFixed(0)}% {t('stats.comparison.vs')}{' '}
                      {getComparisonLabel()}
                    </span>
                  </>
                ) : successRateDiff < 0 ? (
                  <>
                    <TrendingDownIcon className="size-3.5 shrink-0 text-destructive" />
                    <span className="text-destructive">
                      {(successRateDiff * 100).toFixed(0)}% {t('stats.comparison.vs')}{' '}
                      {getComparisonLabel()}
                    </span>
                  </>
                ) : (
                  <span className="text-muted-foreground">{t('stats.comparison.same')}</span>
                )}
              </div>
            ) : hasComparisonData ? (
              <div className="mt-auto text-xs text-muted-foreground">{getNoDataMessage()}</div>
            ) : (
              <div className="mt-auto text-xs">&nbsp;</div>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardContent className="flex h-full flex-col gap-1">
            <div className="text-xs text-muted-foreground">{t('stats.summary.totalTrips')}</div>
            <div className="text-2xl font-bold tabular-nums">{summary.totalTrips}</div>
            <div className="mt-auto text-xs text-muted-foreground">{t('stats.summary.trips')}</div>
          </CardContent>
        </Card>
      </div>

      {/* Catch by Type & Trend Chart */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FishIcon className="size-5 text-primary" />
              {t('stats.catchByType.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {catchByType.length > 0 ? (
              <div className="flex flex-col gap-4">
                {catchByType.map((item, index) => {
                  const pct = summary.totalCatch > 0 ? (item.totalKg / summary.totalCatch) * 100 : 0;
                  return (
                    <div key={index} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span>
                          {t(
                            `catches.fishGroups.${item.fishGroup.toLowerCase().replace(/\s+/g, '').replace(/\//g, '')}`
                          )}
                        </span>
                        <span className="font-semibold tabular-nums">
                          {item.totalKg.toFixed(1)} {t('stats.catchByType.kg')} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <Progress value={pct} />
                      <div className="text-xs text-muted-foreground">
                        {item.count} {t('stats.catchByType.catches')}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('stats.catchByType.noData')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChartIcon className="size-5 text-primary" />
              {t('stats.chart.title')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense
              fallback={
                <div className="flex justify-center py-8">
                  <Spinner className="size-6 text-primary" />
                </div>
              }
            >
              <CatchTrendChart
                data={timeSeries}
                comparisonAvg={
                  hasComparisonData && comparison.hasData !== false
                    ? comparison.avgCatch
                    : undefined
                }
                comparisonType={hasComparisonData ? comparison.type : undefined}
                comparisonLabel={
                  hasComparisonData
                    ? comparison.type === 'community'
                      ? undefined
                      : comparison.basedOn
                    : undefined
                }
                comparisonHasData={hasComparisonData ? comparison.hasData : undefined}
              />
            </Suspense>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Info */}
      {hasComparisonData && comparison.basedOn !== '0' && comparison.basedOn !== '' && (
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

export default CatchesTab;
