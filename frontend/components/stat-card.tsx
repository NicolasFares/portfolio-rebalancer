"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  subtitle?: string;
  size?: "sm" | "lg";
}

export function StatCard({ label, value, subtitle, size = "sm" }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card p-4",
        size === "lg" && "border-primary/20 bg-primary/5 shadow-[0_0_20px_-4px] shadow-primary/15"
      )}
    >
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "font-tabular mt-1",
          size === "lg"
            ? "font-serif text-2xl text-primary"
            : "text-lg font-medium"
        )}
      >
        {value}
      </p>
      {subtitle && (
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}
