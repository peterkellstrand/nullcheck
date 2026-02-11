'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useTokensStore } from '@/stores/tokens';

interface PriceUpdate {
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
}

interface SSEMessage {
  type: 'connected' | 'prices' | 'error';
  updates?: Record<string, PriceUpdate>;
  message?: string;
  timestamp: number;
}

interface UsePriceStreamOptions {
  enabled?: boolean;
  onUpdate?: (updates: Record<string, PriceUpdate>) => void;
}

export function usePriceStream(options: UsePriceStreamOptions = {}) {
  const { enabled = true, onUpdate } = options;
  const { updatePrices } = useTokensStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const url = '/api/stream';

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data);

          if (message.type === 'connected') {
            setIsConnected(true);
            setError(null);
          } else if (message.type === 'prices' && message.updates) {
            // Update all prices in the store
            updatePrices(message.updates);
            // Call optional callback
            onUpdate?.(message.updates);
          } else if (message.type === 'error') {
            setError(message.message || 'Stream error');
          }
        } catch (e) {
          console.error('Failed to parse SSE message:', e);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setError('Connection lost');
        eventSource.close();

        // Attempt to reconnect after 5 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          if (enabled) {
            connect();
          }
        }, 5000);
      };
    } catch (e) {
      setError('Failed to connect');
      setIsConnected(false);
    }
  }, [enabled, updatePrices, onUpdate]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    error,
    connect,
    disconnect,
  };
}
