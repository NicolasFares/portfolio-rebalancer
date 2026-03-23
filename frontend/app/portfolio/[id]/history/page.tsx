"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import type {
  PortfolioDetail as PDetail,
  PortfolioHistoryResponse,
  AllocationHistoryResponse,
  HoldingHistoryResponse,
  SnapshotSummary,
} from "@/lib/types";
import {
  getPortfolio,
  getPortfolioHistory,
  getAllocationHistory,
  getHoldingHistory,
  getSnapshots,
  createSnapshot,
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { PortfolioNav } from "@/components/portfolio-nav";
import { StatCard } from "@/components/stat-card";
import { LineChart } from "@/components/line-chart";
import { AreaChart } from "@/components/area-chart";
import { DateRangeSelector, getDateRange } from "@/components/date-range-selector";
import { Camera } from "lucide-react";

const DIMENSION_LABELS: Record<string, string> = {
  asset_type: "Asset Type",
  sector: "Sector",
  geography: "Geography",
};

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

export default function HistoryPage() {
  const { id } = useParams<{ id: string }>();
  const portfolioId = Number(id);

  const [portfolio, setPortfolio] = useState<PDetail | null>(null);
  const [tab, setTab] = useState<"value" | "allocation" | "holding">("value");
  const [rangeMonths, setRangeMonths] = useState(0); // 0 = all
  const [snapshotList, setSnapshotList] = useState<SnapshotSummary[]>([]);
  const [takingSnapshot, setTakingSnapshot] = useState(false);

  // Value tab
  const [historyData, setHistoryData] = useState<PortfolioHistoryResponse | null>(null);

  // Allocation tab
  const [allocDimension, setAllocDimension] = useState("asset_type");
  const [allocData, setAllocData] = useState<AllocationHistoryResponse | null>(null);

  // Holding tab
  const [selectedHoldingId, setSelectedHoldingId] = useState<number | null>(null);
  const [holdingData, setHoldingData] = useState<HoldingHistoryResponse | null>(null);

  const loadPortfolio = useCallback(() => {
    getPortfolio(portfolioId).then(setPortfolio);
    getSnapshots(portfolioId, 5).then(setSnapshotList);
  }, [portfolioId]);

  useEffect(() => { loadPortfolio(); }, [loadPortfolio]);

  // Load data when tab or range changes
  useEffect(() => {
    const { from, to } = getDateRange(rangeMonths);

    if (tab === "value") {
      getPortfolioHistory(portfolioId, from, to).then(setHistoryData);
    } else if (tab === "allocation") {
      getAllocationHistory(portfolioId, allocDimension, from, to).then(setAllocData);
    } else if (tab === "holding" && selectedHoldingId) {
      getHoldingHistory(portfolioId, selectedHoldingId, from, to).then(setHoldingData);
    }
  }, [portfolioId, tab, rangeMonths, allocDimension, selectedHoldingId]);

  // Auto-select first holding
  useEffect(() => {
    if (portfolio && portfolio.holdings.length > 0 && selectedHoldingId === null) {
      setSelectedHoldingId(portfolio.holdings[0].id);
    }
  }, [portfolio, selectedHoldingId]);

  const handleTakeSnapshot = async () => {
    setTakingSnapshot(true);
    try {
      await createSnapshot(portfolioId);
      toast.success("Snapshot created");
      loadPortfolio();
      // Refresh current tab data
      const { from, to } = getDateRange(rangeMonths);
      if (tab === "value") getPortfolioHistory(portfolioId, from, to).then(setHistoryData);
      if (tab === "allocation") getAllocationHistory(portfolioId, allocDimension, from, to).then(setAllocData);
      if (tab === "holding" && selectedHoldingId) getHoldingHistory(portfolioId, selectedHoldingId, from, to).then(setHoldingData);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to create snapshot");
    } finally {
      setTakingSnapshot(false);
    }
  };

  if (!portfolio) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const fmt = (n: number) => formatCurrency(n, portfolio.base_currency);

  // Value tab stats
  const valuePoints = historyData?.data_points || [];
  const currentValue = valuePoints.length > 0 ? valuePoints[valuePoints.length - 1].total_value_base : 0;
  const firstValue = valuePoints.length > 0 ? valuePoints[0].total_value_base : 0;
  const periodChange = currentValue - firstValue;
  const periodChangePct = firstValue > 0 ? (periodChange / firstValue) * 100 : 0;
  const periodHigh = valuePoints.length > 0 ? Math.max(...valuePoints.map((p) => p.total_value_base)) : 0;
  const periodLow = valuePoints.length > 0 ? Math.min(...valuePoints.map((p) => p.total_value_base)) : 0;

  const lastSnapshotDate = snapshotList.length > 0 ? snapshotList[0].snapshot_date : null;

  return (
    <div>
      <div className="animate-fade-in-up stagger-1">
        <PortfolioNav portfolioId={id} portfolioName={portfolio.name} />
      </div>

      {/* Header row */}
      <div className="animate-fade-in-up stagger-2 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Portfolio History</h2>
          {lastSnapshotDate && (
            <span className="text-xs text-muted-foreground">
              Last snapshot: {lastSnapshotDate}
            </span>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={handleTakeSnapshot} disabled={takingSnapshot}>
          <Camera className="mr-1.5 h-3.5 w-3.5" />
          {takingSnapshot ? "Creating..." : "Take Snapshot"}
        </Button>
      </div>

      {/* Tabs */}
      <div className="animate-fade-in-up stagger-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <div className="mb-4 flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="value">Portfolio Value</TabsTrigger>
              <TabsTrigger value="allocation">Allocation Drift</TabsTrigger>
              <TabsTrigger value="holding">Holding Performance</TabsTrigger>
            </TabsList>
            <DateRangeSelector value={rangeMonths} onChange={setRangeMonths} />
          </div>
        </Tabs>

        {/* Value Tab */}
        {tab === "value" && (
          <div className="space-y-4">
            {valuePoints.length > 1 && (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Current Value" value={fmt(currentValue)} subtitle={portfolio.base_currency} size="lg" />
                <StatCard
                  label="Period Change"
                  value={`${periodChange >= 0 ? "+" : ""}${fmt(periodChange)}`}
                  subtitle={`${periodChangePct >= 0 ? "+" : ""}${periodChangePct.toFixed(1)}%`}
                />
                <StatCard label="Period High" value={fmt(periodHigh)} />
                <StatCard label="Period Low" value={fmt(periodLow)} />
              </div>
            )}
            <Card>
              <CardContent className="pt-6">
                <LineChart
                  data={valuePoints.map((p) => ({ label: formatDateLabel(p.date), value: p.total_value_base }))}
                  currency={portfolio.base_currency}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Allocation Tab */}
        {tab === "allocation" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Tabs value={allocDimension} onValueChange={setAllocDimension}>
                <TabsList>
                  {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
                    <TabsTrigger key={key} value={key}>{label}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
            <Card>
              <CardContent className="pt-6">
                <AreaChart
                  data={(allocData?.data_points || []).map((p) => ({
                    label: formatDateLabel(p.date),
                    values: p.values,
                  }))}
                  categories={allocData?.categories || []}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Holding Tab */}
        {tab === "holding" && (
          <div className="space-y-4">
            <Select
              value={selectedHoldingId ? String(selectedHoldingId) : ""}
              onValueChange={(v) => setSelectedHoldingId(Number(v))}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select holding" />
              </SelectTrigger>
              <SelectContent>
                {portfolio.holdings.map((h) => (
                  <SelectItem key={h.id} value={String(h.id)}>
                    {h.name} {h.ticker ? `(${h.ticker})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {holdingData && holdingData.data_points.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  <StatCard
                    label={holdingData.holding_name}
                    value={fmt(holdingData.data_points[holdingData.data_points.length - 1].value_base)}
                    subtitle={holdingData.ticker || undefined}
                    size="lg"
                  />
                  <StatCard
                    label="Value Change"
                    value={(() => {
                      const first = holdingData.data_points[0].value_base;
                      const last = holdingData.data_points[holdingData.data_points.length - 1].value_base;
                      const diff = last - first;
                      return `${diff >= 0 ? "+" : ""}${fmt(diff)}`;
                    })()}
                    subtitle={(() => {
                      const first = holdingData.data_points[0].value_base;
                      const last = holdingData.data_points[holdingData.data_points.length - 1].value_base;
                      const pct = first > 0 ? ((last - first) / first) * 100 : 0;
                      return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
                    })()}
                  />
                  <StatCard
                    label="Price Change"
                    value={(() => {
                      const first = holdingData.data_points[0].price_per_unit;
                      const last = holdingData.data_points[holdingData.data_points.length - 1].price_per_unit;
                      const diff = last - first;
                      return `${diff >= 0 ? "+" : ""}${diff.toFixed(2)}`;
                    })()}
                    subtitle={(() => {
                      const first = holdingData.data_points[0].price_per_unit;
                      const last = holdingData.data_points[holdingData.data_points.length - 1].price_per_unit;
                      const pct = first > 0 ? ((last - first) / first) * 100 : 0;
                      return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
                    })()}
                  />
                </div>
                <Card>
                  <CardContent className="pt-6">
                    <LineChart
                      data={holdingData.data_points.map((p) => ({
                        label: formatDateLabel(p.date),
                        value: p.value_base,
                      }))}
                      currency={portfolio.base_currency}
                      color="var(--color-blue)"
                    />
                  </CardContent>
                </Card>
              </>
            )}

            {holdingData && holdingData.data_points.length === 0 && (
              <Card>
                <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  No history data for this holding. Take a snapshot first.
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
