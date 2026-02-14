'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useChartGridStore } from '@/stores/chartGrid';
import { useSubscription } from '@/hooks/useSubscription';
import { TokenSearchResult } from '@/types/token';
import { cn } from '@/lib/utils/format';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';

interface ChartTokenSelectorProps {
  compact?: boolean;
}

const DEBOUNCE_MS = 300;

export function ChartTokenSelector({ compact = false }: ChartTokenSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { addToken, tokens } = useChartGridStore();
  const { limits, canAddChart } = useSubscription();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const performSearch = useCallback(async (q: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!response.ok) throw new Error('Search failed');
      const data = await response.json();
      if (data.success) {
        setResults(data.results?.slice(0, 6) ?? []);
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearch = (q: string) => {
    setQuery(q);

    // Clear pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setShowResults(true);

    // Debounce the actual API call
    debounceRef.current = setTimeout(() => {
      performSearch(q);
    }, DEBOUNCE_MS);
  };

  const handleAddToken = (result: TokenSearchResult) => {
    // Check subscription limit before adding
    if (!canAddChart(tokens.length)) {
      setShowUpgradePrompt(true);
      return;
    }

    addToken(
      {
        chainId: result.chainId,
        address: result.address,
        symbol: result.symbol,
        name: result.name,
      },
      limits.chartSlots
    );
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const canAddMore = canAddChart(tokens.length);
  const maxSlots = limits.chartSlots;

  if (compact) {
    return (
      <>
        <div className="flex items-center gap-4 relative" ref={containerRef}>
          <span className="text-xs text-neutral-500">
            {tokens.length}/{maxSlots} charts
          </span>
          {canAddMore && (
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => results.length > 0 && setShowResults(true)}
                placeholder="+ add token"
                className="bg-transparent border-none text-sm text-neutral-300 placeholder:text-neutral-600 w-32 outline-none"
              />
              {/* Search results dropdown */}
              {showResults && results.length > 0 && (
                <div className="absolute top-full left-0 mt-1 bg-black border border-neutral-700 w-48 sm:w-64 z-50 max-h-64 overflow-y-auto">
                  {results.map((result) => (
                    <button
                      key={`${result.chainId}-${result.address}`}
                      onClick={() => handleAddToken(result)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-800 border-b border-neutral-800 last:border-b-0"
                    >
                      <span className="text-neutral-200">{result.symbol}</span>
                      <span className="text-neutral-500 ml-2 text-xs">{result.chainId}</span>
                      <span className="text-neutral-600 ml-2 text-xs truncate">{result.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {showResults && isSearching && results.length === 0 && (
                <div className="absolute top-full left-0 mt-1 bg-black border border-neutral-700 w-48 sm:w-64 z-50 px-3 py-2 text-neutral-500 text-sm">
                  searching...
                </div>
              )}
            </div>
          )}
          {!canAddMore && (
            <button
              onClick={() => setShowUpgradePrompt(true)}
              className="text-xs text-emerald-500 hover:text-emerald-400"
            >
              upgrade for more
            </button>
          )}
        </div>
        <UpgradePrompt
          isOpen={showUpgradePrompt}
          onClose={() => setShowUpgradePrompt(false)}
          feature="charts"
          currentCount={tokens.length}
          limit={maxSlots}
        />
      </>
    );
  }

  // Full selector for empty state
  return (
    <>
      <div className="space-y-4 relative" ref={containerRef}>
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          placeholder="search tokens to add..."
          className="w-full max-w-md bg-neutral-900 border border-neutral-700 px-4 py-2 text-sm outline-none focus:border-neutral-500"
        />

        {/* Results */}
        {showResults && results.length > 0 && (
          <div className="space-y-1 max-w-md">
            {results.map((result) => (
              <button
                key={`${result.chainId}-${result.address}`}
                onClick={() => handleAddToken(result)}
                className={cn(
                  'w-full px-4 py-2 text-left hover:bg-neutral-800 border border-neutral-800',
                  'flex items-center gap-2'
                )}
              >
                <span className="text-neutral-200">{result.symbol}</span>
                <span className="text-neutral-600 text-xs">{result.chainId}</span>
                <span className="text-neutral-500 text-xs truncate">{result.name}</span>
              </button>
            ))}
          </div>
        )}

        {showResults && isSearching && (
          <p className="text-neutral-500 text-sm">searching...</p>
        )}

        {!showResults && !query && (
          <p className="text-neutral-600 text-sm">
            search for tokens to add to your chart grid
          </p>
        )}
      </div>
      <UpgradePrompt
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="charts"
        currentCount={tokens.length}
        limit={maxSlots}
      />
    </>
  );
}
