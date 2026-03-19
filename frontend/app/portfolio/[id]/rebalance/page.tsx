"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import type { PortfolioDetail, RebalanceResult, TargetInput } from "@/lib/types";
import { getPortfolio, getRebalance, setTargets, getTargets } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Progress } from "@/components/ui/progress";
import { PortfolioNav } from "@/components/portfolio-nav";
import { RebalanceSkeleton } from "@/components/page-skeleton";

const DIMENSIONS = ["asset_type", "sector", "geography"] as const;
const DIMENSION_LABELS: Record<string, string> = {
  asset_type: "Asset Type",
  sector: "Sector",
  geography: "Geography",
};

const BAR_COLORS: Record<string, string> = {
  equity: "bg-gold",
  bond: "bg-blue",
  crypto: "bg-yellow",
  cash: "bg-green",
  commodity: "bg-orange",
};

function getCategoriesForDimension(
  holdings: PortfolioDetail["holdings"],
  dimension: string,
  hasCash: boolean,
): string[] {
  const cats = new Set<string>();
  for (const h of holdings) {
    if (dimension === "asset_type") {
      if (h.allocation_breakdown) {
        for (const k of Object.keys(h.allocation_breakdown)) cats.add(k);
      } else {
        cats.add(h.asset_type);
      }
    } else if (dimension === "sector") {
      cats.add(h.sector || "unclassified");
    } else if (dimension === "geography") {
      cats.add(h.geography || "unclassified");
    }
  }
  if (dimension === "asset_type" && hasCash) {
    cats.add("cash");
  }
  return Array.from(cats).sort();
}

