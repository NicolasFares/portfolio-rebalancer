"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function PortfolioList() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [name, setName] = useState("");
  const [qtStatus, setQtStatus] = useState<QuestradeStatus | null>(null);
  const [qtToken, setQtToken] = useState("");
  const [qtError, setQtError] = useState("");
  const [qtLoading, setQtLoading] = useState(false);

  const load = () => listPortfolios().then(setPortfolios);

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
    load();
  };

  const handleDelete = async (id: number) => {
    await deletePortfolio(id);
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
    } catch (err: unknown) {
      setQtError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setQtLoading(false);
    }
  };

  const handleQtDisconnect = async () => {
    await questradeDisconnect();
    loadQtStatus();
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Portfolios</h1>

      <form onSubmit={handleCreate} className="mb-6 flex items-center gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New portfolio name..."
          className="flex-1"
        />
        <Button type="submit">Create</Button>
      </form>

      {portfolios.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No portfolios yet. Create one above.
        </div>
      ) : (
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
                <TableCell className="text-muted-foreground">
                  {new Date(p.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={<Button variant="destructive" size="sm" />}
                    >
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
      )}

      {/* Questrade Connection */}
      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Questrade Connection</CardTitle>
            {qtStatus && (
              <span
                className={`text-sm font-semibold ${
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
                    ? "Token expired (will refresh)"
                    : "Not configured"}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
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
    </div>
  );
}
