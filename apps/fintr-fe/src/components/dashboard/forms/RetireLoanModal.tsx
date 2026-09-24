"use client";

import React, { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { Loan } from "@/services/loans/queries";
import { updateLoanLocalFirst } from "@/services/loans/update-local-first";
import { LOAN_DETAIL_KEY } from "@/hooks/async/useLoan";
import { formatCurrency } from "@/lib/utils";
import { formatLoanStatusLabel } from "@/utils/loan-status";

type RetireLoanModalProps = {
  loan: Loan;
};

const RetireLoanModal: React.FC<RetireLoanModalProps> = ({ loan }) => {
  const { api } = useAuthApi({
    scope:
      "openid profile email read:current_user read:transactions write:transactions",
  });
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isRetired = loan.status === "defaulted";

  const applyStatus = useCallback(
    async (status: "active" | "defaulted") => {
      if (!api || !spaceCode) {
        throw new Error("API not available");
      }

      const result = await updateLoanLocalFirst(
        api,
        {
          spaceId: spaceCode,
          data: {
            id: loan.id,
            status,
          },
          previous: loan,
        },
        { queryClient, waitForSync: false },
      );

      void Promise.resolve(result.syncPromise)
        .then(async (synced) => {
          if (synced.pendingSync) {
            return;
          }
          await queryClient.invalidateQueries({ queryKey: ["loans"] });
          await queryClient.invalidateQueries({
            queryKey: [LOAN_DETAIL_KEY, loan.id],
          });
        })
        .catch(() => undefined);

      return result;
    },
    [api, loan, queryClient, spaceCode],
  );

  const handleRetire = useCallback(async () => {
    setIsSaving(true);
    setIsOpen(false);
    try {
      const result = await applyStatus("defaulted");
      toast.success(
        `Loan with ${loan.entityName} is now ${formatLoanStatusLabel("defaulted").toLowerCase()}`,
      );
      if (result.pendingSync) {
        toast.message("Retired on this device. Will sync when online.");
      }
    } catch {
      toast.error("Failed to retire loan.");
    } finally {
      setIsSaving(false);
    }
  }, [applyStatus, loan.entityName]);

  const handleRestore = useCallback(async () => {
    setIsSaving(true);
    try {
      const result = await applyStatus("active");
      toast.success(`Loan with ${loan.entityName} is active again`);
      if (result.pendingSync) {
        toast.message("Restored on this device. Will sync when online.");
      }
    } catch {
      toast.error("Failed to restore loan.");
    } finally {
      setIsSaving(false);
    }
  }, [applyStatus, loan.entityName]);

  if (loan.status === "paid_off") {
    return null;
  }

  if (isRetired) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={handleRestore}
        disabled={isSaving}
      >
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {isSaving ? "Restoring…" : "Un-retire"}
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={isSaving}
        >
          <Ban className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Retire
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-primary">Retire loan</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left">
              <p>
                Retire the loan with{" "}
                <span className="font-semibold text-foreground">
                  {loan.entityName}
                </span>
                ? It leaves the active book. Outstanding stays{" "}
                {formatCurrency(
                  loan.outstandingBalance,
                  loan.outstandingBalanceCurrency,
                )}
                . No expense or income is recorded, and cash does not change.
              </p>
              <p>You can un-retire it later if payments start again.</p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleRetire}
            disabled={isSaving}
          >
            {isSaving ? "Retiring…" : "Retire loan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RetireLoanModal;
