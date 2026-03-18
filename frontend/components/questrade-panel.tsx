"use client";

import { useEffect, useState } from "react";
import type { QuestradeAccount, SyncResult } from "@/lib/types";
import {
  questradeStatus,
  questradeAccounts,
  questradeSyncHoldings,
} from "@/lib/api";
import { RefreshCw, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

interface QuestradePanelProps {
  portfolioId: number;
  onSyncComplete: () => void;
}

export function QuestradePanel({ portfolioId, onSyncComplete }: QuestradePanelProps) {
  const [connected, setConnected] = useState(false);
  const [accounts, setAccounts] = useState<QuestradeAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    questradeStatus()
      .then((s) => {
        const isConnected = s.status === "connected" || s.status === "expired";
        setConnected(isConnected);
        if (isConnected) {
          questradeAccounts()
            .then((r) => {
              setAccounts(r.accounts);
              setSelectedAccounts(new Set(r.accounts.map((a) => a.number)));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const selected =
        selectedAccounts.size === accounts.length
          ? undefined
          : Array.from(selectedAccounts);
      const result = await questradeSyncHoldings(portfolioId, selected);
      setSyncResult(result);
      onSyncComplete();
      toast.success(`Synced: ${result.added} added, ${result.updated} updated`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const toggleAccount = (num: string) => {
    setSelectedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  if (!connected) return null;

  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Questrade Sync</span>
        </div>
        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            {accounts.length > 0 && (
              <div className="flex flex-wrap items-center gap-4">
                {accounts.map((a) => (
                  <label
                    key={a.number}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={selectedAccounts.has(a.number)}
                      onCheckedChange={() => toggleAccount(a.number)}
                    />
                    {a.type} ({a.number})
                  </label>
                ))}
              </div>
            )}
            <Button
              onClick={handleSync}
              disabled={syncing || selectedAccounts.size === 0}
              className="ml-auto"
            >
              {syncing ? "Syncing..." : "Sync from Questrade"}
            </Button>
          </div>
          {syncResult && (
            <div className="mt-3 text-sm">
              <div className="mb-2">
                <span className="mr-4 text-green">+{syncResult.added} added</span>
                <span className="text-blue">{syncResult.updated} updated</span>
              </div>
              {syncResult.changes.length > 0 && (
                <div className="max-h-[200px] overflow-auto">
                  {syncResult.changes.map((c, i) => (
                    <div
                      key={i}
                      className="border-b border-border py-1 text-muted-foreground"
                    >
                      <span
                        className={
                          c.action === "added" ? "text-green" : "text-blue"
                        }
                      >
                        {c.action}
                      </span>{" "}
                      <strong>{c.ticker}</strong> — {c.details}
                    </div>
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
