"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface DeleteLoanPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting?: boolean;
}

const DeleteLoanPaymentModal: React.FC<DeleteLoanPaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Delete Loan Payment
          </DialogTitle>
          <DialogDescription className="text-left">
            You are deleting a single loan payment. This action will delete only this specific payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800">
              This action cannot be undone. The payment will be{" "}
              <span className="text-red-600 font-medium">permanently removed</span> and the account balance will be updated.
            </p>
          </div>

          <RadioGroup value="this_only" className="space-y-3" disabled>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="this_only" id="this_only" />
              <Label htmlFor="this_only" className="cursor-pointer">
                <div>
                  <div className="font-medium">This payment only</div>
                  <div className="text-sm text-gray-500">
                    Delete only this specific payment
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="destructive"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteLoanPaymentModal;

