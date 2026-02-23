'use client';

import { useState, useMemo, useCallback } from 'react';
import { TokenWithMetrics, SortField, SortDirection } from '@/types/token';
import { ChainId, CHAINS } from '@/types/chain';
import { TokenRow } from './TokenRow';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/utils/format';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';

interface TokenTableProps {
  tokens: TokenWithMetrics[];
  isLoading?: boolean;
  onTokenClick?: (token: TokenWithMetrics) => void;
  showStars?: boolean;
  selectedChain?: ChainId;
  onChainChange?: (chain: ChainId | undefined) => void;
}

type SortConfig = {
  field: SortField;
  direction: SortDirection;
};

type AgeFilter = 'all' | '24h' | '7d';

interface AdvancedFilters {
  maxRiskScore?: number;
  maxTop10Percent?: number;
  minLpLockPercent?: number;
}

const RISK_FILTER_OPTIONS = [
  { label: 'All', value: undefined },
  { label: '<15 (Low)', value: 15 },
  { label: '<30 (Med)', value: 30 },
  { label: '<50 (High)', value: 50 },
];

const HOLDER_FILTER_OPTIONS = [
  { label: 'All', value: undefined },
  { label: '<50%', value: 50 },
  { label: '<70%', value: 70 },
  { label: '<90%', value: 90 },
];

const LP_LOCK_FILTER_OPTIONS = [
  { label: 'All', value: undefined },
  { label: '>50%', value: 50 },
  { label: '>80%', value: 80 },
  { label: '100%', value: 100 },
];

// Column definitions with widths
const COLUMNS: {
  field: SortField;
  label: string;
  width: string;
  hideOnMobile?: boolean;
}[] = [
  { field: 'risk', label: 'Risk', width: 'w-14' },
  { field: 'trending', label: 'Hot', width: 'w-12', hideOnMobile: true },
  { field: 'price', label: 'Price', width: 'w-20' },
  { field: 'priceChange1h', label: '1h', width: 'w-14', hideOnMobile: true },
  { field: 'priceChange24h', label: '24h', width: 'w-14' },
  { field: 'marketCap', label: 'MCap', width: 'w-16', hideOnMobile: true },
  { field: 'volume24h', label: 'Vol', width: 'w-16', hideOnMobile: true },
  { field: 'liquidity', label: 'Liq', width: 'w-16', hideOnMobile: true },
  { field: 'whales', label: 'Whales', width: 'w-14', hideOnMobile: true },
];

