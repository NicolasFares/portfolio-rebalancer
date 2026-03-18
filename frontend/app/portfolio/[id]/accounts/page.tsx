"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { AccountWithStats, AccountInput } from "@/lib/types";
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getPortfolio,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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

const CURRENCIES = ["CAD", "EUR", "USD"] as const;

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
  const [showForm, setShowForm] = useState(false);
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
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAccount(Number(id), form);
    setForm({ ...emptyAccount });
    setShowForm(false);
    load();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId === null) return;
    await updateAccount(editingId, editForm);
    setEditingId(null);
    load();
  };

  const handleDelete = async (accountId: number) => {
    await deleteAccount(accountId);
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

  const fmtCur = (n: number, currency: string) =>
    n.toLocaleString("en-CA", { style: "currency", currency });

  const renderForm = (
    currentForm: AccountInput,
    setCurrentForm: (f: AccountInput) => void,
    onSubmit: (e: React.FormEvent) => void,
    isEdit: boolean,
  ) => (
    <form
      onSubmit={onSubmit}
      className="mb-4 rounded-md border border-border bg-secondary p-4"
    >
      <p
        className={`mb-3 text-sm font-semibold ${isEdit ? "text-primary" : ""}`}
      >
        {isEdit ? "Edit Account" : "New Account"}
      </p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Name</Label>
          <Input
            required
            value={currentForm.name}
            onChange={(e) =>
              setCurrentForm({ ...currentForm, name: e.target.value })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Institution</Label>
          <Input
            value={currentForm.institution || ""}
            onChange={(e) =>
              setCurrentForm({ ...currentForm, institution: e.target.value })
            }
            placeholder="e.g. Questrade"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Account Type</Label>
          <Input
            value={currentForm.account_type || ""}
            onChange={(e) =>
              setCurrentForm({ ...currentForm, account_type: e.target.value })
            }
            placeholder="e.g. TFSA"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">
            Account Number
          </Label>
          <Input
            value={currentForm.account_number || ""}
            onChange={(e) =>
              setCurrentForm({
                ...currentForm,
                account_number: e.target.value,
              })
            }
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Currency</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={currentForm.currency}
            onChange={(e) =>
              setCurrentForm({ ...currentForm, currency: e.target.value })
            }
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Cash Balance</Label>
          <Input
            type="number"
            step="any"
            value={currentForm.cash_balance || ""}
            onChange={(e) =>
              setCurrentForm({
                ...currentForm,
                cash_balance: Number(e.target.value),
              })
            }
          />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <Button type="submit">{isEdit ? "Save" : "Add"}</Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (isEdit) setEditingId(null);
            else setShowForm(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/portfolio/${id}`}
            className="text-primary hover:text-primary/80"
          >
            ← Back to Portfolio
          </Link>
          <h1 className="text-2xl font-bold">Accounts ({accounts.length})</h1>
        </div>
        {editingId === null && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Account"}
          </Button>
        )}
      </div>

      {showForm && renderForm(form, setForm, handleAdd, false)}
      {editingId !== null && renderForm(editForm, setEditForm, handleUpdate, true)}

      {accounts.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          No accounts yet.
        </div>
      ) : (
        accounts.map((a) => (
          <Card key={a.id} className="mb-4">
            <CardContent className="pt-6">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <strong className="text-lg">{a.name}</strong>
                  <span className="ml-3 text-sm text-muted-foreground">
                    {a.institution ? `${a.institution} · ` : ""}
                    {a.currency}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowForm(false);
                      startEditing(a);
                    }}
                  >
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
              <div className="flex gap-8 text-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Cash
                  </span>
                  <span>{fmtCur(a.cash_balance, a.currency)}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Holdings
                  </span>
                  <span>
                    {a.holding_count} holding
                    {a.holding_count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                    Total
                  </span>
                  <span>{fmtCur(a.total_value, a.currency)}</span>
                </div>
                {a.currency !== baseCurrency && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      Total ({baseCurrency})
                    </span>
                    <span>{fmtCur(a.total_value_base, baseCurrency)}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
