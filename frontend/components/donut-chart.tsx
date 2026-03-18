"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format";

// Known asset-type colors
const KNOWN_STROKE: Record<string, string> = {
  equity: "var(--color-gold)",
  bond: "var(--color-blue)",
  crypto: "var(--color-yellow)",
  cash: "var(--color-green)",
  commodity: "var(--color-orange)",
};

const KNOWN_DOT: Record<string, string> = {
  equity: "bg-gold",
  bond: "bg-blue",
  crypto: "bg-yellow",
  cash: "bg-green",
  commodity: "bg-orange",
};

// Palette for dynamic categories (sector, geography, etc.)
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

interface DonutChartProps {
  data: Record<string, number>;
  totalValue: number;
  currency?: string;
}

export function DonutChart({ data, totalValue, currency = "CAD" }: DonutChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const entries = Object.entries(data)
    .map(([type, value]) => ({
      type,
      value,
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.pct - a.pct);

  // Check if all keys are known asset types — if so use fixed map, otherwise use palette
  const allKnown = entries.every((e) => e.type in KNOWN_STROKE);

  function getStrokeColor(type: string, index: number) {
    if (allKnown) return KNOWN_STROKE[type];
    return PALETTE_STROKE[index % PALETTE_STROKE.length];
  }

  function getDotClass(type: string, index: number) {
    if (allKnown) return KNOWN_DOT[type];
    return PALETTE_DOT[index % PALETTE_DOT.length];
  }

  const SIZE = 200;
  const STROKE_WIDTH = 32;
  const RADIUS = (SIZE - STROKE_WIDTH) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // Build segments: each starts where the previous one ended
  let cumulativePct = 0;
  const segments = entries.map((entry, i) => {
    const dash = (entry.pct / 100) * CIRCUMFERENCE;
    const gap = CIRCUMFERENCE - dash;
    // strokeDashoffset shifts the dash start backwards along the path.
    // We want segment i to start at cumulativePct of the circle.
    const offset = CIRCUMFERENCE - (cumulativePct / 100) * CIRCUMFERENCE;
    cumulativePct += entry.pct;
    return { ...entry, dash, gap, offset, index: i };
  });

  return (
    <div className="flex flex-col items-center gap-6 py-4 sm:flex-row sm:items-start sm:justify-center sm:gap-10">
      {/* SVG Donut */}
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
        >
          {/* Background ring */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-secondary)"
            strokeWidth={STROKE_WIDTH}
          />
          {/* Data segments */}
          {segments.map((seg) => (
            <circle
              key={seg.type}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={getStrokeColor(seg.type, seg.index)}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={mounted ? `${seg.dash} ${seg.gap}` : `0 ${CIRCUMFERENCE}`}
              strokeDashoffset={seg.offset}
              className="transition-[stroke-dasharray] duration-700 ease-out"
            />
          ))}
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-tabular font-serif text-lg text-primary">
            {formatCurrency(totalValue, currency)}
          </span>
          <span className="text-[0.65rem] text-muted-foreground">Total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-2">
        {entries.map((entry, i) => (
          <div key={entry.type} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full ${getDotClass(entry.type, i)}`}
            />
            <span className="capitalize text-muted-foreground">{entry.type}</span>
            <span className="font-tabular ml-auto font-medium">{entry.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
