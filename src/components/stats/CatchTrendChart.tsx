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
  ChartDataset
} from 'chart.js';

// Register Chart.js components
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
  date: string; // ISO date string YYYY-MM-DD
  catch_kg: number;
}

interface CatchTrendChartProps {
  data: TimeSeriesPoint[];
  comparisonAvg?: number;
  comparisonType?: 'community' | 'previous';
  comparisonLabel?: string; // For previous period, this will be the date range
  comparisonHasData?: boolean; // Indicates if comparison has data
}

const CatchTrendChart: React.FC<CatchTrendChartProps> = ({ data, comparisonAvg, comparisonType, comparisonLabel, comparisonHasData }) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;

    // Get Tabler CSS variable values
    const getTablerColor = (varName: string): string => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim() || '#206bc4';
    };

    const successColor = getTablerColor('--tblr-success');
    const mutedColor = getTablerColor('--tblr-muted');

    // Destroy existing chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Filter data to only show catches (no zero bars)
    const catchData = data.filter(point => point.catch_kg > 0);

    // Prepare datasets
    const datasets: ChartDataset<'bar' | 'line', number[]>[] = [
      {
        type: 'bar',
        data: catchData.map(point => point.catch_kg),
        backgroundColor: `${successColor}cc`,
        borderColor: successColor,
        borderWidth: 1,
        borderRadius: 4,
        maxBarThickness: 50,
        order: 2
      }
    ];

    // Add comparison line if available
    if (comparisonAvg && comparisonAvg > 0) {
      datasets.push({
        type: 'line',
        data: catchData.map(() => comparisonAvg),
        borderColor: mutedColor,
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        order: 1
      });
    }

    // Create chart configuration
    const config: ChartConfiguration<'bar' | 'line', number[], string> = {
      type: 'bar',
      data: {
        labels: catchData.map(point => format(parseISO(point.date), 'MMM dd')),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: mutedColor,
            bodyColor: '#1e293b',
            borderColor: '#e2e8f0',
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
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: mutedColor,
              font: {
                size: 11
              }
            },
            grid: {
              display: false
            }
          },
          x: {
            ticks: {
              color: mutedColor,
              font: {
                size: 11
              },
              maxRotation: 45,
              minRotation: 45
            },
            grid: {
              display: false
            }
          }
        }
      }
    };

    // Create new chart
    chartRef.current = new Chart(canvasRef.current, config);

    // Cleanup
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [data, comparisonAvg, t]);

  // Handle empty data
  if (!data || data.length === 0) {
    return (
      <div className="alert alert-info mb-0">
        <div className="text-center py-4">
          <p className="mb-1">{t('stats.chart.noData')}</p>
          <p className="text-muted small mb-0">{t('stats.chart.startReporting')}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ height: '250px', position: 'relative' }}>
        <canvas ref={canvasRef}></canvas>
      </div>
      {((comparisonAvg !== undefined && comparisonAvg > 0) || (comparisonType && comparisonHasData === false && comparisonLabel)) && (
        <div className="text-center mt-2">
          <span className="text-muted small">
            {comparisonAvg !== undefined && comparisonAvg > 0 && (
              <span style={{
                display: 'inline-block',
                width: '20px',
                height: '2px',
                background: `repeating-linear-gradient(to right, currentColor 0, currentColor 5px, transparent 5px, transparent 10px)`,
                verticalAlign: 'middle',
                marginRight: '6px'
              }}></span>
            )}
            {comparisonHasData === false && comparisonLabel
              ? `${comparisonLabel}: ${t('stats.comparison.noData')}`
              : comparisonType === 'community'
                ? `${t('stats.chart.communityAvg')}: ${comparisonAvg?.toFixed(1)} kg`
                : comparisonLabel
                  ? `${comparisonLabel}: ${comparisonAvg?.toFixed(1)} kg`
                  : `${t('stats.chart.previousAvg')}: ${comparisonAvg?.toFixed(1)} kg`
            }
          </span>
        </div>
      )}
    </div>
  );
};

export default CatchTrendChart;
