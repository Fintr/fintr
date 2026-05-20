import React, { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "sonner";
import { BudgetCategory } from "@/types/budgetTypes";
import { DeleteButton } from "../transactions/buttons/DeleteButton";
import { formatCurrency } from "@/lib/utils";

interface DeleteBudgetDialogProps {
  budget: BudgetCategory;
  onDelete: (budgetId: string) => Promise<unknown>;
  isLoading?: boolean;
  currency?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
}

export const DeleteBudgetDialog: React.FC<DeleteBudgetDialogProps> = ({
  budget,
  onDelete,
  isLoading = false,
  currency = "PHP",
  variant,
  size,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setErrorMessage(null);
    }
  }, []);

  const handleCancel = useCallback(() => {
    setErrorMessage(null);
    setIsOpen(false);
  }, []);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await onDelete(budget.id);
      toast.success(`Budget for "${budget.name}" has been deleted`);
      setIsOpen(false);
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { error?: { message?: string } } };
      };
      const message =
        axiosError?.response?.data?.error?.message ||
        "An unexpected error occurred. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsDeleting(false);
    }
  }, [budget.id, budget.name, onDelete]);

  const isBusy = isDeleting || isLoading;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <DeleteButton
          variant={variant}
          size={size}
          disabled={isBusy}
        />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-primary">Delete Budget</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Are you sure you want to delete the budget for{" "}
            <span className="font-semibold text-primary">
              &quot;{budget.name}&quot;
            </span>
            ?
            <br />
            <br />
            This will remove the budget limit for this category. Your past
            spending data will not be affected.
            <br />
            <br />
            <span className="font-medium text-primary">
              Budget: {formatCurrency(budget.budget, currency)}
            </span>
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
              {isBusy ? "Deleting..." : "Delete Budget"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
