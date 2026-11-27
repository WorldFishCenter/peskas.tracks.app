import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Tooltip,
  ChartConfiguration,
  ChartDataset,
} from 'chart.js';
import { useTheme } from '@/components/theme-provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Tooltip
);

interface TimeSeriesPoint {
  date: string;
  catch_kg: number;
}

interface CatchTrendChartProps {
  data: TimeSeriesPoint[];
  comparisonAvg?: number;
  comparisonType?: 'community' | 'previous';
  comparisonLabel?: string;
  comparisonHasData?: boolean;
}

const CatchTrendChart: React.FC<CatchTrendChartProps> = ({
  data,
  comparisonAvg,
  comparisonType,
  comparisonLabel,
  comparisonHasData,
}) => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;

    const getToken = (varName: string, fallback: string): string =>
      getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;

    const barColor = getToken('--chart-4', '#0891b2');
    const mutedColor = getToken('--muted-foreground', '#71717a');
    const popoverBg = getToken('--popover', '#ffffff');
    const popoverFg = getToken('--popover-foreground', '#09090b');
    const borderColor = getToken('--border', '#e4e4e7');

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const catchData = data.filter((point) => point.catch_kg > 0);

    const datasets: ChartDataset<'bar' | 'line', number[]>[] = [
      {
        type: 'bar',
        data: catchData.map((point) => point.catch_kg),
        backgroundColor: barColor,
        borderColor: barColor,
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: 50,
        order: 2,
      },
    ];

    if (comparisonAvg && comparisonAvg > 0) {
      datasets.push({
        type: 'line',
        data: catchData.map(() => comparisonAvg),
        borderColor: mutedColor,
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        order: 1,
      });
    }

    const config: ChartConfiguration<'bar' | 'line', number[], string> = {
      type: 'bar',
      data: {
        labels: catchData.map((point) => format(parseISO(point.date), 'MMM dd')),
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: popoverBg,
            titleColor: mutedColor,
            bodyColor: popoverFg,
            borderColor,
            borderWidth: 1,
            padding: 12,
            displayColors: false,
            callbacks: {
              title: (context) => {
                const index = context[0].dataIndex;
                return format(parseISO(catchData[index].date), 'MMMM dd, yyyy');
              },
              label: (context) => {
                const value = context.parsed.y ?? 0;
                return `${value.toFixed(1)} ${t('stats.summary.kg')}`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: mutedColor, font: { size: 11 } },
            grid: { display: false },
          },
          x: {
            ticks: {
              color: mutedColor,
              font: { size: 11 },
              maxRotation: 45,
              minRotation: 45,
            },
            grid: { display: false },
          },
        },
      },
    };

    chartRef.current = new Chart(canvasRef.current, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, comparisonAvg, t, isDarkMode]);

  if (!data || data.length === 0) {
    return (
      <Alert className="text-center">
        <AlertTitle>{t('stats.chart.noData')}</AlertTitle>
        <AlertDescription>{t('stats.chart.startReporting')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-64">
        <canvas ref={canvasRef} />
      </div>
      {((comparisonAvg !== undefined && comparisonAvg > 0) ||
        (comparisonType && comparisonHasData === false && comparisonLabel)) && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          {comparisonAvg !== undefined && comparisonAvg > 0 && (
            <span
              className="inline-block h-0.5 w-5"
              style={{
                background:
                  'repeating-linear-gradient(to right, currentColor 0, currentColor 5px, transparent 5px, transparent 10px)',
              }}
            />
          )}
          <span>
            {comparisonHasData === false && comparisonLabel
              ? `${comparisonLabel}: ${t('stats.comparison.noData')}`
              : comparisonType === 'community'
                ? `${t('stats.chart.communityAvg')}: ${comparisonAvg?.toFixed(1)} kg`
                : comparisonLabel
                  ? `${comparisonLabel}: ${comparisonAvg?.toFixed(1)} kg`
                  : `${t('stats.chart.previousAvg')}: ${comparisonAvg?.toFixed(1)} kg`}
          </span>
        </div>
      )}
    </div>
  );
};

export default CatchTrendChart;
