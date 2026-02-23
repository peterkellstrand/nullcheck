'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, Time, LineSeries, AreaSeries } from 'lightweight-charts';
import { ChainId } from '@/types/chain';
import { useSubscription } from '@/hooks/useSubscription';
import Link from 'next/link';

interface RiskHistoryEntry {
  totalScore: number;
  riskLevel: string;
  honeypotScore: number | null;
  contractScore: number | null;
  holdersScore: number | null;
  liquidityScore: number | null;
  recordedAt: string;
}

interface RiskHistoryChartProps {
  chainId: ChainId;
  tokenAddress: string;
  height?: number;
}

function getRiskColor(score: number): string {
  if (score <= 25) return '#22c55e'; // green - low risk
  if (score <= 50) return '#f59e0b'; // amber - medium risk
  if (score <= 75) return '#f97316'; // orange - high risk
  return '#ef4444'; // red - critical risk
}

export function RiskHistoryChart({
  chainId,
  tokenAddress,
  height = 200,
}: RiskHistoryChartProps) {
  const { limits } = useSubscription();
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<RiskHistoryEntry[]>([]);
  const [days, setDays] = useState<7 | 30 | 90>(30);

  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const honeypotSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const contractSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Check PRO access
  if (!limits.hasHistoricalData) {
    return (
      <div className="border border-[var(--border)] p-6 text-center">
        <div className="text-neutral-500 mb-3">Risk score history</div>
        <p className="text-sm text-neutral-600 mb-4">
          Track how risk scores change over time
        </p>
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm border border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
        >
          <span>Upgrade to PRO</span>
          <span className="text-[10px] px-1 py-0.5 bg-emerald-500/20">PRO</span>
        </Link>
      </div>
    );
  }

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
        autoScale: true,
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

    // Create series
    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: '#6366f1', // indigo
      topColor: 'rgba(99, 102, 241, 0.4)',
      bottomColor: 'rgba(99, 102, 241, 0.0)',
      lineWidth: 2,
      priceLineVisible: true,
      lastValueVisible: true,
    });

    const honeypotSeries = chart.addSeries(LineSeries, {
      color: '#ef4444', // red
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const contractSeries = chart.addSeries(LineSeries, {
      color: '#f59e0b', // amber
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    areaSeriesRef.current = areaSeries;
    honeypotSeriesRef.current = honeypotSeries;
    contractSeriesRef.current = contractSeries;

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

  // Fetch data when days or token changes
  useEffect(() => {
    async function fetchHistory() {
      if (!chartRef.current) return;

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/risk/history/${chainId}/${tokenAddress}?days=${days}`
        );

        if (!response.ok) {
          const data = await response.json();
          if (data.error?.code === 'PRO_REQUIRED') {
            setError('PRO subscription required');
          } else {
            setError(data.error?.message || 'Failed to load history');
          }
          return;
        }

        const data = await response.json();

        if (data.success && data.data?.history) {
          setHistory(data.data.history);

          if (data.data.history.length === 0) {
            setError('No history data yet');
            return;
          }

          // Map history to chart data
          const chartData = data.data.history.map((entry: RiskHistoryEntry) => ({
            time: (new Date(entry.recordedAt).getTime() / 1000) as Time,
            value: entry.totalScore,
          }));

          // Update area series with total score
          if (areaSeriesRef.current) {
            areaSeriesRef.current.setData(chartData);
          }

          // Update honeypot score line
          if (honeypotSeriesRef.current) {
            const honeypotData = data.data.history
              .filter((e: RiskHistoryEntry) => e.honeypotScore !== null)
              .map((e: RiskHistoryEntry) => ({
                time: (new Date(e.recordedAt).getTime() / 1000) as Time,
                value: e.honeypotScore as number,
              }));
            honeypotSeriesRef.current.setData(honeypotData);
          }

          // Update contract score line
          if (contractSeriesRef.current) {
            const contractData = data.data.history
              .filter((e: RiskHistoryEntry) => e.contractScore !== null)
              .map((e: RiskHistoryEntry) => ({
                time: (new Date(e.recordedAt).getTime() / 1000) as Time,
                value: e.contractScore as number,
              }));
            contractSeriesRef.current.setData(contractData);
          }

          chartRef.current.timeScale().fitContent();
        } else {
          setError('No history data available');
        }
      } catch (err) {
        setError('Failed to load risk history');
        console.error('Risk history fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [chainId, tokenAddress, days]);

  const latestScore = history.length > 0 ? history[history.length - 1].totalScore : null;

  return (
    <div className="border border-[var(--border)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <span className="text-sm text-neutral-400">risk score history</span>
          {latestScore !== null && (
            <span
              className="text-sm font-medium"
              style={{ color: getRiskColor(latestScore) }}
            >
              {latestScore}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2 py-1 text-xs transition-colors ${
                days === d
                  ? 'text-[#ffffff] bg-neutral-800'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b border-[var(--border)] text-[10px]">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
          <span className="text-neutral-500">total</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          <span className="text-neutral-500">honeypot</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
          <span className="text-neutral-500">contract</span>
        </span>
      </div>

      {/* Chart */}
      <div className="relative p-4" style={{ height: height + 32 }}>
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
