'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { TokenTable } from '@/components/tokens/TokenTable';
import { TokenWithMetrics } from '@/types/token';
import { RiskScore } from '@/types/risk';
import { useTokensStore } from '@/stores/tokens';
import { useThemeStore } from '@/stores/theme';
import { usePriceStream } from '@/hooks/usePriceStream';
import { AuthButton } from '@/components/auth/AuthButton';
import { useSubscription } from '@/hooks/useSubscription';
import { ChainId } from '@/types/chain';
import { ExportButton } from '@/components/export/ExportButton';

export default function Home() {
  const router = useRouter();
  const { tokens, setTokens } = useTokensStore();
  const { theme, toggleTheme } = useThemeStore();
  const { isPro } = useSubscription();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [riskStatus, setRiskStatus] = useState<string>('');
  const [selectedChain, setSelectedChain] = useState<ChainId | undefined>(undefined);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Connect to SSE price stream
  usePriceStream({ enabled: tokens.length > 0 });

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

      if (!response.ok) {
        throw new Error(`Risk API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data?.results) {
        // Update tokens with real risk scores
        setTokens(
          tokenList.map(token => {
            const key = `${token.chainId}-${token.address.toLowerCase()}`;
            const riskScore = data.data.results[key] as RiskScore | undefined;
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

  // Fetch tokens function (extracted for reuse in polling)
  const fetchTokens = useCallback(async (isPolling = false) => {
    try {
      if (!isPolling) setIsLoading(true);
      const chainParam = selectedChain ? `&chain=${selectedChain}` : '';
      // Force refresh when chain changes (not on initial load) to get fresh data
      const refreshParam = !isInitialLoad || isPolling ? '&refresh=true' : '';
      const response = await fetch(`/api/tokens?limit=50${chainParam}${refreshParam}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data?.tokens) {
        setTokens(data.data.tokens);
        setError(null);

        // Fetch real risk scores after a short delay (only on initial load)
        if (!isPolling) {
          setTimeout(() => {
            fetchRiskScores(data.data.tokens);
          }, 500);
        }
      } else {
        setError(data.error?.message || 'Failed to fetch tokens');
      }
    } catch (err) {
      if (!isPolling) {
        setError('Failed to connect to API');
      }
      console.error('Fetch error:', err);
    } finally {
      if (!isPolling) {
        setIsLoading(false);
        setIsInitialLoad(false);
      }
    }
  }, [selectedChain, isInitialLoad, setTokens, fetchRiskScores]);

  // Initial fetch
  useEffect(() => {
    fetchTokens(false);
  }, [fetchTokens]);

  // Polling for price updates every 12 seconds
  useEffect(() => {
    if (isInitialLoad) return;

    const pollInterval = setInterval(() => {
      fetchTokens(true);
    }, 12000);

    return () => clearInterval(pollInterval);
  }, [fetchTokens, isInitialLoad]);

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

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="w-full max-w-6xl relative">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl sm:text-5xl text-[var(--text-primary)] ml-1">
          null//check
        </h1>
        <div className="flex items-center gap-4 mr-1">
          {/* Menu Button */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-4 py-2 text-base text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-colors"
              aria-label="Menu"
            >
              <svg
                className={`w-5 h-5 transition-transform ${menuOpen ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>menu</span>
            </button>
            {/* Dropdown */}
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 min-w-[200px] border border-[var(--border)] bg-[var(--bg-primary)] shadow-lg z-50">
                <Link
                  href="/charts"
                  className="block px-5 py-3 text-base text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  charts
                </Link>
                <Link
                  href="/watchlist"
                  className="block px-5 py-3 text-base text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  watchlist
                </Link>
                <Link
                  href="/alerts"
                  className="block px-5 py-3 text-base text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  alerts
                </Link>
                <Link
                  href="/keys"
                  className="block px-5 py-3 text-base text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  api
                </Link>
                <Link
                  href="/docs"
                  className="block px-5 py-3 text-base text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  docs
                </Link>
                <Link
                  href="/methodology"
                  className="block px-5 py-3 text-base text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  risk methodology
                </Link>
                <Link
                  href="/pricing"
                  className={`block px-5 py-3 text-base transition-colors hover:bg-[var(--bg-secondary)] ${
                    isPro
                      ? 'text-emerald-500'
                      : 'text-[var(--text-muted)] hover:text-emerald-400'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  {isPro ? 'PRO' : 'pricing'}
                </Link>
                <div className="border-t border-[var(--border)] px-5 py-3">
                  <AuthButton />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Terminal Window */}
      <div className="border-2 border-[var(--border)] bg-[var(--bg-primary)]">
        {/* Status bar */}
        {(statusMessage || error) && (
          <div className="px-6 py-3 border-b border-[var(--border)] text-base text-[var(--text-muted)]">
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
            selectedChain={selectedChain}
            onChainChange={setSelectedChain}
          />
        </div>
      </div>

      {/* Footer Controls */}
      <div className="mt-4 ml-1 flex items-center justify-between">
        {/* Theme Toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">dark</span>
          <button
            onClick={toggleTheme}
            className="relative w-12 h-6 rounded-full border border-[var(--border-light)] transition-colors"
            style={{ backgroundColor: theme === 'light' ? 'var(--text-secondary)' : 'transparent' }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span
              className="absolute top-0.5 w-5 h-5 rounded-full bg-[var(--text-muted)] transition-all"
              style={{ left: theme === 'dark' ? '2px' : '26px' }}
            />
          </button>
          <span className="text-sm text-[var(--text-muted)]">light</span>
        </div>

        {/* Export Button */}
        <ExportButton type="tokens" />
      </div>
      </div>
    </>
  );
}