export default function Rebalance() {
  const { id } = useParams<{ id: string }>();
  const [portfolio, setPortfolio] = useState<PortfolioDetail | null>(null);
  const [dimension, setDimension] = useState<string>("asset_type");
  const [result, setResult] = useState<RebalanceResult | null>(null);
  const [targetForm, setTargetForm] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const [filterAccountId, setFilterAccountId] = useState<string>("all");

  const loadDimension = async (dim: string, accountId?: number) => {
    if (!id) return;
    const existing = await getTargets(Number(id), dim);
    const map: Record<string, number> = {};
    existing.forEach((t) => {
      map[t.category] = t.target_pct;
    });
    setTargetForm(map);

    const r = await getRebalance(Number(id), dim, accountId);
    setResult(r);
  };

  const load = async () => {
    if (!id) return;
    const p = await getPortfolio(Number(id));
    setPortfolio(p);
    const acctId = filterAccountId !== "all" ? Number(filterAccountId) : undefined;
    await loadDimension(dimension, acctId);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (portfolio) {
      const acctId = filterAccountId !== "all" ? Number(filterAccountId) : undefined;
      loadDimension(dimension, acctId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension, filterAccountId]);

  const hasCash = portfolio
    ? portfolio.accounts.some((a) => a.cash_balance > 0)
    : false;

  const categories = portfolio
    ? getCategoriesForDimension(portfolio.holdings, dimension, hasCash)
    : [];

  const mergedForm: Record<string, number> = {};
  for (const cat of categories) {
    mergedForm[cat] = targetForm[cat] ?? 0;
  }
  for (const [k, v] of Object.entries(targetForm)) {
    if (!(k in mergedForm)) mergedForm[k] = v;
  }

  const handleSaveTargets = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const items: TargetInput[] = Object.entries(mergedForm)
      .filter(([, v]) => v > 0)
      .map(([category, target_pct]) => ({
        category,
        target_pct,
        dimension,
      }));

    const total = items.reduce((s, t) => s + t.target_pct, 0);
    if (Math.abs(total - 100) > 0.01) {
      setError(`Targets must sum to 100% (currently ${total.toFixed(1)}%)`);
      return;
    }

    await setTargets(Number(id), items);
    const acctId = filterAccountId !== "all" ? Number(filterAccountId) : undefined;
    const r = await getRebalance(Number(id), dimension, acctId);
    setResult(r);
    toast.success("Targets saved");
  };

  const totalPct = Object.values(mergedForm).reduce((s, v) => s + v, 0);

  if (!portfolio) return <RebalanceSkeleton />;

  const fmt = (n: number) => formatCurrency(n, portfolio.base_currency);

  // Progress bar color based on how close totalPct is to 100
  const progressColor =
    Math.abs(totalPct - 100) < 0.01
      ? "[&_[data-slot=progress-indicator]]:bg-green"
      : Math.abs(totalPct - 100) <= 10
        ? "[&_[data-slot=progress-indicator]]:bg-yellow"
        : "[&_[data-slot=progress-indicator]]:bg-red";

  return (
    <div>
      <h1 className="animate-fade-in-up stagger-1 mb-6 font-serif text-3xl">
        Rebalance
      </h1>

      <PortfolioNav portfolioId={id} portfolioName={portfolio.name} />

      {/* Filters */}
      <div className="animate-fade-in-up stagger-2 mb-6 flex items-center gap-4">
        <Tabs value={dimension} onValueChange={setDimension}>
          <TabsList>
            {DIMENSIONS.map((d) => (
              <TabsTrigger key={d} value={d}>
                {DIMENSION_LABELS[d]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select value={filterAccountId} onValueChange={(val) => val && setFilterAccountId(val)}>
          <SelectTrigger>
            <SelectValue>
              {filterAccountId === "all"
                ? "All Accounts"
                : portfolio.accounts.find(a => String(a.id) === filterAccountId)?.name || filterAccountId}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {portfolio.accounts.map((a) => (
              <SelectItem key={a.id} value={String(a.id)}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Target Allocation Form */}
      <Card className="animate-fade-in-up stagger-3">
        <CardHeader>
          <CardTitle>Target Allocation — {DIMENSION_LABELS[dimension]}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveTargets}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
              {Object.keys(mergedForm)
                .sort()
                .map((cat) => (
                  <div key={cat} className="flex flex-col gap-1">
                    <label className="text-xs capitalize text-muted-foreground">
                      {cat}
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={mergedForm[cat] || ""}
                        onChange={(e) =>
                          setTargetForm({
                            ...targetForm,
                            [cat]: Number(e.target.value),
                          })
                        }
                        className="font-tabular w-full"
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-4 space-y-3">
              <Progress value={Math.min(totalPct, 100)} className={progressColor}>
              </Progress>
              <div className="flex items-center gap-3">
                <Button type="submit">Save & Rebalance</Button>
                <span className="font-tabular text-sm text-muted-foreground">
                  {totalPct.toFixed(1)}%
                </span>
              </div>
            </div>
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Rebalancing Results */}
      {result && result.suggestions.length > 0 && (
        <Card className="animate-fade-in-up stagger-4 mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Rebalancing Suggestions</CardTitle>
              <span className="font-tabular text-sm text-muted-foreground">
                Total: {fmt(result.total_value)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {/* Dual-bar visual comparison */}
            <div className="mb-6 space-y-4">
              {result.suggestions.map((s) => {
                const colorClass = BAR_COLORS[s.category] || "bg-muted-foreground";
                return (
                  <div key={s.category}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-medium uppercase text-muted-foreground">
                        {s.category}
                      </span>
                      <span className="font-tabular text-xs text-muted-foreground">
                        {s.current_pct}% → {s.target_pct}%
                      </span>
                    </div>
                    {/* Current bar */}
                    <div className="mb-1 flex items-center gap-2">
                      <span className="w-14 text-right text-[0.65rem] text-muted-foreground">Current</span>
                      <div className="relative h-4 flex-1 overflow-hidden rounded bg-secondary">
                        <div
                          className={`h-full rounded ${colorClass} transition-all duration-500`}
                          style={{ width: `${s.current_pct}%` }}
                        />
                      </div>
                    </div>
                    {/* Target bar */}
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-right text-[0.65rem] text-muted-foreground">Target</span>
                      <div className="relative h-4 flex-1 overflow-hidden rounded bg-secondary">
                        <div
                          className={`h-full rounded ${colorClass} opacity-50 transition-all duration-500`}
                          style={{ width: `${s.target_pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Current Value</TableHead>
                  <TableHead>Current %</TableHead>
                  <TableHead>Target %</TableHead>
                  <TableHead>Diff %</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.suggestions.map((s) => (
                  <TableRow key={s.category}>
                    <TableCell>
                      <Badge variant="secondary">{s.category}</Badge>
                    </TableCell>
                    <TableCell className="font-tabular">{fmt(s.current_value)}</TableCell>
                    <TableCell className="font-tabular">{s.current_pct}%</TableCell>
                    <TableCell className="font-tabular">{s.target_pct}%</TableCell>
                    <TableCell className="font-tabular">
                      <span className={s.diff_pct >= 0 ? "text-green" : "text-red"}>
                        {s.diff_pct > 0 ? "+" : ""}
                        {s.diff_pct}%
                      </span>
                    </TableCell>
                    <TableCell>
                      {s.diff_value !== 0 && (
                        <Badge
                          variant="secondary"
                          className={
                            s.diff_value > 0
                              ? "border-green/30 bg-green/10 text-green"
                              : "border-red/30 bg-red/10 text-red"
                          }
                        >
                          {s.diff_value > 0 ? "Buy" : "Sell"}{" "}
                          <span className="font-tabular ml-1">{fmt(Math.abs(s.diff_value))}</span>
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
