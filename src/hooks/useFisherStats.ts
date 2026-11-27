import { useState, useEffect, useCallback } from 'react';
import { FisherStatsResponse, FisherPerformanceResponse } from '../types';
import { fetchFisherStats, fetchFisherPerformance } from '../api/fisherStatsService';
import { useAuth } from '../contexts/AuthContext';

type CompareWith = 'community' | 'previous';

interface FisherQueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Shared loader for fisher stats and efficiency views. Resolves the fisher's
 * identifier once (IMEI for device-tracked fishers, username for
 * self-registered fishers) and manages loading/error state uniformly.
 */
function useFisherQuery<T>(
  loader: (params: { imei: string; dateFrom?: Date; dateTo?: Date; compareWith: CompareWith }) => Promise<T>,
  fallbackError: string,
  dateFrom?: Date,
  dateTo?: Date,
  compareWith: CompareWith = 'community'
): FisherQueryState<T> {
  const { currentUser } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currentUser) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // For device-tracked fishers use IMEI; for self-registered fishers use username.
    const identifier =
      currentUser.imeis && currentUser.imeis.length > 0
        ? currentUser.imeis[0]
        : currentUser.username;

    if (!identifier) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await loader({ imei: identifier, dateFrom, dateTo, compareWith });
      setData(result);
    } catch (err) {
      console.error(fallbackError, err);
      setError(err instanceof Error ? err.message : fallbackError);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [currentUser, loader, fallbackError, dateFrom, dateTo, compareWith]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export const useFisherStats = (
  dateFrom?: Date,
  dateTo?: Date,
  compareWith: CompareWith = 'community'
) => {
  const { data, loading, error, refetch } = useFisherQuery<FisherStatsResponse>(
    fetchFisherStats,
    'Failed to load catch statistics',
    dateFrom,
    dateTo,
    compareWith
  );
  return { stats: data, loading, error, refetch };
};

export const useFisherPerformance = (
  dateFrom?: Date,
  dateTo?: Date,
  compareWith: CompareWith = 'community'
) => {
  const { data, loading, error, refetch } = useFisherQuery<FisherPerformanceResponse>(
    fetchFisherPerformance,
    'Failed to load performance metrics',
    dateFrom,
    dateTo,
    compareWith
  );
  return { performance: data, loading, error, refetch };
};
