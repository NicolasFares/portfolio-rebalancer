"use client";

const BAR_COLORS: Record<string, string> = {
  equity: "bg-purple",
  bond: "bg-blue",
  crypto: "bg-yellow",
  cash: "bg-green",
  commodity: "bg-orange",
};

interface AllocationChartProps {
  data: Record<string, number>;
  totalValue: number;
}

export function AllocationChart({ data, totalValue }: AllocationChartProps) {
  return (
    <div className="flex flex-col gap-2 py-4">
      {Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .map(([type, value]) => {
          const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;
          const colorClass = BAR_COLORS[type];
          return (
            <div className="flex items-center gap-3" key={type}>
              <span className="w-[60px] text-xs uppercase text-muted-foreground">
                {type}
              </span>
              <div className="relative h-6 flex-1 overflow-hidden rounded bg-secondary">
                <div
                  className={`h-full rounded transition-all duration-300 ${colorClass || "bg-muted-foreground"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-[60px] text-right text-sm font-semibold">
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
    </div>
  );
}
