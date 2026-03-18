"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Briefcase, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import type { Portfolio, QuestradeStatus } from "@/lib/types";
import {
  listPortfolios,
  createPortfolio,
  deletePortfolio,
  questradeAuth,
  questradeStatus,
  questradeDisconnect,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { PortfolioListSkeleton } from "@/components/page-skeleton";
import { EmptyState } from "@/components/empty-state";

export default function PortfolioList() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [qtStatus, setQtStatus] = useState<QuestradeStatus | null>(null);
  const [qtToken, setQtToken] = useState("");
  const [qtError, setQtError] = useState("");
  const [qtLoading, setQtLoading] = useState(false);

  const load = () =>
    listPortfolios().then((p) => {
      setPortfolios(p);
      setLoading(false);
    });

  const loadQtStatus = () => {
    questradeStatus().then(setQtStatus).catch(() => {});
  };

  useEffect(() => {
    load();
    loadQtStatus();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await createPortfolio({ name: name.trim() });
    setName("");
    setCreateOpen(false);
    toast.success("Portfolio created");
    load();
  };

  const handleDelete = async (id: number) => {
    await deletePortfolio(id);
    toast.success("Portfolio deleted");
    load();
  };

  const handleQtConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qtToken.trim()) return;
    setQtLoading(true);
    setQtError("");
    try {
      await questradeAuth(qtToken.trim());
      setQtToken("");
      loadQtStatus();
      toast.success("Questrade connected");
    } catch (err: unknown) {
      setQtError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setQtLoading(false);
    }
  };

  const handleQtDisconnect = async () => {
    await questradeDisconnect();
    loadQtStatus();
    toast.success("Questrade disconnected");
  };

  if (loading) return <PortfolioListSkeleton />;

  return (
    <div>
      <div className="animate-fade-in-up stagger-1 mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Portfolios</h1>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Portfolio
        </Button>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Portfolio</DialogTitle>
            <DialogDescription>
              Give your new portfolio a name.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Portfolio name..."
              autoFocus
            />
            <DialogFooter className="mt-4">
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {portfolios.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No portfolios yet"
          description="Create a portfolio to start tracking your investments."
          action={{ label: "Create Portfolio", onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <div className="animate-fade-in-up stagger-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {portfolios.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Link
                      href={`/portfolio/${p.id}`}
                      className="text-primary hover:text-primary/80"
                    >
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.base_currency}</TableCell>
                  <TableCell className="font-tabular text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger
                        render={<Button variant="destructive" size="sm" />}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Delete
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete portfolio?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete &quot;{p.name}&quot; and
                            all its holdings and accounts.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(p.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Questrade Connection */}
      <div className="animate-fade-in-up stagger-3 mt-8">
        <Collapsible defaultOpen={false}>
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm transition-colors hover:bg-accent">
            <div className="flex items-center gap-2">
              <span className="font-medium">Questrade Connection</span>
              {qtStatus && (
                <span
                  className={`text-xs font-semibold ${
                    qtStatus.status === "connected"
                      ? "text-green"
                      : qtStatus.status === "expired"
                        ? "text-yellow"
                        : "text-muted-foreground"
                  }`}
                >
                  {qtStatus.status === "connected"
                    ? "Connected"
                    : qtStatus.status === "expired"
                      ? "Token expired"
                      : "Not configured"}
                </span>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-panel-open]_&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardContent className="pt-6">
                {qtStatus?.status === "connected" ||
                qtStatus?.status === "expired" ? (
                  <Button variant="destructive" onClick={handleQtDisconnect}>
                    Disconnect
                  </Button>
                ) : (
                  <form onSubmit={handleQtConnect}>
                    <p className="mb-2 text-sm text-muted-foreground">
                      Paste your refresh token from{" "}
                      <a
                        href="https://www.questrade.com/api/documentation/getting-started"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80"
                      >
                        Questrade API Centre
                      </a>
                    </p>
                    <div className="flex items-center gap-3">
                      <Input
                        value={qtToken}
                        onChange={(e) => setQtToken(e.target.value)}
                        placeholder="Refresh token..."
                        type="password"
                        className="flex-1"
                      />
                      <Button type="submit" disabled={qtLoading}>
                        {qtLoading ? "Connecting..." : "Connect"}
                      </Button>
                    </div>
                    {qtError && (
                      <p className="mt-2 text-sm text-destructive">{qtError}</p>
                    )}
                  </form>
                )}
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
