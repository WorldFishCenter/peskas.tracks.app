import {
  FisherStatsResponse,
  FisherStatsParams,
  FisherPerformanceResponse,
  FisherPerformanceParams
} from '../types';
import i18n from '../i18n';
import { isDemoMode } from '../utils/demoData';
import { apiFetch } from './httpClient';

/**
 * Fetch fisher catch statistics
 * Returns summary, catch by type, recent trips, and comparison data
 */
export async function fetchFisherStats(params: FisherStatsParams): Promise<FisherStatsResponse> {
  // Check if we're in demo mode
  if (isDemoMode()) {
    console.log('Demo mode: generating dynamic mock fisher stats for date range');

    // Use provided dates or defaults
    const endDate = params.dateTo || new Date();
    const startDate = params.dateFrom || new Date(endDate.getTime() - 30 * 86400000);

    // Calculate days in range
    const daysInRange = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);

    // Generate trips based on period (roughly 1 trip every 3-4 days)
    const totalTrips = Math.max(1, Math.floor(daysInRange / 3.5));
    const successfulTrips = Math.max(1, Math.floor(totalTrips * 0.75));

    // Generate catch amounts based on successful trips
    const avgCatchPerSuccessfulTrip = 18 + Math.random() * 8; // 18-26 kg
    const totalCatch = successfulTrips * avgCatchPerSuccessfulTrip;
    const avgCatchPerTrip = totalCatch / totalTrips;

    // Generate time series data
    const timeSeries = [];
    const tripDates = [];
    for (let i = 0; i < Math.min(totalTrips, 15); i++) {
      const daysAgo = Math.floor((daysInRange / totalTrips) * i);
      const tripDate = new Date(endDate.getTime() - daysAgo * 86400000);
      tripDates.push(tripDate);

      const hasCatch = Math.random() > 0.25; // 75% success rate
      timeSeries.push({
        date: tripDate.toISOString().split('T')[0],
        catch_kg: hasCatch ? 15 + Math.random() * 35 : 0
      });
    }

    // Generate recent trips (last 3)
    const recentTrips = tripDates.slice(0, 3).map((date, i) => {
      const hasCatch = i !== 1; // Make middle one a no-catch
      const fishGroups = ['tuna/tuna-like', 'large pelagics', 'reef fish', 'small pelagics'];
      return {
        tripId: `demo-trip-${i + 1}`,
        date: date.toISOString(),
        catch_kg: hasCatch ? 15 + Math.random() * 35 : 0,
        fishGroup: hasCatch ? fishGroups[Math.floor(Math.random() * fishGroups.length)] : undefined
      };
    });

    // Generate catch by type distribution
    const catchByType = [
      { fishGroup: 'tuna/tuna-like', totalKg: totalCatch * 0.55, count: Math.floor(successfulTrips * 0.5) },
      { fishGroup: 'large pelagics', totalKg: totalCatch * 0.25, count: Math.floor(successfulTrips * 0.25) },
      { fishGroup: 'reef fish', totalKg: totalCatch * 0.15, count: Math.floor(successfulTrips * 0.2) },
      { fishGroup: 'small pelagics', totalKg: totalCatch * 0.05, count: Math.floor(successfulTrips * 0.05) }
    ].filter(item => item.totalKg > 0);

    // Generate comparison data based on type
    const comparisonType = params.compareWith || 'community';
    const comparison = comparisonType === 'community'
      ? {
          type: 'community' as const,
          avgCatch: avgCatchPerTrip * (0.85 + Math.random() * 0.2), // ±15% variance
          avgSuccessRate: 0.65 + Math.random() * 0.15, // 65-80%
          basedOn: '15 fishers in your community',
          hasData: true
        }
      : {
          type: 'previous' as const,
          avgCatch: avgCatchPerTrip * (0.9 + Math.random() * 0.15), // ±10% variance
          avgSuccessRate: 0.7 + Math.random() * 0.1, // 70-80%
          basedOn: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
          hasData: true
        };

    return {
      summary: {
        totalCatch: parseFloat(totalCatch.toFixed(1)),
        totalTrips,
        successfulTrips,
        successRate: successfulTrips / totalTrips,
        avgCatchPerTrip: parseFloat(avgCatchPerTrip.toFixed(1))
      },
      catchByType,
      recentTrips,
      timeSeries: timeSeries.reverse(), // Most recent first
      comparison
    };
  }

  try {
    const response = await apiFetch(`/fisher-stats/${params.imei}`, {
      query: {
        dateFrom: params.dateFrom?.toISOString(),
        dateTo: params.dateTo?.toISOString(),
        compareWith: params.compareWith
      }
    });

    if (!response.ok) {
      let errorMessage = i18n.t('api.failedToFetchStats', { status: response.status });

      if (response.status === 404) {
        errorMessage = i18n.t('api.noStatsFound');
      } else if (response.status === 500) {
        errorMessage = i18n.t('api.serverError');
      } else {
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If we can't parse the error response, use the default message
        }
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching fisher stats:', error);
    throw error;
  }
}

