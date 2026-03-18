"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { PortfolioDetail as PDetail, HoldingInput } from "@/lib/types";
import {
  getPortfolio,
  addHolding,
  deleteHolding,
  updateHolding,
  updatePortfolio,
} from "@/lib/api";
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
import { AllocationChart } from "@/components/allocation-chart";
import { HoldingForm } from "@/components/holding-form";
import { QuestradePanel } from "@/components/questrade-panel";

const DIMENSIONS = ["asset_type", "sector", "geography"] as const;
const DIMENSION_LABELS: Record<string, string> = {
  asset_type: "Asset Type",
  sector: "Sector",
  geography: "Geography",
};

const emptyHolding: HoldingInput = {
  name: "",
  ticker: "",
  asset_type: "equity",
  quantity: 0,
  price_per_unit: 0,
  currency: "CAD",
  account_id: 0,
  sector: "",
  geography: "",
};

export default function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const [portfolio, setPortfolio] = useState<PDetail | null>(null);
  const [form, setForm] = useState<HoldingInput>({ ...emptyHolding });
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<HoldingInput>({ ...emptyHolding });
  const [editingRates, setEditingRates] = useState(false);
  const [eurRate, setEurRate] = useState(0);
  const [usdRate, setUsdRate] = useState(0);
  const [chartDimension, setChartDimension] = useState<string>("asset_type");
  const [filterAccountId, setFilterAccountId] = useState<number | undefined>(
    undefined,
  );

  const load = () => {
    if (!id) return;
    getPortfolio(Number(id)).then((p) => {
      setPortfolio(p);
      setEurRate(p.eur_to_base);
      setUsdRate(p.usd_to_base);
      if (p.accounts.length > 0 && form.account_id === 0) {
        setForm((f) => ({ ...f, account_id: p.accounts[0].id }));
      }
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!portfolio) return <div className="text-muted-foreground">Loading...</div>;

  const filteredHoldings =
    filterAccountId !== undefined
      ? portfolio.holdings.filter((h) => h.account_id === filterAccountId)
      : portfolio.holdings;

  const toBase = (val: number, currency: string) => {
    if (currency === portfolio.base_currency) return val;
    if (currency === "EUR") return val * portfolio.eur_to_base;
    if (currency === "USD") return val * portfolio.usd_to_base;
    return val;
  };

  const holdingsValue = portfolio.holdings.reduce(
    (sum, h) => sum + toBase(h.quantity * h.price_per_unit, h.currency),
    0,
  );
  const accountCashValue = portfolio.accounts.reduce(
    (sum, a) => sum + toBase(a.cash_balance, a.currency),
    0,
  );
  const totalValue = holdingsValue + accountCashValue;

  const computeByDimension = (dim: string) => {
    const result: Record<string, number> = {};
    portfolio.holdings.forEach((h) => {
      const converted = toBase(h.quantity * h.price_per_unit, h.currency);
      if (dim === "asset_type") {
        if (h.allocation_breakdown) {
          for (const [cat, pct] of Object.entries(h.allocation_breakdown)) {
            result[cat] = (result[cat] || 0) + converted * (pct / 100);
          }
        } else {
          result[h.asset_type] = (result[h.asset_type] || 0) + converted;
        }
      } else if (dim === "sector") {
        const key = h.sector || "unclassified";
        result[key] = (result[key] || 0) + converted;
      } else if (dim === "geography") {
        const key = h.geography || "unclassified";
        result[key] = (result[key] || 0) + converted;
      }
    });
    if (dim === "asset_type" && accountCashValue > 0) {
      result["cash"] = (result["cash"] || 0) + accountCashValue;
    }
    return result;
  };
  const byType = computeByDimension(chartDimension);

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    await addHolding(Number(id), form);
    setForm({ ...emptyHolding, account_id: form.account_id });
    setShowForm(false);
    load();
  };

  const handleDeleteHolding = async (holdingId: number) => {
    await deleteHolding(holdingId);
    load();
  };

  const startEditing = (h: PDetail["holdings"][0]) => {
    setEditingId(h.id);
    setEditForm({
      name: h.name,
      ticker: h.ticker || "",
      asset_type: h.asset_type,
      quantity: h.quantity,
      price_per_unit: h.price_per_unit,
      currency: h.currency,
      account_id: h.account_id,
      sector: h.sector || "",
      geography: h.geography || "",
      allocation_breakdown: h.allocation_breakdown || null,
    });
  };

  const handleUpdateHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    await updateHolding(editingId, editForm);
    setEditingId(null);
    load();
  };

  const handleSaveRates = async () => {
    await updatePortfolio(Number(id), {
      eur_to_base: eurRate,
      usd_to_base: usdRate,
    });
    setEditingRates(false);
    load();
  };

  const fmt = (n: number) =>
    n.toLocaleString("en-CA", {
      style: "currency",
      currency: portfolio.base_currency,
    });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-bold">{portfolio.name}</h1>
          <span className="text-sm text-muted-foreground">
            Total: {fmt(totalValue)} {portfolio.base_currency}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/portfolio/${id}/accounts`}>
            <Button variant="ghost">Accounts</Button>
          </Link>
          <Link href={`/portfolio/${id}/rebalance`}>
            <Button>Rebalance</Button>
          </Link>
        </div>
      </div>

      {/* Questrade Sync */}
      <QuestradePanel portfolioId={Number(id)} onSyncComplete={load} />

      {/* Exchange Rates */}
      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Exchange Rates</CardTitle>
            {!editingRates ? (
              <Button variant="ghost" onClick={() => setEditingRates(true)}>
                Edit
              </Button>
            ) : (
              <div className="flex items-center gap-3">
                <Button onClick={handleSaveRates}>Save</Button>
                <Button
                  variant="ghost"
                  onClick={() => setEditingRates(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">1 EUR =</span>
            {editingRates ? (
              <Input
                type="number"
                step="0.01"
                value={eurRate}
                onChange={(e) => setEurRate(Number(e.target.value))}
                className="w-24"
              />
            ) : (
              <span>{portfolio.eur_to_base}</span>
            )}
            <span className="text-sm text-muted-foreground">
              {portfolio.base_currency}
            </span>
            <span className="mx-2 text-border">|</span>
            <span className="text-sm text-muted-foreground">1 USD =</span>
            {editingRates ? (
              <Input
                type="number"
                step="0.01"
                value={usdRate}
                onChange={(e) => setUsdRate(Number(e.target.value))}
                className="w-24"
              />
            ) : (
              <span>{portfolio.usd_to_base}</span>
            )}
            <span className="text-sm text-muted-foreground">
              {portfolio.base_currency}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Allocation Chart */}
      {Object.keys(byType).length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Allocation</CardTitle>
              <Tabs
                value={chartDimension}
                onValueChange={setChartDimension}
              >
                <TabsList>
                  {DIMENSIONS.map((d) => (
                    <TabsTrigger key={d} value={d}>
                      {DIMENSION_LABELS[d]}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <AllocationChart data={byType} totalValue={totalValue} />
          </CardContent>
        </Card>
      )}

      {/* Holdings Table */}
      <Card className="mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Holdings ({filteredHoldings.length})</CardTitle>
            <div className="flex items-center gap-3">
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
              {editingId === null && (
                <Button onClick={() => setShowForm(!showForm)}>
                  {showForm ? "Cancel" : "Add Holding"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(showForm || editingId !== null) && (
            <form
              onSubmit={
                editingId !== null ? handleUpdateHolding : handleAddHolding
              }
              className="mb-4 rounded-md border border-border bg-secondary p-4"
            >
              <p
                className={`mb-3 text-sm font-semibold ${editingId !== null ? "text-primary" : ""}`}
              >
                {editingId !== null ? "Editing holding" : "New holding"}
              </p>
              {editingId !== null ? (
                <HoldingForm
                  form={editForm}
                  setForm={setEditForm}
                  accounts={portfolio.accounts}
                />
              ) : (
                <HoldingForm
                  form={form}
                  setForm={setForm}
                  accounts={portfolio.accounts}
                />
              )}
              <div className="mt-2 flex items-center gap-3">
                <Button type="submit">
                  {editingId !== null ? "Save Changes" : "Add"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    if (editingId !== null) {
                      setEditingId(null);
                    } else {
                      setShowForm(false);
                      setForm({
                        ...emptyHolding,
                        account_id: form.account_id,
                      });
                    }
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {filteredHoldings.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No holdings yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Geo</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHoldings.map((h) => (
                  <TableRow
                    key={h.id}
                    className={
                      editingId === h.id ? "opacity-30" : undefined
                    }
                  >
                    <TableCell>
                      {h.name}
                      {h.ticker && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {h.ticker}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{h.asset_type}</Badge>
                      {h.allocation_breakdown && (
                        <span className="ml-1.5 text-[0.7rem] text-muted-foreground">
                          {Object.entries(h.allocation_breakdown)
                            .map(([k, v]) => `${v}% ${k}`)
                            .join(" / ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {h.sector || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {h.geography || "—"}
                    </TableCell>
                    <TableCell>{h.quantity}</TableCell>
                    <TableCell>
                      {h.price_per_unit.toLocaleString()} {h.currency}
                    </TableCell>
                    <TableCell>
                      {(h.quantity * h.price_per_unit).toLocaleString()}{" "}
                      {h.currency}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.account_name || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowForm(false);
                            startEditing(h);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteHolding(h.id)}
                        >
                          ✕
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
