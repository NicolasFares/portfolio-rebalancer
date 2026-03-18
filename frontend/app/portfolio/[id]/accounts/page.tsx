"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Plus, Wallet, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { AccountWithStats, AccountInput } from "@/lib/types";
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getPortfolio,
} from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { PortfolioNav } from "@/components/portfolio-nav";
import { AccountDialog } from "@/components/account-dialog";
import { StatCard } from "@/components/stat-card";
import { EmptyState } from "@/components/empty-state";
import { AccountsSkeleton } from "@/components/page-skeleton";

const emptyAccount: AccountInput = {
  name: "",
  institution: "",
  account_type: "",
  account_number: "",
  currency: "CAD",
  cash_balance: 0,
};

export default function AccountList() {
  const { id } = useParams<{ id: string }>();
  const [accounts, setAccounts] = useState<AccountWithStats[]>([]);
  const [portfolioName, setPortfolioName] = useState("");
  const [baseCurrency, setBaseCurrency] = useState("CAD");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<AccountInput>({ ...emptyAccount });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AccountInput>({ ...emptyAccount });

  const load = async () => {
    if (!id) return;
    const [accts, portfolio] = await Promise.all([
      listAccounts(Number(id)),
      getPortfolio(Number(id)),
    ]);
    setAccounts(accts);
    setPortfolioName(portfolio.name);
    setBaseCurrency(portfolio.base_currency);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAccount(Number(id), form);
    setForm({ ...emptyAccount });
    setAddOpen(false);
    toast.success("Account created");
    load();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    await updateAccount(editingId, editForm);
    setEditingId(null);
    toast.success("Account updated");
    load();
  };

  const handleDelete = async (accountId: number) => {
    await deleteAccount(accountId);
    toast.success("Account deleted");
    load();
  };

  const startEditing = (a: AccountWithStats) => {
    setEditingId(a.id);
    setEditForm({
      name: a.name,
      institution: a.institution || "",
      account_type: a.account_type || "",
      account_number: a.account_number || "",
      currency: a.currency,
      cash_balance: a.cash_balance,
    });
  };

  if (loading) return <AccountsSkeleton />;

  return (
    <div>
      <div className="animate-fade-in-up stagger-1 mb-6 flex items-center justify-between">
        <h1 className="font-serif text-3xl">Accounts ({accounts.length})</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Account
        </Button>
      </div>

      <PortfolioNav portfolioId={id} portfolioName={portfolioName} />

      <AccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="add"
        form={form}
        setForm={setForm}
        onSubmit={handleAdd}
      />

      <AccountDialog
        open={editingId !== null}
        onOpenChange={(open) => { if (!open) setEditingId(null); }}
        mode="edit"
        form={editForm}
        setForm={setEditForm}
        onSubmit={handleUpdate}
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add an account to organize your holdings."
          action={{ label: "Add Account", onClick: () => setAddOpen(true) }}
        />
      ) : (
        accounts.map((a, i) => (
          <Card
            key={a.id}
            className={`animate-fade-in-up stagger-${Math.min(i + 2, 5)} hover-card mb-4`}
          >
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <strong className="font-serif text-lg">{a.name}</strong>
                  {a.account_type && (
                    <Badge variant="secondary">{a.account_type}</Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {a.institution ? `${a.institution} · ` : ""}
                    {a.currency}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(a)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={<Button variant="ghost" size="sm" className="text-destructive" />}
                    >
                      Delete
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete account?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete &quot;{a.name}&quot; and
                          all its holdings.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(a.id)}>
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard
                  size="sm"
                  label="Cash"
                  value={formatCurrency(a.cash_balance, a.currency)}
                />
                <StatCard
                  size="sm"
                  label="Holdings"
                  value={`${a.holding_count} holding${a.holding_count !== 1 ? "s" : ""}`}
                />
                <StatCard
                  size="sm"
                  label="Total"
                  value={formatCurrency(a.total_value, a.currency)}
                />
                {a.currency !== baseCurrency && (
                  <StatCard
                    size="sm"
                    label={`Total (${baseCurrency})`}
                    value={formatCurrency(a.total_value_base, baseCurrency)}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
