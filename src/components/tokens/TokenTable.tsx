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

// Column definitions with responsive visibility
const COLUMNS: {
  field: SortField;
  label: string;
  align: 'left' | 'right';
  hideOnMobile?: boolean;
}[] = [
  { field: 'price', label: 'Price', align: 'right' },
  { field: 'priceChange1h', label: '1h', align: 'right', hideOnMobile: true },
  { field: 'priceChange24h', label: '24h', align: 'right' },
  { field: 'priceChange7d', label: '7d', align: 'right', hideOnMobile: true },
  { field: 'volume24h', label: 'Vol', align: 'right', hideOnMobile: true },
  { field: 'liquidity', label: 'Liq', align: 'right' },
  { field: 'risk', label: 'Risk', align: 'right' },
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
      <div className="sticky top-0 z-20 bg-black">
        {/* Header Controls */}
        <div className="px-7 py-2.5">
          <div className="flex items-center justify-between gap-4">
            {/* Chain Filter */}
            <div className="flex items-center gap-2.5 text-base">
              <span className="text-neutral-500">chain:</span>
              <button
                onClick={() => setSelectedChain(undefined)}
                className={cn(
                  'hover:text-neutral-100 transition-colors',
                  !selectedChain ? 'text-neutral-100' : 'text-neutral-500'
                )}
              >
                all
              </button>
              {Object.values(CHAINS).map((chain) => (
                <button
                  key={chain.id}
                  onClick={() => setSelectedChain(chain.id)}
                  className={cn(
                    'hover:text-neutral-100 transition-colors',
                    selectedChain === chain.id ? 'text-neutral-100' : 'text-neutral-500'
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
              className="bg-transparent border-none outline-none text-neutral-200 text-base w-28 sm:w-36 placeholder:text-neutral-500 focus:placeholder:text-transparent caret-transparent p-0"
            />
          </div>
        </div>

        {/* Table Header */}
        <div className="flex px-7 py-3.5 text-neutral-600 text-sm">
          {showStars && <div className="w-8"></div>}
          <div className="w-10 text-left">#</div>
          <div className="flex-1 text-left">Token</div>
          {COLUMNS.map((col) => (
            <div
              key={col.field}
              className={cn(
                'w-24 cursor-pointer hover:text-neutral-400 transition-colors whitespace-nowrap',
                col.align === 'right' ? 'text-right' : 'text-left',
                col.hideOnMobile && 'hidden sm:block'
              )}
              onClick={() => handleSort(col.field)}
            >
              <span className="inline-flex items-center gap-1">
                {col.label}
                {sortConfig.field === col.field && (
                  <span className="text-neutral-500">
                    {sortConfig.direction === 'desc' ? '↓' : '↑'}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="border-b border-[#ffffff]" />
      </div>

      {/* Table */}
      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-sm">
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
