import {
  FisherStatsResponse,
  FisherStatsParams,
  FisherPerformanceResponse,
  FisherPerformanceParams
} from '../types';
import i18n from '../i18n';
import { isDemoMode } from '../utils/demoData';
import { apiFetch } from './httpClient';
import { fetchDemoFisherStats, fetchDemoFisherPerformance } from './demoTracksService';

/**
 * Seam between fisher-stats consumers and how figures are obtained
 * (production HTTP endpoints, deterministic demo snapshot replay, or an
 * in-memory adapter in tests).
 */
export interface FisherStatsAdapter {
  fetchStats(params: FisherStatsParams): Promise<FisherStatsResponse>;
  fetchPerformance(params: FisherPerformanceParams): Promise<FisherPerformanceResponse>;
}

async function fetchJsonOrThrow<T>(
  path: string,
  params: { dateFrom?: Date; dateTo?: Date; compareWith?: string },
  errorKeys: { notFound: string; fallback: string }
): Promise<T> {
  const response = await apiFetch(path, {
    query: {
      dateFrom: params.dateFrom?.toISOString(),
      dateTo: params.dateTo?.toISOString(),
      compareWith: params.compareWith
    }
  });

  if (!response.ok) {
    let errorMessage = i18n.t(errorKeys.fallback, { status: response.status });

    if (response.status === 404) {
      errorMessage = i18n.t(errorKeys.notFound);
    } else if (response.status === 500) {
      errorMessage = i18n.t('api.serverError');
    } else {
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // Keep translated fallback when body is not JSON.
      }
    }

    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

export const httpFisherStatsAdapter: FisherStatsAdapter = {
  fetchStats: (params) =>
    fetchJsonOrThrow<FisherStatsResponse>(`/fisher-stats/${params.imei}`, params, {
      notFound: 'api.noStatsFound',
      fallback: 'api.failedToFetchStats'
    }),
  fetchPerformance: (params) =>
    fetchJsonOrThrow<FisherPerformanceResponse>(`/fisher-performance/${params.imei}`, params, {
      notFound: 'api.noPerformanceFound',
      fallback: 'api.failedToFetchPerformance'
    })
};

export const demoFisherStatsAdapter: FisherStatsAdapter = {
  fetchStats: (params) =>
    fetchDemoFisherStats(params.dateFrom, params.dateTo, params.compareWith === 'previous' ? 'previous' : 'community'),
  fetchPerformance: (params) =>
    fetchDemoFisherPerformance(params.dateFrom, params.dateTo, params.compareWith === 'previous' ? 'previous' : 'community')
};

const activeAdapter = (): FisherStatsAdapter =>
  isDemoMode() ? demoFisherStatsAdapter : httpFisherStatsAdapter;

export async function fetchFisherStats(params: FisherStatsParams): Promise<FisherStatsResponse> {
  return activeAdapter().fetchStats(params);
}

export async function fetchFisherPerformance(
  params: FisherPerformanceParams
): Promise<FisherPerformanceResponse> {
  return activeAdapter().fetchPerformance(params);
}
