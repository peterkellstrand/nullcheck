'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Liveline } from 'liveline';
import type { LivelinePoint } from 'liveline';
import { ChainId } from '@/types/chain';

interface LivePriceChartProps {
  chainId: ChainId;
  tokenAddress: string;
  initialPrice?: number;
  height?: number;
}

export function LivePriceChart({
  chainId,
  tokenAddress,
  initialPrice = 0,
  height = 200,
}: LivePriceChartProps) {
  const [data, setData] = useState<LivelinePoint[]>([]);
  const [value, setValue] = useState(initialPrice);
  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState(60); // 1 minute default
  const mountedRef = useRef(true);
  const lastPriceRef = useRef(initialPrice);

  // Format price based on magnitude
  const formatValue = useCallback((v: number) => {
    if (v === 0) return '$0.00';
    if (v < 0.00001) return `$${v.toExponential(2)}`;
    if (v < 0.01) return `$${v.toFixed(6)}`;
    if (v < 1) return `$${v.toFixed(4)}`;
    if (v < 1000) return `$${v.toFixed(2)}`;
    return `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  }, []);

  // Initialize with initial price
  useEffect(() => {
    if (initialPrice > 0 && data.length === 0) {
      const now = Math.floor(Date.now() / 1000);
      setData([{ time: now, value: initialPrice }]);
      setValue(initialPrice);
      lastPriceRef.current = initialPrice;
      setLoading(false);
    }
  }, [initialPrice, data.length]);

  // Poll for price updates
  useEffect(() => {
    mountedRef.current = true;
    let intervalId: NodeJS.Timeout;

    const fetchPrice = async () => {
      if (!mountedRef.current) return;

      try {
        // Use refresh=true to get fresh data
        const response = await fetch(`/api/token/${chainId}/${tokenAddress}?refresh=true`);
        const result = await response.json();

        if (!mountedRef.current) return;

        if (result.success && result.data?.token?.metrics?.price) {
          const price = result.data.token.metrics.price;
          const now = Math.floor(Date.now() / 1000);

          // Always add a new point to show activity
          setData((prev) => {
            const cutoff = now - 600; // Keep 10 minutes
            const filtered = prev.filter((p) => p.time > cutoff);
            return [...filtered, { time: now, value: price }];
          });

          setValue(price);
          lastPriceRef.current = price;
          setLoading(false);
        }
      } catch (err) {
        console.error('Price fetch error:', err);
      }
    };

    // Initial fetch
    fetchPrice();

    // Poll every 3 seconds
    intervalId = setInterval(fetchPrice, 3000);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [chainId, tokenAddress]);

  return (
    <div style={{ height }} className="w-full">
      <Liveline
        data={data}
        value={value}
        loading={loading}
        color="#6366f1"
        theme="dark"
        grid={true}
        badge={true}
        badgeVariant="default"
        fill={true}
        pulse={true}
        momentum={true}
        scrub={true}
        exaggerate={true}
        showValue={true}
        valueMomentumColor={true}
        degen={false}
        window={window}
        windows={[
          { label: '30s', secs: 30 },
          { label: '1m', secs: 60 },
          { label: '5m', secs: 300 },
        ]}
        onWindowChange={setWindow}
        windowStyle="default"
        formatValue={formatValue}
        padding={{ top: 48, right: 80, bottom: 28, left: 12 }}
        emptyText="Waiting for price data..."
      />
    </div>
  );
}
