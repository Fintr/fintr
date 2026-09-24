import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Account } from "@/types/accountTypes";
import { DeleteButton } from "./tabs/transactions/buttons/DeleteButton";

interface DeleteAccountDialogProps {
  account: Account;
  onDelete: (accountId: string) => Promise<any>;
  isLoading?: boolean;
}

const DeleteAccountDialog: React.FC<DeleteAccountDialogProps> = ({
  account,
  onDelete,
  isLoading = false,
}) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTriggerClick = useCallback(() => {
    setInternalIsOpen(true);
    setErrorMessage(null);
  }, []);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setErrorMessage(null);
    
    try {
      const response = await onDelete(account.id);

      if (response?.success === true) {
        toast.success(`Account "${account.name}" has been deleted`);
        setInternalIsOpen(false);
        setErrorMessage(null);
      } else {
        const backendMessage = response?.error?.details?.account || response?.error?.message || "Failed to delete account.";
        setErrorMessage(backendMessage);
      }
    } catch (error: any) {
      const errorMessageText = "An unexpected error occurred. Please try again.";
      setErrorMessage(errorMessageText);
    } finally {
      setIsDeleting(false);
    }
  }, [account.id, account.name, onDelete]);

  const handleCancel = useCallback(() => {
    setErrorMessage(null);
    setInternalIsOpen(false);
  }, []);

  const handleOpenChangeFromDialog = useCallback((openStateFromDialog: boolean) => {
    setInternalIsOpen(openStateFromDialog);
    if (!openStateFromDialog) {
      setErrorMessage(null);
    }
  }, []);

  return (
    <Dialog open={internalIsOpen} onOpenChange={handleOpenChangeFromDialog}>
      <DialogTrigger asChild>
        <DeleteButton onClick={handleTriggerClick} />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-primary dark:text-primary-dark-mode">
            Delete Account
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the account{" "}
            <span className="font-semibold text-primary dark:text-primary-dark-mode">
              &quot;{account.name}&quot;
            </span>
            ?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">

          {errorMessage && (
            <div className="text-sm text-red-900 bg-red-100/50 p-3 rounded-md border border-red-300">
              <strong>Error:</strong> {errorMessage}
            </div>
          )}          

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
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

export default DeleteAccountDialog; 
