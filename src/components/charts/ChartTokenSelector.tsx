'use client';

import { useState, useRef, useEffect } from 'react';
import { useChartGridStore } from '@/stores/chartGrid';
import { TokenSearchResult } from '@/types/token';
import { cn } from '@/lib/utils/format';

interface ChartTokenSelectorProps {
  compact?: boolean;
}

export function ChartTokenSelector({ compact = false }: ChartTokenSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { addToken, tokens } = useChartGridStore();

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

  const handleSearch = async (q: string) => {
    setQuery(q);
    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (data.success) {
        setResults(data.results?.slice(0, 6) ?? []);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddToken = (result: TokenSearchResult) => {
    addToken({
      chainId: result.chainId,
      address: result.address,
      symbol: result.symbol,
      name: result.name,
    });
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const canAddMore = tokens.length < 9;

  if (compact) {
    return (
      <div className="flex items-center gap-4 relative" ref={containerRef}>
        <span className="text-xs text-neutral-500">
          {tokens.length}/9 charts
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
              <div className="absolute top-full left-0 mt-1 bg-black border border-neutral-700 w-64 z-50 max-h-64 overflow-y-auto">
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
            {showResults && isSearching && (
              <div className="absolute top-full left-0 mt-1 bg-black border border-neutral-700 w-64 z-50 px-3 py-2 text-neutral-500 text-sm">
                searching...
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full selector for empty state
  return (
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
  );
}
