"use client";

import { useState } from "react";
import type { PriceSyncResult } from "@/lib/types";
import { syncPrices } from "@/lib/api";
import { RefreshCw, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface PriceSyncPanelProps {
  portfolioId: number;
  onSyncComplete: () => void;
}

export function PriceSyncPanel({ portfolioId, onSyncComplete }: PriceSyncPanelProps) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<PriceSyncResult | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    try {
      const res = await syncPrices(portfolioId);
      setResult(res);
      onSyncComplete();
      if (res.updated > 0) {
        toast.success(`Prices updated for ${res.updated} holding${res.updated > 1 ? "s" : ""}`);
      } else {
        toast.info("No prices to update");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Price sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Price Sync</span>
          <span className="text-xs text-muted-foreground">yfinance</span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Fetch latest prices for publicly-traded holdings. Managed and private holdings are skipped.
            </p>
            <Button onClick={handleSync} disabled={syncing} className="ml-auto">
              {syncing ? "Syncing..." : "Sync Prices"}
            </Button>
          </div>
          {result && (
            <div className="mt-3 text-sm">
              <div className="mb-2">
                <span className="mr-4 text-green">{result.updated} updated</span>
                {result.failed > 0 && (
                  <span className="text-destructive">{result.failed} failed</span>
                )}
              </div>
              {result.details.length > 0 && (
                <div className="max-h-[200px] overflow-auto">
                  {result.details.map((d) => (
                    <div
                      key={d.holding_id}
                      className="border-b border-border py-1 text-muted-foreground"
                    >
                      <strong>{d.ticker}</strong>{" "}
                      <span className="font-tabular">
                        {d.old_price.toLocaleString()} → {d.new_price.toLocaleString()} {d.currency}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {result.errors.length > 0 && (
                <div className="mt-2">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-destructive">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
