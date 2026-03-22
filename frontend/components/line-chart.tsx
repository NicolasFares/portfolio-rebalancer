"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  currency?: string;
  color?: string;
  height?: number;
  showArea?: boolean;
}

const PADDING = { top: 20, right: 16, bottom: 32, left: 72 };

export function LineChart({
  data,
  currency = "CAD",
  color = "var(--color-gold)",
  height = 260,
  showArea = true,
}: LineChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        No data available
      </div>
    );
  }

  const width = 600;
  const chartW = width - PADDING.left - PADDING.right;
  const chartH = height - PADDING.top - PADDING.bottom;

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const yPad = range * 0.08;
  const yMin = minVal - yPad;
  const yMax = maxVal + yPad;

  const toX = (i: number) => PADDING.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const toY = (v: number) => PADDING.top + (1 - (v - yMin) / (yMax - yMin)) * chartH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(d.value).toFixed(1)}`)
    .join(" ");

  const areaPath = `${linePath} L ${toX(data.length - 1).toFixed(1)} ${(PADDING.top + chartH).toFixed(1)} L ${PADDING.left.toFixed(1)} ${(PADDING.top + chartH).toFixed(1)} Z`;

  // Y-axis ticks (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);

  // X-axis labels (show ~5 labels)
  const labelStep = Math.max(1, Math.floor(data.length / 5));
  const xLabels = data.filter((_, i) => i % labelStep === 0 || i === data.length - 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ maxHeight: height }}
    >
      {/* Grid lines */}
      {yTicks.map((tick) => (
        <line
          key={tick}
          x1={PADDING.left}
          x2={width - PADDING.right}
          y1={toY(tick)}
          y2={toY(tick)}
          stroke="var(--color-border)"
          strokeWidth={0.5}
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.map((tick) => (
        <text
          key={tick}
          x={PADDING.left - 8}
          y={toY(tick) + 4}
          textAnchor="end"
          className="fill-muted-foreground"
          fontSize={10}
        >
          {formatCurrency(tick, currency)}
        </text>
      ))}

      {/* X-axis labels */}
      {xLabels.map((d) => {
        const i = data.indexOf(d);
        return (
          <text
            key={d.label}
            x={toX(i)}
            y={height - 6}
            textAnchor="middle"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {d.label}
          </text>
        );
      })}

      {/* Area fill */}
      {showArea && (
        <path
          d={mounted ? areaPath : ""}
          fill={color}
          opacity={0.08}
          className="transition-all duration-700 ease-out"
        />
      )}

      {/* Line */}
      <path
        d={mounted ? linePath : ""}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        className="transition-all duration-700 ease-out"
      />

      {/* End dot */}
      {data.length > 0 && mounted && (
        <circle
          cx={toX(data.length - 1)}
          cy={toY(data[data.length - 1].value)}
          r={3.5}
          fill={color}
          className="transition-all duration-700 ease-out"
        />
      )}
    </svg>
  );
}
