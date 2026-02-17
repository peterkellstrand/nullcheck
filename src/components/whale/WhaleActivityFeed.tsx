'use client';

import { useState, useEffect } from 'react';
import { ChainId } from '@/types/chain';
import { WhaleActivity } from '@/types/whale';
import { Skeleton } from '@/components/ui';

interface WhaleActivityFeedProps {
  chainId: ChainId;
  tokenAddress: string;
}

export function WhaleActivityFeed({ chainId, tokenAddress }: WhaleActivityFeedProps) {
  const [activity, setActivity] = useState<WhaleActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchActivity() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/whale/activity/${chainId}/${tokenAddress}`
        );
        const data = await response.json();

        if (data.success && data.data) {
          // API returns activity fields directly in data.data
          setActivity({
            count24h: data.data.count24h || 0,
            buyCount24h: data.data.buyCount24h || 0,
            sellCount24h: data.data.sellCount24h || 0,
            netFlow24h: data.data.netFlow24h || 0,
          });
        } else {
          setError(data.error?.message || 'Failed to load activity');
        }
      } catch {
        setError('Failed to load activity');
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivity();
  }, [chainId, tokenAddress]);

  if (isLoading) {
    return (
      <div className="border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-sm font-medium text-neutral-300 mb-3">
          Whale Activity (24h)
        </h3>
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error || !activity) {
    return (
      <div className="border border-neutral-800 bg-neutral-900 p-4">
        <h3 className="text-sm font-medium text-neutral-300 mb-3">
          Whale Activity (24h)
        </h3>
        <p className="text-neutral-500 text-sm">
          {error || 'No activity data available'}
        </p>
      </div>
    );
  }

  const { count24h, buyCount24h, sellCount24h, netFlow24h } = activity;
  const sentiment = netFlow24h > 0 ? 'bullish' : netFlow24h < 0 ? 'bearish' : 'neutral';

  return (
    <div className="border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-neutral-300">
          Whale Activity (24h)
        </h3>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            sentiment === 'bullish'
              ? 'bg-green-500/20 text-green-400'
              : sentiment === 'bearish'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-neutral-700 text-neutral-400'
          }`}
        >
          {sentiment === 'bullish' ? 'Bullish' : sentiment === 'bearish' ? 'Bearish' : 'Neutral'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Total Activity */}
        <div>
          <div className="text-2xl font-bold text-neutral-200 tabular-nums">
            {count24h}
          </div>
          <div className="text-xs text-neutral-500">Large Txns</div>
        </div>

        {/* Buys */}
        <div>
          <div className="text-2xl font-bold text-green-400 tabular-nums">
            {buyCount24h}
          </div>
          <div className="text-xs text-neutral-500">Buys</div>
        </div>

        {/* Sells */}
        <div>
          <div className="text-2xl font-bold text-red-400 tabular-nums">
            {sellCount24h}
          </div>
          <div className="text-xs text-neutral-500">Sells</div>
        </div>
      </div>

      {/* Buy/Sell Ratio Bar */}
      {count24h > 0 && (
        <div className="mt-4">
          <div className="flex h-2 rounded-full overflow-hidden bg-neutral-800">
            <div
              className="bg-green-500 transition-all"
              style={{
                width: `${(buyCount24h / count24h) * 100}%`,
              }}
            />
            <div
              className="bg-red-500 transition-all"
              style={{
                width: `${(sellCount24h / count24h) * 100}%`,
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-neutral-500">
            <span>
              {count24h > 0 ? ((buyCount24h / count24h) * 100).toFixed(0) : 0}% buys
            </span>
            <span>
              {count24h > 0 ? ((sellCount24h / count24h) * 100).toFixed(0) : 0}% sells
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
