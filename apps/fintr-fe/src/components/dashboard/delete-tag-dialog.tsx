"use client";

import React, { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { TransactionTag } from "@/types/transactionTagTypes";

type DeleteTagDialogProps = {
  tag: TransactionTag;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (tagId: string) => Promise<void>;
  isLoading?: boolean;
};

const DeleteTagDialog: React.FC<DeleteTagDialogProps> = ({
  tag,
  open,
  onOpenChange,
  onDelete,
  isLoading = false,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
      if (!nextOpen) {
        setErrorMessage(null);
      }
    },
    [onOpenChange],
  );

  const handleCancel = useCallback(() => {
    setErrorMessage(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await onDelete(tag.id);
      onOpenChange(false);
    } catch {
      setErrorMessage("Could not delete this tag. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [onDelete, onOpenChange, tag.id]);

  const isBusy = isDeleting || isLoading;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-primary">Delete tag</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold text-primary">
              &quot;{tag.name}&quot;
            </span>
            ? This will remove it from all transactions.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {errorMessage ? (
            <div className="rounded-md border border-red-300 bg-red-100/50 p-3 text-sm text-red-900">
              <strong>Error:</strong> {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isBusy}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isBusy}
            >
              {isBusy ? "Deleting..." : "Delete tag"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteTagDialog;
