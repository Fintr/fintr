import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DeleteButton } from "./tabs/transactions/buttons/DeleteButton";

interface CategoryItem {
  id: string;
  name: string;
  color?: string;
  [key: string]: unknown;
}

interface DeleteCategoryDialogProps {
  category: CategoryItem;
  onDelete: (categoryId: string) => Promise<unknown>;
  isLoading?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

const DeleteCategoryDialog: React.FC<DeleteCategoryDialogProps> = ({
  category,
  onDelete,
  isLoading = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled
    ? (open: boolean) => controlledOnOpenChange?.(open)
    : setInternalOpen;

  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleTriggerClick = useCallback(() => {
    setIsOpen(true);
    setErrorMessage(null);
  }, [setIsOpen]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      const response = await onDelete(category.id);

      if (response && typeof response === "object" && "success" in response) {
        if (response.success === true) {
          toast.success(`Category "${category.name}" has been deleted`);
          setIsOpen(false);
          setErrorMessage(null);
          return;
        }

        const err = response as {
          error?: { details?: { category?: string }; message?: string };
        };
        const backendMessage =
          err.error?.details?.category ||
          err.error?.message ||
          "Failed to delete category.";
        setErrorMessage(backendMessage);
        return;
      }

      toast.success(`Category "${category.name}" has been deleted`);
      setIsOpen(false);
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }, [category.id, category.name, onDelete, setIsOpen]);

  const handleCancel = useCallback(() => {
    setErrorMessage(null);
    setIsOpen(false);
  }, [setIsOpen]);

  const handleOpenChangeFromDialog = useCallback(
    (openStateFromDialog: boolean) => {
      setIsOpen(openStateFromDialog);
      if (!openStateFromDialog) {
        setErrorMessage(null);
      }
    },
    [setIsOpen],
  );

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChangeFromDialog}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <DeleteButton onClick={handleTriggerClick} />
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete category</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-900">
              &quot;{category.name}&quot;
            </span>
            ?
          </div>

          {errorMessage ? (
            <div className="text-sm text-red-900 bg-red-100/50 p-3 rounded-md border border-red-300">
              <strong>Error:</strong> {errorMessage}
            </div>
          ) : null}

          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isDeleting || isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || isLoading}
            >
              {isDeleting ? "Deleting..." : "Delete category"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteCategoryDialog;
