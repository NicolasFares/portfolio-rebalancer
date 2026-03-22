"use client";

import type { HoldingInput, Account } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const ASSET_TYPES = ["equity", "bond", "crypto", "commodity", "other", "managed"] as const;
const BREAKDOWN_CATEGORIES = ["equity", "bond", "crypto", "cash", "commodity"] as const;
const CURRENCIES = ["CAD", "EUR", "USD"] as const;
const SECTOR_SUGGESTIONS = ["broad_market", "defense", "technology", "energy", "gold", "healthcare", "financials"];
const GEO_SUGGESTIONS = ["US", "EU", "Global", "CAD", "Emerging"];

interface HoldingFormProps {
  form: HoldingInput;
  setForm: (f: HoldingInput) => void;
  accounts: Account[];
}

export function HoldingForm({ form, setForm, accounts }: HoldingFormProps) {
  return (
    <>
      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        Identity
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Ticker</Label>
          <Input
            value={form.ticker || ""}
            onChange={(e) => setForm({ ...form, ticker: e.target.value })}
            placeholder="e.g. VOO"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Account</Label>
          <Select
            value={String(form.account_id)}
            onValueChange={(val) => val && setForm({ ...form, account_id: Number(val) })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {accounts.find(a => String(a.id) === String(form.account_id))?.name || "Select account"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="my-4" />

      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        Financials
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Quantity</Label>
          <Input
            type="number"
            step="any"
            required
            value={form.quantity || ""}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Price/Unit</Label>
          <Input
            type="number"
            step="any"
            required
            value={form.price_per_unit || ""}
            onChange={(e) => setForm({ ...form, price_per_unit: Number(e.target.value) })}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Currency</Label>
          <Select
            value={form.currency}
            onValueChange={(val) => val && setForm({ ...form, currency: val })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Avg Buy Price</Label>
          <Input
            type="number"
            step="any"
            value={form.avg_buy_price ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                avg_buy_price: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder="Optional"
          />
        </div>
      </div>

      <Separator className="my-4" />

      <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
        Classification
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select
            value={form.asset_type}
            onValueChange={(val) => {
              if (!val) return;
              const clearBreakdown = val !== "managed" ? { allocation_breakdown: null } : {};
              setForm({ ...form, asset_type: val, ...clearBreakdown });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Sector</Label>
          <Input
            list="sector-suggestions"
            value={form.sector || ""}
            onChange={(e) => setForm({ ...form, sector: e.target.value })}
            placeholder="e.g. defense"
          />
          <datalist id="sector-suggestions">
            {SECTOR_SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Geography</Label>
          <Input
            list="geo-suggestions"
            value={form.geography || ""}
            onChange={(e) => setForm({ ...form, geography: e.target.value })}
            placeholder="e.g. US"
          />
          <datalist id="geo-suggestions">
            {GEO_SUGGESTIONS.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </div>
      </div>

      {form.asset_type === "managed" && (
        <>
          <Separator className="my-4" />
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Allocation Breakdown
          </p>
          <p className="mb-2 text-xs text-muted-foreground">Must sum to 100%</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {BREAKDOWN_CATEGORIES.map((cat) => {
              const bd = form.allocation_breakdown || {};
              return (
                <div key={cat} className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">{cat} %</Label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    max="100"
                    value={bd[cat] ?? ""}
                    onChange={(e) => {
                      const val = e.target.value === "" ? 0 : Number(e.target.value);
                      const updated = { ...bd, [cat]: val };
                      const cleaned: Record<string, number> = {};
                      for (const [k, v] of Object.entries(updated)) {
                        if (v > 0) cleaned[k] = v;
                      }
                      setForm({
                        ...form,
                        allocation_breakdown:
                          Object.keys(cleaned).length > 0 ? cleaned : null,
                      });
                    }}
                    placeholder="0"
                  />
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Total:{" "}
            {Object.values(form.allocation_breakdown || {}).reduce(
              (s, v) => s + v,
              0,
            )}
            %
          </p>
        </>
      )}
    </>
  );
}
