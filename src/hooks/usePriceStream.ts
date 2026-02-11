'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { ChainId } from '@/types/chain';
import { useTokensStore } from '@/stores/tokens';

interface PriceUpdate {
  tokenAddress: string;
  chainId: ChainId;
  price: number;
  priceChange24h: number;
  volume24h: number;
  timestamp: number;
}

interface UsePriceStreamOptions {
  chainId?: ChainId;
  tokenAddresses?: string[];
  enabled?: boolean;
  onUpdate?: (update: PriceUpdate) => void;
}

export function usePriceStream(options: UsePriceStreamOptions = {}) {
  const { chainId, tokenAddresses = [], enabled = true, onUpdate } = options;
  const { updateToken } = useTokensStore();
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!enabled) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const params = new URLSearchParams();
    if (chainId) params.set('chain', chainId);
    if (tokenAddresses.length > 0) {
      params.set('tokens', tokenAddresses.join(','));
    }

    const url = `/api/stream?${params}`;

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onmessage = (event) => {
        try {
          const update: PriceUpdate = JSON.parse(event.data);

          // Update the token in the store
          updateToken(update.tokenAddress, update.chainId, {
            metrics: {
              tokenAddress: update.tokenAddress,
              chainId: update.chainId,
              price: update.price,
              priceChange24h: update.priceChange24h,
              volume24h: update.volume24h,
              priceChange1h: 0, // Would need additional data
              priceChange7d: 0,
              liquidity: 0,
              updatedAt: new Date(update.timestamp).toISOString(),
            },
          });

          // Call optional callback
          onUpdate?.(update);
        } catch (e) {
          console.error('Failed to parse SSE message:', e);
        }
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setError('Connection lost');

        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          if (enabled) {
            connect();
          }
        }, 5000);
      };
    } catch (e) {
      setError('Failed to connect');
      setIsConnected(false);
    }
  }, [enabled, chainId, tokenAddresses, updateToken, onUpdate]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
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
