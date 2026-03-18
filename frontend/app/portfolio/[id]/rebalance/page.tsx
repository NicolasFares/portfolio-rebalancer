"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { PortfolioDetail, RebalanceResult, TargetInput } from "@/lib/types";
import { getPortfolio, getRebalance, setTargets, getTargets } from "@/lib/api";
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

const DIMENSIONS = ["asset_type", "sector", "geography"] as const;
const DIMENSION_LABELS: Record<string, string> = {
  asset_type: "Asset Type",
  sector: "Sector",
  geography: "Geography",
};

const BAR_COLORS: Record<string, string> = {
  equity: "bg-purple",
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
  const [filterAccountId, setFilterAccountId] = useState<number | undefined>(
    undefined,
  );

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
    await loadDimension(dimension, filterAccountId);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (portfolio) loadDimension(dimension, filterAccountId);
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
    const r = await getRebalance(Number(id), dimension, filterAccountId);
    setResult(r);
  };

  const totalPct = Object.values(mergedForm).reduce((s, v) => s + v, 0);

  if (!portfolio) return <div className="text-muted-foreground">Loading...</div>;

  const fmt = (n: number) =>
    n.toLocaleString("en-CA", {
      style: "currency",
      currency: portfolio.base_currency,
    });

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href={`/portfolio/${id}`}
          className="text-primary hover:text-primary/80"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Rebalance: {portfolio.name}</h1>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-4">
        <Tabs value={dimension} onValueChange={setDimension}>
          <TabsList>
            {DIMENSIONS.map((d) => (
              <TabsTrigger key={d} value={d}>
                {DIMENSION_LABELS[d]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={filterAccountId ?? ""}
          onChange={(e) =>
            setFilterAccountId(
              e.target.value ? Number(e.target.value) : undefined,
            )
          }
        >
          <option value="">All Accounts</option>
          {portfolio.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {/* Target Allocation Form */}
      <Card>
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
                        className="w-full"
                      />
                      <span className="text-muted-foreground">%</span>
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <Button type="submit">Save & Rebalance</Button>
              <span
                className={`text-sm ${Math.abs(totalPct - 100) < 0.01 ? "text-green" : "text-red"}`}
              >
                Total: {totalPct.toFixed(1)}%
              </span>
            </div>
            {error && (
              <p className="mt-2 text-sm text-destructive">{error}</p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Rebalancing Results */}
      {result && result.suggestions.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Rebalancing Suggestions</CardTitle>
              <span className="text-sm text-muted-foreground">
                Total: {fmt(result.total_value)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {/* Visual comparison */}
            <div className="mb-6">
              {result.suggestions.map((s) => {
                const colorClass = BAR_COLORS[s.category];
                return (
                  <div key={s.category} className="mb-4">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs uppercase text-muted-foreground">
                        {s.category}
                      </span>
                      <span className="text-xs">
                        <span className="text-muted-foreground">
                          {s.current_pct}%
                        </span>
                        {" → "}
                        <span>{s.target_pct}%</span>
                      </span>
                    </div>
                    <div className="relative h-6 overflow-hidden rounded bg-secondary">
                      <div
                        className={`absolute inset-y-0 left-0 rounded opacity-40 ${colorClass || "bg-muted-foreground"}`}
                        style={{ width: `${s.current_pct}%` }}
                      />
                      <div
                        className={`absolute inset-y-0 w-0.5 ${colorClass || "bg-muted-foreground"}`}
                        style={{ left: `${s.target_pct}%` }}
                      />
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
                    <TableCell>{fmt(s.current_value)}</TableCell>
                    <TableCell>{s.current_pct}%</TableCell>
                    <TableCell>{s.target_pct}%</TableCell>
                    <TableCell
                      className={
                        s.diff_pct >= 0 ? "text-green" : "text-red"
                      }
                    >
                      {s.diff_pct > 0 ? "+" : ""}
                      {s.diff_pct}%
                    </TableCell>
                    <TableCell
                      className={
                        s.diff_value >= 0 ? "text-green" : "text-red"
                      }
                    >
                      {s.diff_value > 0
                        ? "Buy "
                        : s.diff_value < 0
                          ? "Sell "
                          : ""}
                      {fmt(Math.abs(s.diff_value))}
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
