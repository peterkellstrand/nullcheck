'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CandlestickData, Time, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts';
import { ChainId } from '@/types/chain';
import { OHLCV } from '@/types/token';

interface PriceChartProps {
  chainId: ChainId;
  tokenAddress: string;
  height?: number;
  showTimeframeSelector?: boolean;
  externalTimeframe?: TimeframeKey;
  compact?: boolean;
  showVolume?: boolean;
  showMA?: boolean;
}

type TimeframeKey = '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

interface ChartStats {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}

const TIMEFRAMES: { key: TimeframeKey; label: string; interval: string; limit: number }[] = [
  { key: '5m', label: '5M', interval: '1m', limit: 60 },
  { key: '15m', label: '15M', interval: '1m', limit: 60 },
  { key: '1h', label: '1H', interval: '5m', limit: 60 },
  { key: '4h', label: '4H', interval: '15m', limit: 64 },
  { key: '1d', label: '1D', interval: '1h', limit: 96 },
  { key: '1w', label: '1W', interval: '4h', limit: 84 },
];

function formatChartPrice(price: number): string {
  if (price < 0.00001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  if (price < 1000) return price.toFixed(2);
  return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return `${(vol / 1e9).toFixed(1)}B`;
  if (vol >= 1e6) return `${(vol / 1e6).toFixed(1)}M`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
  return vol.toFixed(0);
}

function calculateMA(data: OHLCV[], period: number): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push({
      time: (data[i].timestamp / 1000) as Time,
      value: sum / period,
    });
  }
  return result;
}

export function PriceChart({
  chainId,
  tokenAddress,
  height = 300,
  showTimeframeSelector = true,
  externalTimeframe,
  compact = false,
  showVolume = true,
  showMA = false,
}: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ma7SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ma25SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [internalTimeframe, setInternalTimeframe] = useState<TimeframeKey>('1d');
  const timeframe = externalTimeframe ?? internalTimeframe;
  const setTimeframe = setInternalTimeframe;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ChartStats | null>(null);
  const [ohlcvData, setOhlcvData] = useState<OHLCV[]>([]);

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
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Add volume histogram
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#333333',
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });

    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
      borderVisible: false,
    });

    // Add MA lines if enabled
    const ma7Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const ma25Series = chart.addSeries(LineSeries, {
      color: '#8b5cf6',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;
    ma7SeriesRef.current = ma7Series;
    ma25SeriesRef.current = ma25Series;

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
          `/api/ohlcv/${chainId}/${tokenAddress}?interval=${tf?.interval || '1h'}&limit=${tf?.limit || 100}`
        );
        const data = await response.json();

        if (data.success && data.ohlcv && data.ohlcv.length > 0) {
          const ohlcv: OHLCV[] = data.ohlcv;
          setOhlcvData(ohlcv);

          // Candlestick data
          const chartData: CandlestickData<Time>[] = ohlcv.map((candle: OHLCV) => ({
            time: (candle.timestamp / 1000) as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          }));
          seriesRef.current.setData(chartData);

          // Volume data
          if (showVolume && volumeSeriesRef.current) {
            const volumeData = ohlcv.map((candle: OHLCV) => ({
              time: (candle.timestamp / 1000) as Time,
              value: candle.volume,
              color: candle.close >= candle.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            }));
            volumeSeriesRef.current.setData(volumeData);
          }

          // MA lines
          if (showMA && ma7SeriesRef.current && ma25SeriesRef.current) {
            ma7SeriesRef.current.setData(calculateMA(ohlcv, 7));
            ma25SeriesRef.current.setData(calculateMA(ohlcv, 25));
          } else if (ma7SeriesRef.current && ma25SeriesRef.current) {
            ma7SeriesRef.current.setData([]);
            ma25SeriesRef.current.setData([]);
          }

          // Calculate stats
          const first = ohlcv[0];
          const last = ohlcv[ohlcv.length - 1];
          const periodHigh = Math.max(...ohlcv.map(c => c.high));
          const periodLow = Math.min(...ohlcv.map(c => c.low));
          const totalVolume = ohlcv.reduce((sum, c) => sum + c.volume, 0);
          const change = last.close - first.open;
          const changePercent = (change / first.open) * 100;

          setStats({
            open: first.open,
            high: periodHigh,
            low: periodLow,
            close: last.close,
            volume: totalVolume,
            change,
            changePercent,
          });

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
  }, [chainId, tokenAddress, timeframe, showVolume, showMA]);

  return (
    <div>
      {/* Timeframe Selector */}
      {showTimeframeSelector && (
        <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-neutral-500`}>
            price chart
            {showMA && (
              <span className="ml-3">
                <span className="text-amber-500">MA7</span>
                <span className="mx-1">/</span>
                <span className="text-violet-500">MA25</span>
              </span>
            )}
          </div>
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

      {/* OHLCV Stats Bar */}
      {stats && !compact && (
        <div className="flex items-center gap-4 mb-3 text-xs">
          <div>
            <span className="text-neutral-500">O </span>
            <span className="text-neutral-300 tabular-nums">{formatChartPrice(stats.open)}</span>
          </div>
          <div>
            <span className="text-neutral-500">H </span>
            <span className="text-green-500 tabular-nums">{formatChartPrice(stats.high)}</span>
          </div>
          <div>
            <span className="text-neutral-500">L </span>
            <span className="text-red-500 tabular-nums">{formatChartPrice(stats.low)}</span>
          </div>
          <div>
            <span className="text-neutral-500">C </span>
            <span className="text-neutral-300 tabular-nums">{formatChartPrice(stats.close)}</span>
          </div>
          <div>
            <span className="text-neutral-500">Vol </span>
            <span className="text-neutral-300 tabular-nums">${formatVolume(stats.volume)}</span>
          </div>
          <div>
            <span className={`tabular-nums ${stats.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.changePercent >= 0 ? '+' : ''}{stats.changePercent.toFixed(2)}%
            </span>
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
