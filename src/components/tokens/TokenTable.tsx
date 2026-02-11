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

  const totalColumns = COLUMNS.length + 2; // +2 for rank and token columns

  return (
    <div className="w-full">
      {/* Header Controls */}
      <div className="px-4 py-3 border-b border-[#ffffff]">
        <div className="flex items-center justify-between gap-4">
          {/* Chain Filter */}
          <div className="flex items-center gap-2 text-sm">
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
                {chain.symbol.toLowerCase()}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-neutral-500">search:</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder=""
              className="bg-transparent border-none outline-none text-neutral-200 text-sm w-24 sm:w-32"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-neutral-600 hover:text-neutral-400 text-xs"
              >
                x
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#ffffff] text-neutral-600 text-xs">
              <th className="px-4 py-2 text-left w-8">#</th>
              <th className="px-2 py-2 text-left">Token</th>
              {COLUMNS.map((col) => (
                <th
                  key={col.field}
                  className={cn(
                    'px-2 py-2 cursor-pointer hover:text-neutral-400 transition-colors whitespace-nowrap',
                    col.align === 'right' ? 'text-right' : 'text-left',
                    col.hideOnMobile && 'hidden sm:table-cell'
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
                </th>
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
                  className="px-4 py-12 text-center text-neutral-600"
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
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
