"use client";

import type { HoldingInput, Account } from "@/lib/types";
import { HoldingForm } from "@/components/holding-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface HoldingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  form: HoldingInput;
  setForm: (f: HoldingInput) => void;
  accounts: Account[];
  onSubmit: (e: React.FormEvent) => void;
}

export function HoldingDialog({
  open,
  onOpenChange,
  mode,
  form,
  setForm,
  accounts,
  onSubmit,
}: HoldingDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Holding" : "Add Holding"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the details of this holding."
              : "Add a new holding to your portfolio."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(e);
          }}
        >
          <HoldingForm form={form} setForm={setForm} accounts={accounts} />
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {mode === "edit" ? "Save Changes" : "Add Holding"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