export function TokenTable({
  tokens,
  isLoading = false,
  onTokenClick,
  showStars = true,
  selectedChain: externalSelectedChain,
  onChainChange,
}: TokenTableProps) {
  const [internalSelectedChain, setInternalSelectedChain] = useState<ChainId | undefined>();
  const { limits } = useSubscription();
  const hasAdvancedFilters = limits.hasAdvancedFilters;

  // Use external state if provided, otherwise use internal state
  const selectedChain = onChainChange ? externalSelectedChain : internalSelectedChain;
  const setSelectedChain = onChainChange || setInternalSelectedChain;
  const [searchQuery, setSearchQuery] = useState('');
  const [ageFilter, setAgeFilter] = useState<AgeFilter>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>({});
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

    // Filter by chain (only if using internal state - external control means API already filtered)
    if (selectedChain && !onChainChange) {
      result = result.filter((t) => t.chainId === selectedChain);
    }

    // Filter by age (new tokens)
    if (ageFilter !== 'all') {
      const now = Date.now();
      const cutoff = ageFilter === '24h' ? now - 24 * 60 * 60 * 1000 : now - 7 * 24 * 60 * 60 * 1000;
      result = result.filter((t) => {
        if (!t.createdAt) return false;
        const createdAt = new Date(t.createdAt).getTime();
        return createdAt >= cutoff;
      });
    }

    // Advanced filters (PRO only)
    if (hasAdvancedFilters) {
      // Filter by max risk score
      if (advancedFilters.maxRiskScore !== undefined) {
        result = result.filter((t) => {
          const score = t.risk?.totalScore;
          return score !== undefined && score < advancedFilters.maxRiskScore!;
        });
      }

      // Filter by max top 10% holder concentration
      if (advancedFilters.maxTop10Percent !== undefined) {
        result = result.filter((t) => {
          const top10 = t.risk?.holders?.top10Percent;
          return top10 !== undefined && top10 < advancedFilters.maxTop10Percent!;
        });
      }

      // Filter by min LP lock percent
      if (advancedFilters.minLpLockPercent !== undefined) {
        result = result.filter((t) => {
          const lpLock = t.risk?.liquidity?.lpLockedPercent;
          return lpLock !== undefined && lpLock >= advancedFilters.minLpLockPercent!;
        });
      }
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
        case 'marketCap':
          aValue = a.metrics.marketCap ?? 0;
          bValue = b.metrics.marketCap ?? 0;
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
  }, [tokens, searchQuery, selectedChain, ageFilter, sortConfig, onChainChange, hasAdvancedFilters, advancedFilters]);

  const totalColumns = COLUMNS.length + 2 + (showStars ? 1 : 0); // +2 for rank and token, +1 for star

  return (
    <div className="w-full h-full flex flex-col">
      {/* Sticky Header - Controls + Table Header */}
      <div className="sticky top-0 z-20 bg-[var(--bg-primary)]">
        {/* Header Controls */}
        <div className="px-5 sm:px-8 py-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-5">
            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-5 sm:gap-7 text-base sm:text-lg">
              {/* Chain Filter */}
              <div className="flex items-center gap-2 sm:gap-3">
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

              {/* Age Filter */}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[var(--text-muted)]">age:</span>
                <button
                  onClick={() => setAgeFilter('all')}
                  className={cn(
                    'hover:text-[var(--text-primary)] transition-colors',
                    ageFilter === 'all' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                  )}
                >
                  all
                </button>
                <button
                  onClick={() => setAgeFilter('24h')}
                  className={cn(
                    'hover:text-[var(--text-primary)] transition-colors',
                    ageFilter === '24h' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                  )}
                >
                  &lt;24h
                </button>
                <button
                  onClick={() => setAgeFilter('7d')}
                  className={cn(
                    'hover:text-[var(--text-primary)] transition-colors',
                    ageFilter === '7d' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                  )}
                >
                  &lt;7d
                </button>
              </div>

              {/* Advanced Toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className={cn(
                  'flex items-center gap-1 transition-colors',
                  showAdvanced ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                )}
              >
                <span>filters</span>
                <span className="text-xs">{showAdvanced ? '▲' : '▼'}</span>
                {!hasAdvancedFilters && (
                  <span className="text-[10px] px-1 py-0.5 bg-emerald-500/20 text-emerald-500 ml-1">PRO</span>
                )}
              </button>
            </div>

            {/* Search */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="search"
              className="bg-transparent border-none outline-none text-[var(--text-primary)] text-base sm:text-lg w-28 sm:w-40 placeholder:text-[var(--text-muted)] focus:placeholder:text-transparent caret-transparent p-0"
            />
          </div>

          {/* Advanced Filters Panel */}
          {showAdvanced && (
            <div className="px-5 sm:px-8 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]/30">
              {hasAdvancedFilters ? (
                <div className="flex flex-wrap items-center gap-5 sm:gap-7 text-sm">
                  {/* Risk Score Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)]">risk:</span>
                    {RISK_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setAdvancedFilters((prev) => ({ ...prev, maxRiskScore: opt.value }))}
                        className={cn(
                          'hover:text-[var(--text-primary)] transition-colors text-sm',
                          advancedFilters.maxRiskScore === opt.value
                            ? 'text-[var(--text-primary)]'
                            : 'text-[var(--text-muted)]'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Holder Concentration Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)]">top10%:</span>
                    {HOLDER_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setAdvancedFilters((prev) => ({ ...prev, maxTop10Percent: opt.value }))}
                        className={cn(
                          'hover:text-[var(--text-primary)] transition-colors text-sm',
                          advancedFilters.maxTop10Percent === opt.value
                            ? 'text-[var(--text-primary)]'
                            : 'text-[var(--text-muted)]'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* LP Lock Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)]">LP lock:</span>
                    {LP_LOCK_FILTER_OPTIONS.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => setAdvancedFilters((prev) => ({ ...prev, minLpLockPercent: opt.value }))}
                        className={cn(
                          'hover:text-[var(--text-primary)] transition-colors text-sm',
                          advancedFilters.minLpLockPercent === opt.value
                            ? 'text-[var(--text-primary)]'
                            : 'text-[var(--text-muted)]'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Clear Filters */}
                  {(advancedFilters.maxRiskScore !== undefined ||
                    advancedFilters.maxTop10Percent !== undefined ||
                    advancedFilters.minLpLockPercent !== undefined) && (
                    <button
                      onClick={() => setAdvancedFilters({})}
                      className="text-sm text-neutral-500 hover:text-red-400 transition-colors"
                    >
                      clear
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-neutral-500">
                    Advanced filters (risk score, holder concentration, LP lock) require PRO
                  </span>
                  <Link
                    href="/pricing"
                    className="text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    Upgrade →
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Table Header */}
        <div className="flex items-center px-5 py-3 text-[var(--text-muted)] text-sm">
          {showStars && <div className="w-8 flex-shrink-0"></div>}
          <div className="w-8 flex-shrink-0 text-left">#</div>
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