/**
 * Fetch fisher performance metrics
 * Returns trip types, efficiency metrics, best trips, and comparison data
 */
export async function fetchFisherPerformance(params: FisherPerformanceParams): Promise<FisherPerformanceResponse> {
  // Check if we're in demo mode
  if (isDemoMode()) {
    console.log('Demo mode: generating dynamic mock fisher performance for date range');

    // Use provided dates or defaults
    const endDate = params.dateTo || new Date();
    const startDate = params.dateFrom || new Date(endDate.getTime() - 30 * 86400000);
    const daysInRange = Math.ceil((endDate.getTime() - startDate.getTime()) / 86400000);

    // Generate trip counts based on period
    const totalTrips = Math.max(1, Math.floor(daysInRange / 3.5));
    const offshoreCount = Math.floor(totalTrips * 0.35);
    const midRangeCount = Math.floor(totalTrips * 0.45);
    const nearshoreCount = Math.max(1, totalTrips - offshoreCount - midRangeCount);

    // Generate performance metrics with variation
    const yourCPUE = 3.5 + Math.random() * 2.5; // 3.5-6.0 kg/hr
    const comparisonCPUE = yourCPUE * (0.8 + Math.random() * 0.3); // ±20% variance

    const yourFuel = 2.0 + Math.random() * 0.8; // 2.0-2.8 kg/L
    const comparisonFuel = yourFuel * (0.9 + Math.random() * 0.2); // ±15% variance

    const yourSearch = 0.3 + Math.random() * 0.15; // 0.30-0.45
    const comparisonSearch = 0.35 + Math.random() * 0.15; // 0.35-0.50

    // Generate best trips within date range
    const bestTrips = [];
    if (totalTrips >= 1) {
      bestTrips.push({
        tripId: 'demo-trip-best-1',
        cpue: yourCPUE * 1.4,
        date: new Date(endDate.getTime() - (daysInRange * 0.3) * 86400000).toISOString(),
        tripType: 'offshore' as const
      });
    }
    if (totalTrips >= 2) {
      bestTrips.push({
        tripId: 'demo-trip-best-2',
        cpue: yourCPUE * 1.1,
        date: new Date(endDate.getTime() - (daysInRange * 0.6) * 86400000).toISOString(),
        tripType: 'mid-range' as const
      });
    }

    // Generate comparison data based on type
    const comparisonType = params.compareWith || 'community';
    const comparison = comparisonType === 'community'
      ? {
          type: 'community' as const,
          basedOn: '15 fishers in your community'
        }
      : {
          type: 'previous' as const,
          basedOn: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
        };

    return {
      tripTypes: {
        offshore: { count: offshoreCount, avgCatch: 30 + Math.random() * 15 },
        'mid-range': { count: midRangeCount, avgCatch: 20 + Math.random() * 10 },
        nearshore: { count: nearshoreCount, avgCatch: 12 + Math.random() * 8 }
      },
      metrics: {
        cpue_kg_per_hour: {
          yourAvg: parseFloat(yourCPUE.toFixed(1)),
          comparisonAvg: parseFloat(comparisonCPUE.toFixed(1)),
          percentDiff: Math.round(((yourCPUE - comparisonCPUE) / comparisonCPUE) * 100)
        },
        kg_per_liter: {
          yourAvg: parseFloat(yourFuel.toFixed(1)),
          comparisonAvg: parseFloat(comparisonFuel.toFixed(1)),
          percentDiff: Math.round(((yourFuel - comparisonFuel) / comparisonFuel) * 100)
        },
        search_ratio: {
          yourAvg: parseFloat(yourSearch.toFixed(2)),
          comparisonAvg: parseFloat(comparisonSearch.toFixed(2)),
          percentDiff: Math.round(((yourSearch - comparisonSearch) / comparisonSearch) * 100)
        }
      },
      bestTrips,
      comparison
    };
  }

  try {
    const response = await apiFetch(`/fisher-performance/${params.imei}`, {
      query: {
        dateFrom: params.dateFrom?.toISOString(),
        dateTo: params.dateTo?.toISOString(),
        compareWith: params.compareWith
      }
    });

    if (!response.ok) {
      let errorMessage = i18n.t('api.failedToFetchPerformance', { status: response.status });

      if (response.status === 404) {
        errorMessage = i18n.t('api.noPerformanceFound');
      } else if (response.status === 500) {
        errorMessage = i18n.t('api.serverError');
      } else {
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // If we can't parse the error response, use the default message
        }
      }

      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching fisher performance:', error);
    throw error;
  }
}
