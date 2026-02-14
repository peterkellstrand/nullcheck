'use client';

import { useState, useMemo, useCallback } from 'react';
import { TokenWithMetrics, SortField, SortDirection } from '@/types/token';
import { ChainId, CHAINS } from '@/types/chain';
import { TokenRow } from './TokenRow';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils/format';

interface TokenTableProps {
  tokens: TokenWithMetrics[];
  isLoading?: boolean;
  onTokenClick?: (token: TokenWithMetrics) => void;
  showStars?: boolean;
}

type SortConfig = {
  field: SortField;
  direction: SortDirection;
};

// Column definitions with widths
const COLUMNS: {
  field: SortField;
  label: string;
  width: string;
  hideOnMobile?: boolean;
}[] = [
  { field: 'trending', label: 'Hot', width: 'w-12' },
  { field: 'price', label: 'Price', width: 'w-20' },
  { field: 'priceChange1h', label: '1h', width: 'w-14', hideOnMobile: true },
  { field: 'priceChange24h', label: '24h', width: 'w-14' },
  { field: 'priceChange7d', label: '7d', width: 'w-14', hideOnMobile: true },
  { field: 'volume24h', label: 'Vol', width: 'w-16', hideOnMobile: true },
  { field: 'liquidity', label: 'Liq', width: 'w-16' },
  { field: 'whales', label: 'Whales', width: 'w-14', hideOnMobile: true },
  { field: 'risk', label: 'Risk', width: 'w-14' },
];

export function TokenTable({
  tokens,
  isLoading = false,
  onTokenClick,
  showStars = true,
}: TokenTableProps) {
  const [selectedChain, setSelectedChain] = useState<ChainId | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'volume24h',
    direction: 'desc',
  });

  const handleSort = useCallback((field: SortField) => {
    setSortConfig((prev) => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc',
    }));
  }, []);

  const filteredAndSortedTokens = useMemo(() => {
    let result = [...tokens];

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.symbol.toLowerCase().includes(query) ||
          t.name.toLowerCase().includes(query)
      );
    }

    // Filter by chain
    if (selectedChain) {
      result = result.filter((t) => t.chainId === selectedChain);
    }

    // Sort
    result.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortConfig.field) {
        case 'trending':
          aValue = a.metrics.trendingScore ?? 0;
          bValue = b.metrics.trendingScore ?? 0;
          break;
        case 'price':
          aValue = a.metrics.price;
          bValue = b.metrics.price;
          break;
        case 'priceChange1h':
          aValue = a.metrics.priceChange1h;
          bValue = b.metrics.priceChange1h;
          break;
        case 'priceChange24h':
          aValue = a.metrics.priceChange24h;
          bValue = b.metrics.priceChange24h;
          break;
        case 'priceChange7d':
          aValue = a.metrics.priceChange7d;
          bValue = b.metrics.priceChange7d;
          break;
        case 'volume24h':
          aValue = a.metrics.volume24h;
          bValue = b.metrics.volume24h;
          break;
        case 'liquidity':
          aValue = a.metrics.liquidity;
          bValue = b.metrics.liquidity;
          break;
        case 'risk':
          aValue = a.risk?.totalScore ?? 50;
          bValue = b.risk?.totalScore ?? 50;
          break;
        case 'whales':
          // Sort by total transactions as a proxy for whale activity
          aValue = (a.metrics.buys24h || 0) + (a.metrics.sells24h || 0);
          bValue = (b.metrics.buys24h || 0) + (b.metrics.sells24h || 0);
          break;
        default:
          aValue = a.metrics.volume24h;
          bValue = b.metrics.volume24h;
      }

      return sortConfig.direction === 'desc' ? bValue - aValue : aValue - bValue;
    });

    return result;
  }, [tokens, searchQuery, selectedChain, sortConfig]);

  const totalColumns = COLUMNS.length + 2 + (showStars ? 1 : 0); // +2 for rank and token, +1 for star

  return (
    <div className="w-full h-full flex flex-col">
      {/* Sticky Header - Controls + Table Header */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]">
        {/* Header Controls */}
        <div className="px-4 sm:px-7 py-2.5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4">
            {/* Chain Filter */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 text-sm sm:text-base">
              <span className="text-[var(--text-muted)]">chain:</span>
              <button
                onClick={() => setSelectedChain(undefined)}
                className={cn(
                  'hover:text-[var(--text-primary)] transition-colors',
                  !selectedChain ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                )}
              >
                all
              </button>
              {Object.values(CHAINS).map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={cn(
                    'hover:text-[var(--text-primary)] transition-colors',
                    selectedChain === chain.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                  )}
                >
                  {chain.id}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search"
              className="bg-transparent border-none outline-none text-[var(--text-primary)] text-sm sm:text-base w-24 sm:w-36 placeholder:text-[var(--text-muted)] focus:placeholder:text-transparent caret-transparent p-0"
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="flex items-center px-4 py-2.5 text-[var(--text-muted)] text-xs">
          {showStars && <div className="w-6 flex-shrink-0"></div>}
          <div className="w-6 flex-shrink-0 text-left">#</div>
          <div className="flex-[2] min-w-0 text-left">Token</div>
          {COLUMNS.map((col) => (
            <div
              key={col.field}
              className={cn(
                'flex-1 cursor-pointer hover:text-[var(--text-secondary)] transition-colors text-right',
                col.hideOnMobile && 'hidden sm:flex'
              )}
              onClick={() => handleSort(col.field)}
            >
              <span className="inline-flex items-center justify-end gap-0.5 w-full">
                {col.label}
                {sortConfig.field === col.field && (
                  <span className="text-[var(--text-secondary)]">
                    {sortConfig.direction === 'desc' ? '↓' : '↑'}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="border-b border-[var(--border)]" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sr-only">
            <tr>
              {showStars && <th>Watch</th>}
              <th>#</th>
              <th>Token</th>
              {COLUMNS.map((col) => (
                <th key={col.field}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={totalColumns}>
                  <TableSkeleton rows={15} />
                </td>
              </tr>
            ) : filteredAndSortedTokens.length === 0 ? (
              <tr>
                <td
                  colSpan={totalColumns}
                  className="px-6 py-12 text-center text-neutral-600"
                >
                  no tokens found
                </td>
              </tr>
            ) : (
              filteredAndSortedTokens.map((token, index) => (
                <TokenRow
                  key={`${token.chainId}-${token.address}`}
                  token={token}
                  rank={index + 1}
                  onTokenClick={onTokenClick}
                  showStar={showStars}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
