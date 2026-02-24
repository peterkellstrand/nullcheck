'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { IChartApi, ISeriesApi, Time, LineSeries, createChart } from 'lightweight-charts';

export type DrawingTool = 'none' | 'trendline' | 'horizontal' | 'fibonacci';

export interface Drawing {
  id: string;
  type: DrawingTool;
  points: { time: Time; price: number }[];
  color?: string;
}

interface DrawingToolsProps {
  chart: IChartApi | null;
  series: ISeriesApi<'Candlestick'> | null;
  onDrawingComplete?: (drawing: Drawing) => void;
}

const TOOL_CONFIG = {
  trendline: { label: 'Trend', icon: '/' , points: 2, color: '#6366f1' },
  horizontal: { label: 'H-Line', icon: '—', points: 1, color: '#22c55e' },
  fibonacci: { label: 'Fib', icon: 'F', points: 2, color: '#f59e0b' },
};

const FIBONACCI_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

type ActiveDrawingTool = Exclude<DrawingTool, 'none'>;

export function DrawingToolbar({
  activeTool,
  onToolChange,
  onClear,
}: {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  onClear: () => void;
}) {
  const tools = Object.keys(TOOL_CONFIG) as ActiveDrawingTool[];

  return (
    <div className="flex items-center gap-1 border border-neutral-700 p-1">
      {tools.map((tool) => (
        <button
          key={tool}
          onClick={() => onToolChange(activeTool === tool ? 'none' : tool)}
          className={`px-2 py-1 text-xs transition-colors ${
            activeTool === tool
              ? 'text-[#ffffff] bg-neutral-700'
              : 'text-neutral-500 hover:text-neutral-300'
          }`}
          title={TOOL_CONFIG[tool].label}
        >
          {TOOL_CONFIG[tool].icon}
        </button>
      ))}
      <div className="w-px h-4 bg-neutral-700 mx-1" />
      <button
        onClick={onClear}
        className="px-2 py-1 text-xs text-neutral-500 hover:text-red-400 transition-colors"
        title="Clear all drawings"
      >
        x
      </button>
    </div>
  );
}

export function useDrawingTools(
  chart: IChartApi | null,
  series: ISeriesApi<'Candlestick'> | null,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const [activeTool, setActiveTool] = useState<DrawingTool>('none');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [pendingPoints, setPendingPoints] = useState<{ time: Time; price: number }[]>([]);
  const drawingSeriesRef = useRef<Map<string, ISeriesApi<'Line'>[]>>(new Map());

  // Convert pixel coordinates to price/time
  const pixelToCoordinates = useCallback(
    (x: number, y: number): { time: Time; price: number } | null => {
      if (!chart || !series || !containerRef.current) return null;

      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = x - rect.left;
      const relativeY = y - rect.top;

      const timeCoord = chart.timeScale().coordinateToTime(relativeX);
      const priceCoord = series.coordinateToPrice(relativeY);

      if (timeCoord === null || priceCoord === null) return null;

      return { time: timeCoord, price: priceCoord };
    },
    [chart, series, containerRef]
  );

  // Handle click on chart
  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (activeTool === 'none' || !chart || !series) return;

      const coords = pixelToCoordinates(event.clientX, event.clientY);
      if (!coords) return;

      const config = TOOL_CONFIG[activeTool];
      const newPoints = [...pendingPoints, coords];

      if (newPoints.length >= config.points) {
        // Complete the drawing
        const drawing: Drawing = {
          id: `${activeTool}-${Date.now()}`,
          type: activeTool,
          points: newPoints,
          color: config.color,
        };
        setDrawings((prev) => [...prev, drawing]);
        setPendingPoints([]);
        setActiveTool('none');
      } else {
        setPendingPoints(newPoints);
      }
    },
    [activeTool, pendingPoints, pixelToCoordinates, chart, series]
  );

  // Attach click listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container || activeTool === 'none') return;

    container.style.cursor = 'crosshair';
    container.addEventListener('click', handleClick);

    return () => {
      container.style.cursor = 'default';
      container.removeEventListener('click', handleClick);
    };
  }, [containerRef, activeTool, handleClick]);

  // Render drawings on chart
  useEffect(() => {
    if (!chart) return;

    // Clear existing drawing series
    drawingSeriesRef.current.forEach((seriesList) => {
      seriesList.forEach((s) => {
        try {
          chart.removeSeries(s);
        } catch {
          // Series may already be removed
        }
      });
    });
    drawingSeriesRef.current.clear();

    // Render each drawing
    drawings.forEach((drawing) => {
      const seriesList: ISeriesApi<'Line'>[] = [];

      if (drawing.type === 'trendline' && drawing.points.length >= 2) {
        const lineSeries = chart.addSeries(LineSeries, {
          color: drawing.color || '#6366f1',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        lineSeries.setData([
          { time: drawing.points[0].time, value: drawing.points[0].price },
          { time: drawing.points[1].time, value: drawing.points[1].price },
        ]);
        seriesList.push(lineSeries);
      }

      if (drawing.type === 'horizontal' && drawing.points.length >= 1) {
        const lineSeries = chart.addSeries(LineSeries, {
          color: drawing.color || '#22c55e',
          lineWidth: 1,
          lineStyle: 2, // dashed
          priceLineVisible: false,
          lastValueVisible: true,
        });
        // Get visible time range for horizontal line
        const timeRange = chart.timeScale().getVisibleRange();
        if (timeRange) {
          lineSeries.setData([
            { time: timeRange.from, value: drawing.points[0].price },
            { time: timeRange.to, value: drawing.points[0].price },
          ]);
        }
        seriesList.push(lineSeries);
      }

      if (drawing.type === 'fibonacci' && drawing.points.length >= 2) {
        const [p1, p2] = drawing.points;
        const priceDiff = p2.price - p1.price;
        const timeRange = chart.timeScale().getVisibleRange();

        if (timeRange) {
          FIBONACCI_LEVELS.forEach((level, idx) => {
            const price = p1.price + priceDiff * level;
            const colors = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#14b8a6'];
            const lineSeries = chart.addSeries(LineSeries, {
              color: colors[idx] || '#f59e0b',
              lineWidth: 1,
              lineStyle: 2,
              priceLineVisible: false,
              lastValueVisible: true,
            });
            lineSeries.setData([
              { time: timeRange.from, value: price },
              { time: timeRange.to, value: price },
            ]);
            seriesList.push(lineSeries);
          });
        }
      }

      drawingSeriesRef.current.set(drawing.id, seriesList);
    });

    return () => {
      // Cleanup on unmount
      drawingSeriesRef.current.forEach((seriesList) => {
        seriesList.forEach((s) => {
          try {
            chart.removeSeries(s);
          } catch {
            // Ignore
          }
        });
      });
    };
  }, [chart, drawings]);

  const clearDrawings = useCallback(() => {
    setDrawings([]);
    setPendingPoints([]);
  }, []);

  return {
    activeTool,
    setActiveTool,
    drawings,
    pendingPoints,
    clearDrawings,
  };
}
