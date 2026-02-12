'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TokenTable } from '@/components/tokens/TokenTable';
import { TokenWithMetrics } from '@/types/token';
import { RiskScore } from '@/types/risk';
import { useTokensStore } from '@/stores/tokens';
import { usePriceStream } from '@/hooks/usePriceStream';
import { AuthButton } from '@/components/auth/AuthButton';

export default function Home() {
  const router = useRouter();
  const { tokens, setTokens } = useTokensStore();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskStatus, setRiskStatus] = useState<string>('');

  // Connect to SSE price stream
  const { isConnected } = usePriceStream({ enabled: tokens.length > 0 });

  // Fetch real risk scores for tokens
  const fetchRiskScores = useCallback(async (tokenList: TokenWithMetrics[]) => {
    if (tokenList.length === 0) return;

    // Only analyze tokens that don't have real risk data yet
    const tokensToAnalyze = tokenList
      .filter(t => t.address !== '0x0000000000000000000000000000000000000000')
      .slice(0, 10) // Limit to first 10 for speed
      .map(t => ({
        address: t.address,
        chainId: t.chainId,
        liquidity: t.metrics.liquidity,
      }));

    if (tokensToAnalyze.length === 0) return;

    setRiskStatus(`analyzing ${tokensToAnalyze.length} tokens...`);

    try {
      const response = await fetch('/api/risk/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: tokensToAnalyze }),
      });

      const data = await response.json();

      if (data.success && data.results) {
        // Update tokens with real risk scores
        setTokens(
          tokenList.map(token => {
            const key = `${token.chainId}-${token.address.toLowerCase()}`;
            const riskScore = data.results[key] as RiskScore | undefined;
            if (riskScore) {
              return { ...token, risk: riskScore };
            }
            return token;
          })
        );
        setRiskStatus('');
      }
    } catch (err) {
      console.error('Risk fetch error:', err);
      setRiskStatus('');
    }
  }, [setTokens]);

  useEffect(() => {
    async function fetchTokens() {
      try {
        setIsLoading(true);
        const response = await fetch('/api/tokens?limit=50');
        const data = await response.json();

        if (data.success && data.tokens) {
          setTokens(data.tokens);
          setError(null);

          // Fetch real risk scores after a short delay
          setTimeout(() => {
            fetchRiskScores(data.tokens);
          }, 500);
        } else {
          setError(data.error || 'Failed to fetch tokens');
        }
      } catch (err) {
        setError('Failed to connect to API');
        console.error('Fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTokens();
    // Initial fetch only - SSE handles updates
  }, [fetchRiskScores, setTokens]);

  const handleTokenClick = (token: TokenWithMetrics) => {
    router.push(`/token/${token.chainId}/${token.address}`);
  };

  // Build status message
  const getStatusMessage = () => {
    if (error) return null; // Error shown separately
    if (riskStatus) return riskStatus;
    return null;
  };

  const statusMessage = getStatusMessage();

  return (
    <>
      <div className="w-full max-w-4xl relative">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-3xl sm:text-4xl text-neutral-100 ml-1">
          null//check
        </h1>
        <div className="flex items-center gap-4 mr-1">
          <Link
            href="/charts"
            className="text-neutral-500 hover:text-[#ffffff] text-sm transition-colors"
          >
            charts
          </Link>
          <Link
            href="/watchlist"
            className="text-neutral-500 hover:text-[#ffffff] text-sm transition-colors"
          >
            watchlist
          </Link>
          <AuthButton />
          {isConnected && (
            <span className="text-sm text-[#ffffff] animate-pulse-slow">live</span>
          )}
        </div>
      </div>

      {/* Main Terminal Window */}
      <div className="border-2 border-[#ffffff] bg-black">
        {/* Status bar */}
        {(statusMessage || error) && (
          <div className="px-5 py-2.5 border-b border-[#ffffff] text-sm text-neutral-500">
            {error ? (
              <span className="text-red-500">{error}</span>
            ) : (
              statusMessage
            )}
          </div>
        )}

        {/* Token Table */}
        <div className="h-[80vh] overflow-auto">
          <TokenTable
            tokens={tokens}
            isLoading={isLoading}
            onTokenClick={handleTokenClick}
          />
        </div>
      </div>
      </div>
    </>
  );
}
