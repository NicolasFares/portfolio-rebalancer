"use client";

import type { AccountInput } from "@/lib/types";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const CURRENCIES = ["CAD", "EUR", "USD"] as const;

interface AccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  form: AccountInput;
  setForm: (f: AccountInput) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function AccountDialog({
  open,
  onOpenChange,
  mode,
  form,
  setForm,
  onSubmit,
}: AccountDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Account" : "Add Account"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the details of this account."
              : "Add a new account to your portfolio."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(e);
          }}
        >
          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Account Info
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Institution</Label>
              <Input
                value={form.institution || ""}
                onChange={(e) => setForm({ ...form, institution: e.target.value })}
                placeholder="e.g. Questrade"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Account Type</Label>
              <Input
                value={form.account_type || ""}
                onChange={(e) => setForm({ ...form, account_type: e.target.value })}
                placeholder="e.g. TFSA"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Account Number</Label>
              <Input
                value={form.account_number || ""}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
              />
            </div>
          </div>

          <Separator className="my-4" />

          <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Financial Details
          </p>
          <div className="grid grid-cols-2 gap-3">
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
              <Label className="text-xs text-muted-foreground">Cash Balance</Label>
              <Input
                type="number"
                step="any"
                value={form.cash_balance || ""}
                onChange={(e) => setForm({ ...form, cash_balance: Number(e.target.value) })}
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {mode === "edit" ? "Save Changes" : "Add Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
