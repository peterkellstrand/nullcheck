'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries } from 'lightweight-charts';
import { ChainId } from '@/types/chain';
import { OHLCV } from '@/types/token';

interface PriceChartProps {
  chainId: ChainId;
  tokenAddress: string;
  height?: number;
  showTimeframeSelector?: boolean;
  externalTimeframe?: TimeframeKey;
  compact?: boolean;
}

type TimeframeKey = '1h' | '4h' | '1d' | '1w';

const TIMEFRAMES: { key: TimeframeKey; label: string; interval: string }[] = [
  { key: '1h', label: '1H', interval: '5m' },
  { key: '4h', label: '4H', interval: '15m' },
  { key: '1d', label: '1D', interval: '1h' },
  { key: '1w', label: '1W', interval: '4h' },
];

export function PriceChart({
  chainId,
  tokenAddress,
  height = 300,
  showTimeframeSelector = true,
  externalTimeframe,
  compact = false,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  const [internalTimeframe, setInternalTimeframe] = useState<TimeframeKey>('1d');
  const timeframe = externalTimeframe ?? internalTimeframe;
  const setTimeframe = setInternalTimeframe;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        vertLine: {
          color: '#333333',
          width: 1,
          style: 2,
          labelBackgroundColor: '#111111',
        },
        horzLine: {
          color: '#333333',
          width: 1,
          style: 2,
          labelBackgroundColor: '#111111',
        },
      },
      rightPriceScale: {
        borderColor: '#333333',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: '#333333',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
      width: chartContainerRef.current.clientWidth,
      height,
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#4a9',
      downColor: '#c55',
      borderUpColor: '#4a9',
      borderDownColor: '#c55',
      wickUpColor: '#4a9',
      wickDownColor: '#c55',
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [height]);

  // Fetch data when timeframe changes
  useEffect(() => {
    async function fetchOHLCV() {
      if (!seriesRef.current) return;

      setIsLoading(true);
      setError(null);

      try {
        const tf = TIMEFRAMES.find((t) => t.key === timeframe);
        const response = await fetch(
          `/api/ohlcv/${chainId}/${tokenAddress}?interval=${tf?.interval || '1h'}&limit=100`
        );
        const data = await response.json();

        if (data.success && data.ohlcv) {
          const chartData: CandlestickData<Time>[] = data.ohlcv.map((candle: OHLCV) => ({
            time: (candle.timestamp / 1000) as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));

          seriesRef.current.setData(chartData);
          chartRef.current?.timeScale().fitContent();
        } else {
          setError(data.error || 'No chart data available');
        }
      } catch (err) {
        setError('Failed to load chart');
        console.error('OHLCV fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOHLCV();
  }, [chainId, tokenAddress, timeframe]);

  return (
    <div>
      {/* Timeframe Selector */}
      {showTimeframeSelector && (
        <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-neutral-500`}>price chart</div>
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className={`px-2 py-1 ${compact ? 'text-[10px]' : 'text-xs'} transition-colors ${
                  timeframe === tf.key
                    ? 'text-[#ffffff] bg-neutral-800'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div className="relative" style={{ height }}>
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <span className="text-neutral-500 text-sm">loading...</span>
          </div>
        )}

        {/* Error Overlay */}
        {error && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-neutral-600 text-sm">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
