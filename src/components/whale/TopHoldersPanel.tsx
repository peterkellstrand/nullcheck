'use client';

import { useState, useEffect } from 'react';
import { ChainId } from '@/types/chain';
import { TokenHolder, truncateAddress } from '@/types/whale';
import { useSubscription } from '@/hooks/useSubscription';
import { Skeleton } from '@/components/ui';
import Link from 'next/link';

interface TopHoldersPanelProps {
  chainId: ChainId;
  tokenAddress: string;
}

export function TopHoldersPanel({ chainId, tokenAddress }: TopHoldersPanelProps) {
  const [holders, setHolders] = useState<TokenHolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(5);

  const { isPro, limits } = useSubscription();

  useEffect(() => {
    async function fetchHolders() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/whale/holders/${chainId}/${tokenAddress}`
        );
        const data = await response.json();

        if (data.success && data.data) {
          setHolders(data.data.holders || []);
          setLimit(data.data.limit || 5);
        } else {
          setError(data.error?.message || 'Failed to load holders');
        }
      } catch {
        setError('Failed to load holders');
      } finally {
        setIsLoading(false);
      }
    }

    fetchHolders();
  }, [chainId, tokenAddress]);

  if (isLoading) {
    return (
      <div className="border border-neutral-300 dark:border-neutral-700 p-4">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Top Holders</h3>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-neutral-300 dark:border-neutral-700 p-4">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Top Holders</h3>
        <p className="text-neutral-500 text-sm">{error}</p>
      </div>
    );
  }

  if (holders.length === 0) {
    return (
      <div className="border border-neutral-300 dark:border-neutral-700 p-4">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-3">Top Holders</h3>
        <p className="text-neutral-500 text-sm">No holder data available</p>
      </div>
    );
  }

  const getExplorerUrl = (address: string) => {
    switch (chainId) {
      case 'solana':
        return `https://solscan.io/account/${address}`;
      case 'base':
        return `https://basescan.org/address/${address}`;
      default:
        return `https://etherscan.io/address/${address}`;
    }
  };

  return (
    <div className="border border-neutral-300 dark:border-neutral-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Top Holders</h3>
        <span className="text-xs text-neutral-500">
          {holders.length} shown
        </span>
      </div>

      <div className="space-y-2">
        {holders.map((holder, index) => (
          <div
            key={holder.address}
            className="flex items-center gap-2 text-sm"
          >
            <span className="text-neutral-500 w-4 text-right">
              {index + 1}.
            </span>

            <a
              href={getExplorerUrl(holder.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
            >
              {truncateAddress(holder.address)}
            </a>

            {/* Percentage bar */}
            <div className="flex-1 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-neutral-400 dark:bg-neutral-600"
                style={{ width: `${Math.min(holder.percent, 100)}%` }}
              />
            </div>

            <span className="text-neutral-700 dark:text-neutral-300 tabular-nums w-14 text-right">
              {holder.percent.toFixed(1)}%
            </span>

            {/* Badges */}
            <div className="flex items-center gap-1 w-16">
              {holder.isContract && (
                <span className="text-[10px] px-1 py-0.5 bg-blue-500/20 text-blue-400 rounded">
                  CTR
                </span>
              )}
              {holder.isLocked && (
                <span className="text-[10px] px-1 py-0.5 bg-green-500/20 text-green-400 rounded">
                  LCK
                </span>
              )}
              {holder.tag && (
                <span className="text-[10px] px-1 py-0.5 bg-neutral-700 text-neutral-300 rounded">
                  {holder.tag}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upgrade prompt */}
      {!isPro && holders.length >= limit && (
        <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-800">
          <Link
            href="/pricing"
            className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            Upgrade to PRO to see {limits.topHolders} holders
          </Link>
        </div>
      )}
    </div>
  );
}
