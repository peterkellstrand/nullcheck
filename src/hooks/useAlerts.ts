'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { PriceAlert, CreateAlertRequest } from '@/types/alert';

interface UseAlertsReturn {
  alerts: PriceAlert[];
  isLoading: boolean;
  error: string | null;
  createAlert: (request: CreateAlertRequest) => Promise<{ success: boolean; error?: string; limitReached?: boolean }>;
  deleteAlert: (id: string) => Promise<{ success: boolean }>;
  refetch: () => Promise<void>;
  activeAlertCount: number;
}

export function useAlerts(): UseAlertsReturn {
  const { isAuthenticated } = useAuth();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!isAuthenticated) {
      setAlerts([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/alerts');
      const data = await response.json();

      if (data.success && data.data?.alerts) {
        setAlerts(data.data.alerts);
      } else {
        setError(data.error || 'Failed to fetch alerts');
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError('Failed to fetch alerts');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const createAlert = useCallback(
    async (request: CreateAlertRequest): Promise<{ success: boolean; error?: string; limitReached?: boolean }> => {
      if (!isAuthenticated) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const response = await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        });
        const data = await response.json();

        if (data.success && data.data?.alert) {
          // Add to local state
          setAlerts((prev) => [data.data.alert, ...prev]);
          return { success: true };
        }

        if (data.error === 'LIMIT_REACHED') {
          return { success: false, error: 'Limit reached', limitReached: true };
        }

        return { success: false, error: data.error || 'Failed to create alert' };
      } catch (err) {
        console.error('Error creating alert:', err);
        return { success: false, error: 'Failed to create alert' };
      }
    },
    [isAuthenticated]
  );

  const deleteAlert = useCallback(
    async (id: string): Promise<{ success: boolean }> => {
      if (!isAuthenticated) {
        return { success: false };
      }

      // Optimistic update
      const previousAlerts = alerts;
      setAlerts((prev) => prev.filter((a) => a.id !== id));

      try {
        const response = await fetch(`/api/alerts/${id}`, {
          method: 'DELETE',
        });
        const data = await response.json();

        if (!data.success) {
          // Rollback
          setAlerts(previousAlerts);
          return { success: false };
        }

        return { success: true };
      } catch (err) {
        // Rollback
        setAlerts(previousAlerts);
        console.error('Error deleting alert:', err);
        return { success: false };
      }
    },
    [isAuthenticated, alerts]
  );

  const activeAlertCount = alerts.filter((a) => !a.isTriggered).length;

  return {
    alerts,
    isLoading,
    error,
    createAlert,
    deleteAlert,
    refetch: fetchAlerts,
    activeAlertCount,
  };
}
