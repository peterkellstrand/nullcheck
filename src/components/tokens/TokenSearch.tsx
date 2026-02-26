'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { TokenSearchResult } from '@/types/token';
import { CHAINS } from '@/types/chain';
import { formatVolume, cn } from '@/lib/utils/format';

interface TokenSearchProps {
  onSearch: (query: string) => void;
  onSelectToken?: (token: TokenSearchResult) => void;
  className?: string;
}

export function TokenSearch({
  onSearch,
  onSelectToken,
  className,
}: TokenSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TokenSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced API search with abort support
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (data.success && data.data?.results) {
          setResults(data.data.results);
          setShowDropdown(true);
        }
      } catch (error) {
        // Ignore abort errors (expected on unmount/new query)
        if ((error as Error).name !== 'AbortError') {
          console.error('Search error:', error);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      onSearch(value);
    },
    [onSearch]
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    onSearch('');
  }, [onSearch]);

  const handleSelect = useCallback(
    (token: TokenSearchResult) => {
      setShowDropdown(false);
      onSelectToken?.(token);
    },
    [onSelectToken]
  );

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <span className="text-neutral-500 text-sm">token</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => results.length > 0 && setShowDropdown(true)}
          placeholder=""
          className="flex-1 bg-transparent border-none outline-none text-neutral-200 text-sm placeholder:text-neutral-700"
        />
        {isSearching && <Spinner />}
        {query && !isSearching && (
          <button
            onClick={handleClear}
            className="text-neutral-600 hover:text-neutral-400 text-sm"
          >
            x
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-neutral-800 z-50 max-h-60 overflow-y-auto">
          {results.map((token) => (
            <button
              key={`${token.chainId}-${token.address}`}
              onClick={() => handleSelect(token)}
              className="w-full flex items-center gap-3 px-3 py-2 hover:bg-neutral-900 transition-colors text-left border-b border-neutral-800 last:border-b-0"
            >
              {/* Logo */}
              <div className="w-5 h-5 bg-neutral-900 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                {token.logoUrl ? (
                  <img
                    src={token.logoUrl}
                    alt={token.symbol}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[8px] text-neutral-600">
                    {token.symbol.slice(0, 2)}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-200">
                    {token.symbol}
                  </span>
                  <span className="text-[9px] text-neutral-700">
                    {CHAINS[token.chainId]?.symbol.toLowerCase()}
                  </span>
                </div>
              </div>

              {/* Volume */}
              {token.volume24h && (
                <div className="text-xs text-neutral-600">
                  {formatVolume(token.volume24h)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* No results */}
      {showDropdown && query.length >= 2 && results.length === 0 && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-neutral-800 z-50 px-3 py-3 text-center text-neutral-600 text-sm">
          no tokens found
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin text-neutral-600"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75" />
    </svg>
  );
}
