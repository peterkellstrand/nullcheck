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
  height = 250,
}: LivePriceChartProps) {
  const [data, setData] = useState<LivelinePoint[]>([]);
  const [value, setValue] = useState(initialPrice);
  const [loading, setLoading] = useState(true);
  const [window, setWindow] = useState(60);
  const mountedRef = useRef(true);

  // Format price based on magnitude
  const formatValue = useCallback((v: number) => {
    if (v === 0) return '$0.00';
    if (v < 0.0000001) return `$${v.toExponential(2)}`;
    if (v < 0.00001) return `$${v.toFixed(8)}`;
    if (v < 0.001) return `$${v.toFixed(6)}`;
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
        const response = await fetch(`/api/token/${chainId}/${tokenAddress}?refresh=true`);
        const result = await response.json();

        if (!mountedRef.current) return;

        if (result.success && result.data?.token?.metrics?.price) {
          const price = result.data.token.metrics.price;
          const now = Math.floor(Date.now() / 1000);

          setData((prev) => {
            const cutoff = now - 600; // Keep 10 minutes
            const filtered = prev.filter((p) => p.time > cutoff);
            return [...filtered, { time: now, value: price }];
          });

          setValue(price);
          setLoading(false);
        }
      } catch (err) {
        console.error('Price fetch error:', err);
      }
    };

    fetchPrice();
    intervalId = setInterval(fetchPrice, 3000);

    return () => {
      mountedRef.current = false;
      clearInterval(intervalId);
    };
  }, [chainId, tokenAddress]);

  const handleWindowChange = useCallback((secs: number) => {
    setWindow(secs);
  }, []);

  return (
    <div style={{ height }} className="w-full">
      <Liveline
        data={data}
        value={value}
        loading={loading}
        color="#00ffa3"
        theme="dark"
        exaggerate
        degen
        showValue
        valueMomentumColor
        scrub
        pulse
        momentum
        badge
        badgeVariant="default"
        fill
        grid
        window={window}
        windows={[
          { label: '10s', secs: 10 },
          { label: '30s', secs: 30 },
          { label: '1m', secs: 60 },
          { label: '5m', secs: 300 },
        ]}
        onWindowChange={handleWindowChange}
        formatValue={formatValue}
        emptyText="Waiting for price data..."
      />
    </div>
  );
}
