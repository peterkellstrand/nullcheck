'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, LineSeries } from 'lightweight-charts';
import { ChainId } from '@/types/chain';
import { OHLCV } from '@/types/token';

interface TokenComparison {
  chainId: ChainId;
  address: string;
  symbol: string;
  color: string;
}

interface CompareChartProps {
  baseToken: { chainId: ChainId; address: string; symbol: string };
  height?: number;
}

const COMPARISON_COLORS = [
  '#6366f1', // indigo (base)
  '#22c55e', // green
  '#f59e0b', // amber
  '#ec4899', // pink
  '#14b8a6', // teal
];

export function CompareChart({ baseToken, height = 300 }: CompareChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());

  const [compareTokens, setCompareTokens] = useState<TokenComparison[]>([
    { ...baseToken, color: COMPARISON_COLORS[0] },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ chainId: ChainId; address: string; symbol: string; name: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#666666',
        fontFamily: 'SF Mono, ui-monospace, monospace',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#333333', width: 1, style: 2, labelBackgroundColor: '#111111' },
        horzLine: { color: '#333333', width: 1, style: 2, labelBackgroundColor: '#111111' },
      },
      rightPriceScale: {
        borderColor: '#333333',
        mode: 1, // Percentage mode for comparison
      },
      timeScale: {
        borderColor: '#333333',
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height,
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  // Fetch and render data for all tokens
  useEffect(() => {
    if (!chartRef.current || compareTokens.length === 0) return;

    async function fetchAllData() {
      setIsLoading(true);

      // Clear existing series
      seriesRefs.current.forEach((series) => {
        try {
          chartRef.current?.removeSeries(series);
        } catch {
          // Ignore
        }
      });
      seriesRefs.current.clear();

      // Fetch data for each token
      for (const token of compareTokens) {
        try {
          const response = await fetch(
            `/api/ohlcv/${token.chainId}/${token.address}?interval=1h&limit=96`
          );
          const data = await response.json();

          if (data.success && data.data?.ohlcv && data.data.ohlcv.length > 0) {
            const ohlcv: OHLCV[] = data.data.ohlcv.sort(
              (a: OHLCV, b: OHLCV) => a.timestamp - b.timestamp
            );

            // Normalize to percentage change from first price
            const firstPrice = ohlcv[0].close;
            const normalizedData = ohlcv.map((candle) => ({
              time: (candle.timestamp / 1000) as Time,
              value: ((candle.close - firstPrice) / firstPrice) * 100,
            }));

            // Create line series
            const lineSeries = chartRef.current!.addSeries(LineSeries, {
              color: token.color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title: token.symbol,
            });

            lineSeries.setData(normalizedData);
            seriesRefs.current.set(`${token.chainId}-${token.address}`, lineSeries);
          }
        } catch (err) {
          console.error(`Failed to fetch data for ${token.symbol}:`, err);
        }
      }

      chartRef.current?.timeScale().fitContent();
      setIsLoading(false);
    }

    fetchAllData();
  }, [compareTokens]);

  // Search for tokens
  const handleSearch = async () => {
    if (searchQuery.length < 2) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/tokens/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
      const data = await response.json();

      if (data.success && data.data?.tokens) {
        // Filter out already added tokens
        const existing = new Set(compareTokens.map((t) => `${t.chainId}-${t.address}`));
        setSearchResults(
          data.data.tokens.filter(
            (t: { chainId: ChainId; address: string }) => !existing.has(`${t.chainId}-${t.address}`)
          )
        );
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const addToken = (token: { chainId: ChainId; address: string; symbol: string }) => {
    if (compareTokens.length >= 5) return; // Max 5 tokens

    const colorIndex = compareTokens.length % COMPARISON_COLORS.length;
    setCompareTokens([
      ...compareTokens,
      { ...token, color: COMPARISON_COLORS[colorIndex] },
    ]);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeToken = (address: string, chainId: ChainId) => {
    // Can't remove base token
    if (address === baseToken.address && chainId === baseToken.chainId) return;
    setCompareTokens(compareTokens.filter((t) => !(t.address === address && t.chainId === chainId)));
  };

  return (
    <div className="border border-[var(--border)]">
      {/* Header with token pills and search */}
      <div className="p-4 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-neutral-500">compare tokens (% change)</span>
          {compareTokens.length < 5 && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="add token..."
                className="px-2 py-1 text-sm bg-transparent border border-neutral-700 text-neutral-300 placeholder-neutral-600 w-32 focus:outline-none focus:border-neutral-500"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching || searchQuery.length < 2}
                className="px-2 py-1 text-sm text-neutral-500 hover:text-neutral-300 disabled:opacity-50"
              >
                {isSearching ? '...' : '+'}
              </button>
            </div>
          )}
        </div>

        {/* Token Pills */}
        <div className="flex flex-wrap gap-2">
          {compareTokens.map((token) => (
            <div
              key={`${token.chainId}-${token.address}`}
              className="flex items-center gap-1 px-2 py-1 text-xs border border-neutral-700"
              style={{ borderColor: token.color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: token.color }} />
              <span className="text-neutral-300">{token.symbol}</span>
              {!(token.address === baseToken.address && token.chainId === baseToken.chainId) && (
                <button
                  onClick={() => removeToken(token.address, token.chainId)}
                  className="ml-1 text-neutral-500 hover:text-red-400"
                >
                  x
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-2 border border-neutral-700 bg-neutral-900">
            {searchResults.map((token) => (
              <button
                key={`${token.chainId}-${token.address}`}
                onClick={() => addToken(token)}
                className="w-full px-3 py-2 text-left text-sm text-neutral-400 hover:text-white hover:bg-neutral-800 flex justify-between"
              >
                <span>{token.symbol}</span>
                <span className="text-neutral-600">{token.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative p-4" style={{ height: height + 32 }}>
        <div ref={chartContainerRef} className="w-full h-full" />

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-neutral-500 text-sm">loading...</span>
          </div>
        )}
      </div>
    </div>
  );
}
