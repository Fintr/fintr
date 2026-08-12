"use client";

import React, { useEffect, useId, useState } from "react";
import { X } from "lucide-react";

import LoanForm from "@/components/dashboard/forms/LoanForm";
import { AnimatedSheetShell } from "@/components/ui/animated-sheet-shell";
import { CustomModal } from "@/components/ui/custom-modal";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";

type AddLoanDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (data: unknown) => void;
};

export function AddLoanDialog({
  isOpen,
  onClose,
  onSuccess,
}: AddLoanDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const isMobile = useMediaQuery("(max-width: 767px)");
  const titleId = useId();

  useEffect(() => {
    if (isOpen) {
      setDate(new Date());
    }
  }, [isOpen]);

  const handleSuccess = (data: unknown) => {
    onSuccess?.(data);
    onClose();
  };

  const formContent = (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <LoanForm
        date={date}
        setDate={setDate}
        onSubmitSuccess={handleSuccess}
        onCancel={onClose}
      />
    </div>
  );

  if (isMobile) {
    return (
      <AnimatedSheetShell
        open={isOpen}
        onRequestClose={onClose}
        titleId={titleId}
        side="right"
        swipeToClose
        historyKey="__fintrAddLoanSheet"
        panelClassName="flex h-full min-h-0 w-full flex-col overflow-hidden p-0"
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-4">
          <h2 id={titleId} className="text-lg font-semibold text-primary">
            Add Loan
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {formContent}
      </AnimatedSheetShell>
    );
  }

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Loan"
      maxWidth="2xl"
      className="p-0"
      pinBodyLayout
    >
      {formContent}
    </CustomModal>
  );
}
