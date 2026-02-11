'use client';

import { useQuery } from '@tanstack/react-query';
import { TokenWithMetrics } from '@/types/token';
import { ChainId } from '@/types/chain';
import { useTokensStore } from '@/stores/tokens';

interface UseTokensOptions {
  chainId?: ChainId;
  limit?: number;
  enabled?: boolean;
}

async function fetchTokens(chainId?: ChainId, limit: number = 100): Promise<TokenWithMetrics[]> {
  const params = new URLSearchParams();
  if (chainId) params.set('chain', chainId);
  params.set('limit', limit.toString());

  const response = await fetch(`/api/tokens?${params}`);

  if (!response.ok) {
    throw new Error('Failed to fetch tokens');
  }

  const data = await response.json();
  return data.tokens;
}

export function useTokens(options: UseTokensOptions = {}) {
  const { chainId, limit = 100, enabled = true } = options;
  const { setTokens, setLoading, setError } = useTokensStore();

  const query = useQuery({
    queryKey: ['tokens', chainId, limit],
    queryFn: () => fetchTokens(chainId, limit),
    enabled,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 15000, // Consider data stale after 15 seconds
  });

  // Sync with store
  if (query.data) {
    setTokens(query.data);
  }
  if (query.isLoading) {
    setLoading(true);
  } else {
    setLoading(false);
  }
  if (query.error) {
    setError(query.error.message);
  }

  return {
    tokens: query.data ?? [],
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useToken(chainId: ChainId, address: string) {
  return useQuery({
    queryKey: ['token', chainId, address],
    queryFn: async () => {
      const response = await fetch(`/api/tokens/${chainId}/${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch token');
      }
      return response.json() as Promise<TokenWithMetrics>;
    },
    staleTime: 30000,
  });
}
