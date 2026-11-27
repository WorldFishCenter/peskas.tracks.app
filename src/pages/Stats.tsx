import React, { useState, Suspense, lazy } from 'react';
import MainLayout from '../layouts/MainLayout';
import { useTranslation } from 'react-i18next';
import { subDays, differenceInDays } from 'date-fns';
import { BarChart3Icon, GaugeIcon } from 'lucide-react';
import StatsControls from '../components/stats/StatsControls';
import { formatDisplayDate } from '../utils/formatters';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CatchesTab = lazy(() => import('../components/stats/CatchesTab'));
const EfficiencyTab = lazy(() => import('../components/stats/EfficiencyTab'));

const Stats: React.FC = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<'catches' | 'efficiency'>('catches');
  const [dateFrom, setDateFrom] = useState<Date>(subDays(new Date(), 30));
  const [dateTo, setDateTo] = useState<Date>(new Date());
  const [compareWith, setCompareWith] = useState<'community' | 'previous'>('community');

  const handleDateChange = (from: Date, to: Date) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const handleCompareChange = (comparison: 'community' | 'previous') => {
    setCompareWith(comparison);
  };

  const pageHeader = (
    <div className="border-b bg-background print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t('dashboard.dateRange', {
            from: formatDisplayDate(dateFrom),
            to: formatDisplayDate(dateTo),
            days: differenceInDays(dateTo, dateFrom) + 1,
          })}
        </div>
        <h2 className="text-xl font-semibold tracking-tight">{t('stats.title')}</h2>
      </div>
    </div>
  );

  return (
    <MainLayout pageHeader={pageHeader}>
      <div className="flex flex-col gap-4">
        <StatsControls
          dateFrom={dateFrom}
          dateTo={dateTo}
          compareWith={compareWith}
          onDateChange={handleDateChange}
          onCompareChange={handleCompareChange}
        />

        <Card>
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'catches' | 'efficiency')}
          >
            <CardHeader className="border-b pb-3">
              <TabsList>
                <TabsTrigger value="catches">
                  <BarChart3Icon />
                  {t('stats.myCatches')}
                </TabsTrigger>
                <TabsTrigger value="efficiency">
                  <GaugeIcon />
                  {t('stats.myEfficiency')}
                </TabsTrigger>
              </TabsList>
            </CardHeader>

            <CardContent className="pt-4">
              <Suspense
                fallback={
                  <div className="flex justify-center py-8">
                    <Spinner className="size-6 text-primary" />
                  </div>
                }
              >
                <TabsContent value="catches">
                  <CatchesTab
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    compareWith={compareWith}
                  />
                </TabsContent>
                <TabsContent value="efficiency">
                  <EfficiencyTab
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    compareWith={compareWith}
                  />
                </TabsContent>
              </Suspense>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </MainLayout>
  );
};

export default Stats;
