"use client";

import { Button } from "@/components/ui/button";

const PRESETS = [
  { label: "1M", months: 1 },
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "1Y", months: 12 },
  { label: "All", months: 0 },
] as const;

interface DateRangeSelectorProps {
  value: number; // months, 0 = all
  onChange: (months: number) => void;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  return (
    <div className="flex gap-1">
      {PRESETS.map((p) => (
        <Button
          key={p.label}
          variant={value === p.months ? "default" : "ghost"}
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => onChange(p.months)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}

export function getDateRange(months: number): { from?: string; to?: string } {
  if (months === 0) return {};
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}
