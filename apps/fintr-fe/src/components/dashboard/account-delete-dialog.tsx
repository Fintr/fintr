"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Account } from "@/types/accountTypes";
import { useAccounts } from "@/hooks/async/useAccounts";
import { toast } from "sonner";

type AccountDeleteDialogProps = {
  account: Account | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
};

const AccountDeleteDialog: React.FC<AccountDeleteDialogProps> = ({
  account,
  open,
  onOpenChange,
  onDeleted,
}) => {
  const { deleteAccount } = useAccounts();
  const [isDeleting, setIsDeleting] = useState(false);
  const [removeTransactions, setRemoveTransactions] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setRemoveTransactions(false);
      setErrorMessage(null);
    }
  }, [open]);

  const handleDeleteAccount = async () => {
    if (!account) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await deleteAccount({
        accountId: account.id,
        removeTransactions,
      });

      if (response?.success === true) {
        toast.success(`Account "${account.name}" has been deleted`);
        onOpenChange(false);
        setErrorMessage(null);
        onDeleted?.();
      } else {
        const backendMessage =
          response?.error?.details?.account ||
          response?.error?.message ||
          "Failed to delete account.";
        setErrorMessage(backendMessage);
      }
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-primary dark:text-primary-dark-mode">
            Delete Account
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the account{" "}
            <span className="font-semibold text-primary dark:text-primary-dark-mode">
              &quot;{account?.name}&quot;
            </span>
            ?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="remove-account-transactions"
              checked={removeTransactions}
              onCheckedChange={(checked) =>
                setRemoveTransactions(checked === true)
              }
              disabled={isDeleting}
            />
            <div className="space-y-1">
              <Label
                htmlFor="remove-account-transactions"
                className="text-sm font-medium text-foreground leading-snug"
              >
                Also remove transactions for this account
              </Label>
              <p className="text-sm text-muted-foreground">
                Income, expenses, transfers, and loan activity on this account
                are deleted. Transfers update the other account.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="text-sm text-red-900 bg-red-100/50 p-3 rounded-md border border-red-300">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={isDeleting}
            >
              {isDeleting
                ? "Deleting..."
                : removeTransactions
                  ? "Delete account and transactions"
                  : "Delete Account"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccountDeleteDialog;
