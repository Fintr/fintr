import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Account } from "@/types/accountTypes";

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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-delete hover:bg-red-100"
          onClick={handleTriggerClick}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Are you sure you want to delete the account{" "}
            <span className="font-semibold text-gray-900">"{account.name}"</span>?
          </div>

          {errorMessage && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-200">
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
