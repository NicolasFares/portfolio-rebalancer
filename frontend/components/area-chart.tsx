"use client";

import { useEffect, useState } from "react";

// Same palette as donut-chart.tsx
const PALETTE_STROKE = [
  "var(--color-gold)",
  "var(--color-blue)",
  "var(--color-green)",
  "var(--color-orange)",
  "var(--color-purple)",
  "var(--color-yellow)",
  "var(--color-red)",
  "hsl(180 40% 55%)",
  "hsl(320 35% 55%)",
  "hsl(60 45% 55%)",
];

const PALETTE_DOT = [
  "bg-gold",
  "bg-blue",
  "bg-green",
  "bg-orange",
  "bg-purple",
  "bg-yellow",
  "bg-red",
  "bg-[hsl(180_40%_55%)]",
  "bg-[hsl(320_35%_55%)]",
  "bg-[hsl(60_45%_55%)]",
];

interface AreaDataPoint {
  label: string;
  values: Record<string, number>; // category -> percentage
}

interface AreaChartProps {
  data: AreaDataPoint[];
  categories: string[];
  height?: number;
}

const PADDING = { top: 12, right: 16, bottom: 32, left: 40 };

export function AreaChart({ data, categories, height = 260 }: AreaChartProps) {
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

  const toX = (i: number) => PADDING.left + (i / Math.max(data.length - 1, 1)) * chartW;
  const toY = (pct: number) => PADDING.top + (1 - pct / 100) * chartH;

  // Build stacked areas — categories stacked bottom to top
  const stackedPaths: { category: string; path: string; color: string }[] = [];

  // Compute cumulative values
  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci];
    const color = PALETTE_STROKE[ci % PALETTE_STROKE.length];

    // For each data point, cumulative = sum of categories[0..ci]
    const topPoints = data.map((d, i) => {
      let cum = 0;
      for (let j = 0; j <= ci; j++) {
        cum += d.values[categories[j]] || 0;
      }
      return { x: toX(i), y: toY(cum) };
    });

    // Bottom edge = cumulative of categories[0..ci-1]
    const bottomPoints = data.map((d, i) => {
      let cum = 0;
      for (let j = 0; j < ci; j++) {
        cum += d.values[categories[j]] || 0;
      }
      return { x: toX(i), y: toY(cum) };
    });

    // Build path: top line forward, bottom line backward
    const topLine = topPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const bottomLine = [...bottomPoints].reverse().map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
    const path = `${topLine} ${bottomLine} Z`;

    stackedPaths.push({ category: cat, path, color });
  }

  // Y-axis ticks
  const yTicks = [0, 25, 50, 75, 100];

  // X-axis labels
  const labelStep = Math.max(1, Math.floor(data.length / 5));
  const xLabels = data.filter((_, i) => i % labelStep === 0 || i === data.length - 1);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ maxHeight: height }}
      >
        {/* Grid */}
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

        {/* Y labels */}
        {yTicks.map((tick) => (
          <text
            key={tick}
            x={PADDING.left - 6}
            y={toY(tick) + 4}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {tick}%
          </text>
        ))}

        {/* X labels */}
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

        {/* Stacked areas (render in reverse so first category is on top visually) */}
        {[...stackedPaths].reverse().map((sp) => (
          <path
            key={sp.category}
            d={mounted ? sp.path : ""}
            fill={sp.color}
            opacity={0.35}
            stroke={sp.color}
            strokeWidth={1}
            className="transition-all duration-700 ease-out"
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-2">
        {categories.map((cat, i) => (
          <div key={cat} className="flex items-center gap-1.5 text-xs">
            <span className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${PALETTE_DOT[i % PALETTE_DOT.length]}`} />
            <span className="capitalize text-muted-foreground">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
