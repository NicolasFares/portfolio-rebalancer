"use client";

import { useEffect, useState } from "react";
import type { QuestradeAccount, SyncResult } from "@/lib/types";
import {
  questradeStatus,
  questradeAccounts,
  questradeSyncHoldings,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [error, setError] = useState("");

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
    setError("");
    setSyncResult(null);
    try {
      const selected =
        selectedAccounts.size === accounts.length
          ? undefined
          : Array.from(selectedAccounts);
      const result = await questradeSyncHoldings(portfolioId, selected);
      setSyncResult(result);
      onSyncComplete();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sync failed");
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Questrade Sync</CardTitle>
          <Button
            onClick={handleSync}
            disabled={syncing || selectedAccounts.size === 0}
          >
            {syncing ? "Syncing..." : "Sync from Questrade"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {accounts.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            {accounts.map((a) => (
              <label
                key={a.number}
                className="flex cursor-pointer items-center gap-1.5 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedAccounts.has(a.number)}
                  onChange={() => toggleAccount(a.number)}
                  className="accent-primary"
                />
                {a.type} ({a.number})
              </label>
            ))}
          </div>
        )}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
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
      </CardContent>
    </Card>
  );
}
