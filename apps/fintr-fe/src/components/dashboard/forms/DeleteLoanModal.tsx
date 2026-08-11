import React, { useState, useCallback } from "react";
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
import { Loan } from "@/services/loans/queries";
import { cn, transactionDeleteIconButtonClassName } from "@/lib/utils";

interface DeleteLoanModalProps {
  loan: Loan;
  onDelete: (loanId: string) => Promise<any>;
  isLoading?: boolean;
  triggerVariant?: "inline" | "toolbar";
}

const DeleteLoanModal: React.FC<DeleteLoanModalProps> = ({
  loan,
  onDelete,
  isLoading = false,
  triggerVariant = "inline",
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
    setInternalIsOpen(false);

    const loanDisplayName = loan.entityName || "Loan";
    toast.success(`Loan "${loanDisplayName}" has been deleted`);

    try {
      const response = await onDelete(loan.id);

      if (response?.pendingSync) {
        toast.message("Loan deleted on this device. Will sync when online.");
      } else if (response?.success !== true) {
        const backendMessage =
          response?.error?.details?.loan_id ||
          response?.error?.message ||
          "Failed to delete loan.";
        toast.error(backendMessage);
      }
    } catch (error: unknown) {
      const axiosError = error as {
        response?: { data?: { error?: { message?: string } } };
      };
      const errorMessageText =
        axiosError?.response?.data?.error?.message ||
        "An unexpected error occurred. Please try again.";
      toast.error(errorMessageText);
    } finally {
      setIsDeleting(false);
    }
  }, [loan.id, loan.entityName, onDelete]);

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

  const loanDisplayName = loan.entityName || 'Loan';
  const loanAmount = typeof loan.principalAmount === 'string' 
    ? parseFloat(loan.principalAmount) 
    : loan.principalAmount;
  const loanCurrency = loan.principalAmountCurrency || 'PHP';

  const isToolbarTrigger = triggerVariant === "toolbar";

  return (
    <Dialog open={internalIsOpen} onOpenChange={handleOpenChangeFromDialog}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size={isToolbarTrigger ? "icon" : "sm"}
          variant={isToolbarTrigger ? "outline" : "ghost"}
          className={
            isToolbarTrigger
              ? "rounded-lg border-red-800/35 text-red-800 hover:bg-red-100/50 hover:text-red-800 dark:hover:bg-red-950/40"
              : cn(
                  transactionDeleteIconButtonClassName,
                  "h-6 w-6 p-0",
                )
          }
          onClick={(e) => {
            e.stopPropagation();
            handleTriggerClick();
          }}
          disabled={isDeleting}
          aria-label={`Delete loan with ${loanDisplayName}`}
        >
          <Trash2
            className={
              isToolbarTrigger
                ? "h-4 w-4 text-red-800"
                : "h-3 w-3"
            }
            aria-hidden
          />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Loan</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            Are you sure you want to delete the loan with{" "}
            <span className="font-semibold text-gray-900">"{loanDisplayName}"</span>?
            <br />
            <br />
            This will also delete all associated loan payments and reverse the account balance adjustments.
            <br />
            <br />
            <span className="font-medium">Principal Amount: {loanAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {loanCurrency}</span>
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
              {isDeleting ? "Deleting..." : "Delete Loan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteLoanModal;

