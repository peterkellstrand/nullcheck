'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
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

function calculateEMA(data: OHLCV[], period: number): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = [];
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);

  // Start with SMA for first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  let ema = sum / period;
  result.push({
    time: (data[period - 1].timestamp / 1000) as Time,
    value: ema,
  });

  // Calculate EMA for remaining data
  for (let i = period; i < data.length; i++) {
    ema = (data[i].close - ema) * multiplier + ema;
    result.push({
      time: (data[i].timestamp / 1000) as Time,
      value: ema,
    });
  }
  return result;
}

function calculateVWAP(data: OHLCV[]): { time: Time; value: number }[] {
  const result: { time: Time; value: number }[] = [];
  let cumulativePV = 0;
  let cumulativeVolume = 0;

  for (let i = 0; i < data.length; i++) {
    // Typical price = (high + low + close) / 3
    const typicalPrice = (data[i].high + data[i].low + data[i].close) / 3;
    cumulativePV += typicalPrice * data[i].volume;
    cumulativeVolume += data[i].volume;

    if (cumulativeVolume > 0) {
      result.push({
        time: (data[i].timestamp / 1000) as Time,
        value: cumulativePV / cumulativeVolume,
      });
    }
  }
  return result;
}

function calculateSupportResistance(data: OHLCV[]): { support: number; resistance: number } {
  if (data.length < 10) {
    return { support: 0, resistance: 0 };
  }

  // Find local minima and maxima using pivot points
  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];
  const lookback = 5;

  for (let i = lookback; i < data.length - lookback; i++) {
    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      if (data[i].high <= data[i - j].high || data[i].high <= data[i + j].high) {
        isHigh = false;
      }
      if (data[i].low >= data[i - j].low || data[i].low >= data[i + j].low) {
        isLow = false;
      }
    }

    if (isHigh) pivotHighs.push(data[i].high);
    if (isLow) pivotLows.push(data[i].low);
  }

  // Use recent pivot points weighted by recency
  const currentPrice = data[data.length - 1].close;

  // Find nearest resistance (above current price)
  const resistanceLevels = pivotHighs.filter(p => p > currentPrice).sort((a, b) => a - b);
  const resistance = resistanceLevels.length > 0 ? resistanceLevels[0] : Math.max(...data.map(d => d.high));

  // Find nearest support (below current price)
  const supportLevels = pivotLows.filter(p => p < currentPrice).sort((a, b) => b - a);
  const support = supportLevels.length > 0 ? supportLevels[0] : Math.min(...data.map(d => d.low));

  return { support, resistance };
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
  const ema9SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema20SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const supportLineRef = useRef<ISeriesApi<'Line'> | null>(null);
  const resistanceLineRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [internalTimeframe, setInternalTimeframe] = useState<TimeframeKey>('1d');
  const timeframe = externalTimeframe ?? internalTimeframe;
  const setTimeframe = setInternalTimeframe;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ChartStats | null>(null);
  const [ohlcvData, setOhlcvData] = useState<OHLCV[]>([]);

  // Memoize indicator calculations
  const ema9Data = useMemo(() => calculateEMA(ohlcvData, 9), [ohlcvData]);
  const ema20Data = useMemo(() => calculateEMA(ohlcvData, 20), [ohlcvData]);
  const ema50Data = useMemo(() => calculateEMA(ohlcvData, 50), [ohlcvData]);
  const vwapData = useMemo(() => calculateVWAP(ohlcvData), [ohlcvData]);
  const srLevels = useMemo(() => calculateSupportResistance(ohlcvData), [ohlcvData]);

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

    // Add EMA lines
    const ema9Series = chart.addSeries(LineSeries, {
      color: '#22d3ee', // cyan
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: '#f59e0b', // amber
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const ema50Series = chart.addSeries(LineSeries, {
      color: '#8b5cf6', // violet
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Add VWAP line
    const vwapSeries = chart.addSeries(LineSeries, {
      color: '#ec4899', // pink
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Add support/resistance lines
    const supportLine = chart.addSeries(LineSeries, {
      color: '#22c55e', // green
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const resistanceLine = chart.addSeries(LineSeries, {
      color: '#ef4444', // red
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = candlestickSeries;
    volumeSeriesRef.current = volumeSeries;
    ema9SeriesRef.current = ema9Series;
    ema20SeriesRef.current = ema20Series;
    ema50SeriesRef.current = ema50Series;
    vwapSeriesRef.current = vwapSeries;
    supportLineRef.current = supportLine;
    resistanceLineRef.current = resistanceLine;

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

        if (data.success && data.data?.ohlcv && data.data.ohlcv.length > 0) {
          const ohlcv: OHLCV[] = data.data.ohlcv;
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

          // Indicators are set in a separate effect using memoized data

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
          setError(data.error?.message || 'No chart data available');
        }
      } catch (err) {
        setError('Failed to load chart');
        console.error('OHLCV fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchOHLCV();
  }, [chainId, tokenAddress, timeframe, showVolume]);

  // Update indicator lines when memoized data changes
  useEffect(() => {
    if (!ema9SeriesRef.current || !ema20SeriesRef.current || !ema50SeriesRef.current) return;
    if (!vwapSeriesRef.current || !supportLineRef.current || !resistanceLineRef.current) return;

    if (showMA) {
      ema9SeriesRef.current.setData(ema9Data);
      ema20SeriesRef.current.setData(ema20Data);
      ema50SeriesRef.current.setData(ema50Data);
      vwapSeriesRef.current.setData(vwapData);

      if (ohlcvData.length >= 10) {
        const firstTime = (ohlcvData[0].timestamp / 1000) as Time;
        const lastTime = (ohlcvData[ohlcvData.length - 1].timestamp / 1000) as Time;

        if (srLevels.support > 0) {
          supportLineRef.current.setData([
            { time: firstTime, value: srLevels.support },
            { time: lastTime, value: srLevels.support },
          ]);
        }
        if (srLevels.resistance > 0) {
          resistanceLineRef.current.setData([
            { time: firstTime, value: srLevels.resistance },
            { time: lastTime, value: srLevels.resistance },
          ]);
        }
      }
    } else {
      ema9SeriesRef.current.setData([]);
      ema20SeriesRef.current.setData([]);
      ema50SeriesRef.current.setData([]);
      vwapSeriesRef.current.setData([]);
      supportLineRef.current.setData([]);
      resistanceLineRef.current.setData([]);
    }
  }, [showMA, ema9Data, ema20Data, ema50Data, vwapData, srLevels, ohlcvData]);

  return (
    <div>
      {/* Timeframe Selector */}
      {showTimeframeSelector && (
        <div className={`flex items-center justify-between ${compact ? 'mb-2' : 'mb-4'}`}>
          <div className={`${compact ? 'text-[10px]' : 'text-xs'} text-neutral-500`}>
            price chart
            {showMA && (
              <span className="ml-3">
                <span className="text-cyan-400">EMA9</span>
                <span className="mx-1">/</span>
                <span className="text-amber-500">EMA20</span>
                <span className="mx-1">/</span>
                <span className="text-violet-500">EMA50</span>
                <span className="mx-2">|</span>
                <span className="text-pink-500">VWAP</span>
                <span className="mx-2">|</span>
                <span className="text-green-500">S</span>
                <span className="mx-1">/</span>
                <span className="text-red-500">R</span>
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
