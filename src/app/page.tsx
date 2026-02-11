'use client';

import { useState, useEffect, useCallback } from 'react';
import { TokenTable } from '@/components/tokens/TokenTable';
import { TokenWithMetrics } from '@/types/token';
import { RiskScore } from '@/types/risk';

export default function Home() {
  const [tokens, setTokens] = useState<TokenWithMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskStatus, setRiskStatus] = useState<string>('');

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
        setTokens(prev =>
          prev.map(token => {
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
  }, []);

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

    // Refresh tokens every 60 seconds (less frequent to reduce API calls)
    const interval = setInterval(fetchTokens, 60000);
    return () => clearInterval(interval);
  }, [fetchRiskScores]);

  const handleTokenClick = (token: TokenWithMetrics) => {
    console.log('Token clicked:', token);
    // In Phase 2, this would navigate to token detail page
  };

  return (
    <div className="w-full max-w-3xl">
      {/* Title */}
      <h1 className="text-2xl sm:text-3xl text-neutral-100 mb-4 ml-1">
        null//check
      </h1>

      {/* Main Terminal Window */}
      <div className="border-2 border-[#ffffff] bg-black">
        {/* Status bar */}
        {(riskStatus || error) && (
          <div className="px-4 py-2 border-b border-[#ffffff] text-xs text-neutral-500">
            {error ? <span className="text-red-500">{error}</span> : riskStatus}
          </div>
        )}

        {/* Token Table */}
        <div className="h-[70vh] overflow-auto">
          <TokenTable
            tokens={tokens}
            isLoading={isLoading}
            onTokenClick={handleTokenClick}
          />
        </div>
      </div>
    </div>
  );
}
