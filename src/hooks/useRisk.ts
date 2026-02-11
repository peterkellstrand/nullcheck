'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RiskScore } from '@/types/risk';
import { ChainId } from '@/types/chain';

interface RiskAnalysisResponse {
  success: boolean;
  data?: RiskScore;
  error?: string;
  cached?: boolean;
}

async function fetchRiskScore(
  chainId: ChainId,
  address: string
): Promise<RiskScore | null> {
  const response = await fetch(`/api/risk/${chainId}/${address}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error('Failed to fetch risk score');
  }

  const data: RiskAnalysisResponse = await response.json();

  if (!data.success || !data.data) {
    return null;
  }

  return data.data;
}

async function analyzeRisk(
  chainId: ChainId,
  address: string,
  liquidity?: number
): Promise<RiskScore> {
  const response = await fetch(`/api/risk/${chainId}/${address}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ liquidity }),
  });

  if (!response.ok) {
    throw new Error('Failed to analyze risk');
  }

  const data: RiskAnalysisResponse = await response.json();

  if (!data.success || !data.data) {
    throw new Error(data.error || 'Analysis failed');
  }

  return data.data;
}

export function useRiskScore(chainId: ChainId, address: string) {
  return useQuery({
    queryKey: ['risk', chainId, address],
    queryFn: () => fetchRiskScore(chainId, address),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useAnalyzeRisk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      chainId,
      address,
      liquidity,
    }: {
      chainId: ChainId;
      address: string;
      liquidity?: number;
    }) => analyzeRisk(chainId, address, liquidity),
    onSuccess: (data, variables) => {
      // Update the cache with the new risk score
      queryClient.setQueryData(
        ['risk', variables.chainId, variables.address],
        data
      );
    },
  });
}

export function useBatchRiskScores(
  tokens: { chainId: ChainId; address: string }[]
) {
  return useQuery({
    queryKey: ['risks', tokens.map((t) => `${t.chainId}-${t.address}`).join(',')],
    queryFn: async () => {
      const results = await Promise.allSettled(
        tokens.map((t) => fetchRiskScore(t.chainId, t.address))
      );

      const riskMap = new Map<string, RiskScore | null>();
      results.forEach((result, index) => {
        const key = `${tokens[index].chainId}-${tokens[index].address}`;
        riskMap.set(
          key,
          result.status === 'fulfilled' ? result.value : null
        );
      });

      return riskMap;
    },
    enabled: tokens.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
