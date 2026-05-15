"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    if (!account) return;

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await deleteAccount(account.id);

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
          <DialogTitle>Delete Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Are you sure you want to delete the account{" "}
            <span className="font-semibold text-gray-900">
              &quot;{account?.name}&quot;
            </span>
            ?
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
              {isDeleting ? "Deleting..." : "Delete Account"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccountDeleteDialog;
