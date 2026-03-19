"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, MoreHorizontal, Pencil, Trash2, PackageOpen, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { PortfolioDetail as PDetail, HoldingInput } from "@/lib/types";
import {
  getPortfolio,
  addHolding,
  deleteHolding,
  updateHolding,
  updatePortfolio,
} from "@/lib/api";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { DonutChart } from "@/components/donut-chart";
import { HoldingDialog } from "@/components/holding-dialog";
import { QuestradePanel } from "@/components/questrade-panel";
import { PortfolioNav } from "@/components/portfolio-nav";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { PortfolioDetailSkeleton } from "@/components/page-skeleton";

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
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<HoldingInput>({ ...emptyHolding });
  const [editingRates, setEditingRates] = useState(false);
  const [eurRate, setEurRate] = useState(0);
  const [usdRate, setUsdRate] = useState(0);
  const [chartDimension, setChartDimension] = useState<string>("asset_type");
  const [filterAccountId, setFilterAccountId] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);

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

  if (!portfolio) return <PortfolioDetailSkeleton />;

  const filteredHoldings =
    filterAccountId !== "all"
      ? portfolio.holdings.filter((h) => h.account_id === Number(filterAccountId))
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

  const fmt = (n: number) => formatCurrency(n, portfolio.base_currency);

  const handleAddHolding = async (e: React.FormEvent) => {
    e.preventDefault();
    await addHolding(Number(id), form);
    setForm({ ...emptyHolding, account_id: form.account_id });
    setAddOpen(false);
    toast.success("Holding added");
    load();
  };

  const handleDeleteHolding = async (holdingId: number) => {
    await deleteHolding(holdingId);
    setDeleteId(null);
    toast.success("Holding deleted");
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
    toast.success("Holding updated");
    load();
  };

  const handleSaveRates = async () => {
    await updatePortfolio(Number(id), {
      eur_to_base: eurRate,
      usd_to_base: usdRate,
    });
    setEditingRates(false);
    toast.success("Exchange rates updated");
    load();
  };

  return (
    <div>
      {/* Sub-navigation with breadcrumb */}
      <div className="animate-fade-in-up stagger-1">
        <PortfolioNav portfolioId={id} portfolioName={portfolio.name} />
      </div>

      {/* Stat Cards Grid */}
      <div className="animate-fade-in-up stagger-2 mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Value" value={fmt(totalValue)} subtitle={portfolio.base_currency} size="lg" />
        <StatCard label="Holdings" value={String(portfolio.holdings.length)} />
        <StatCard label="Accounts" value={String(portfolio.accounts.length)} />
        <StatCard label="Cash Balance" value={fmt(accountCashValue)} />
      </div>

      {/* Allocation Chart */}
      {Object.keys(byType).length > 0 && (
        <Card className="animate-fade-in-up stagger-3 mt-4">
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
            <DonutChart data={byType} totalValue={totalValue} currency={portfolio.base_currency} />
          </CardContent>
        </Card>
      )}

      {/* Holdings Table */}
      <Card className="animate-fade-in-up stagger-4 mt-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Holdings ({filteredHoldings.length})</CardTitle>
            <div className="flex items-center gap-3">
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
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                Add Holding
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredHoldings.length === 0 ? (
            <EmptyState
              icon={PackageOpen}
              title="No holdings yet"
              description="Add your first holding to start tracking."
              action={{ label: "Add Holding", onClick: () => setAddOpen(true) }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Sector</TableHead>
                  <TableHead className="hidden lg:table-cell">Geo</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredHoldings.map((h) => (
                  <TableRow key={h.id}>
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
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {h.sector || "—"}
                    </TableCell>
                    <TableCell className="hidden text-xs text-muted-foreground lg:table-cell">
                      {h.geography || "—"}
                    </TableCell>
                    <TableCell className="font-tabular">{h.quantity}</TableCell>
                    <TableCell className="font-tabular">
                      {h.price_per_unit.toLocaleString()} {h.currency}
                    </TableCell>
                    <TableCell className="font-tabular">
                      {(h.quantity * h.price_per_unit).toLocaleString()}{" "}
                      {h.currency}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {h.account_name || "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="sm" />}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => startEditing(h)}
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteId(h.id)}
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Holding Dialog */}
      <HoldingDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="add"
        form={form}
        setForm={setForm}
        accounts={portfolio.accounts}
        onSubmit={handleAddHolding}
      />

      {/* Edit Holding Dialog */}
      <HoldingDialog
        open={editingId !== null}
        onOpenChange={(open) => { if (!open) setEditingId(null); }}
        mode="edit"
        form={editForm}
        setForm={setEditForm}
        accounts={portfolio.accounts}
        onSubmit={handleUpdateHolding}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete holding?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this holding from your portfolio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && handleDeleteHolding(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exchange Rates — Collapsible */}
      <div className="animate-fade-in-up stagger-5 mt-4">
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent">
            <div className="flex items-center gap-3">
              <span className="font-medium">Exchange Rates</span>
              <span className="font-tabular text-xs text-muted-foreground">
                1 EUR = {portfolio.eur_to_base} {portfolio.base_currency} · 1 USD = {portfolio.usd_to_base} {portfolio.base_currency}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 font-tabular">
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
                  <div className="ml-auto flex items-center gap-2">
                    {editingRates ? (
                      <>
                        <Button size="sm" onClick={handleSaveRates}>Save</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingRates(false)}>Cancel</Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setEditingRates(true)}>Edit</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Questrade Sync — Collapsible */}
      <div className="animate-fade-in-up stagger-5 mt-4">
        <QuestradePanel portfolioId={Number(id)} onSyncComplete={load} />
      </div>
    </div>
  );
}
