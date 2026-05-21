"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { AnimatedSheetShell } from "@/components/ui/animated-sheet-shell";
import LoadingSpinner from "@/components/ui/loading-spinner";

export type FilterSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  onReset: () => void;
  onApply: () => void;
  applyDisabled?: boolean;
  applyLoading?: boolean;
  children: React.ReactNode;
};

export const FilterSheet = ({
  open,
  onOpenChange,
  title = "Filters",
  onReset,
  onApply,
  applyDisabled = false,
  applyLoading = false,
  children,
}: FilterSheetProps) => {
  const titleId = useId();

  return (
    <AnimatedSheetShell
      open={open}
      onRequestClose={() => onOpenChange(false)}
      titleId={titleId}
      side="right"
      swipeToClose
      historyKey="__fintrFilterSheet"
      panelClassName="w-full sm:max-w-lg flex flex-col overflow-hidden p-0 min-h-0 h-full"
    >
      <div className="p-6 pb-4 flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        <div className="text-left shrink-0">
          <h2
            id={titleId}
            className="text-2xl font-bold text-primary"
          >
            {title}
          </h2>
        </div>
        <div className="mt-6 flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-2 py-2 -mx-2 space-y-4">
          {children}
        </div>
      </div>
      <div className="border-t bg-background p-4 sm:p-6 gap-2 mt-auto shrink-0 flex flex-col sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          className="w-full sm:w-auto order-2 sm:order-1"
          onClick={onReset}
        >
          Reset filters
        </Button>
        <Button
          type="button"
          className="w-full sm:w-auto order-1 sm:order-2"
          onClick={onApply}
          disabled={applyDisabled || applyLoading}
        >
          {applyLoading ? (
            <>
              <LoadingSpinner size="small" className="mr-2" />
              Apply
            </>
          ) : (
            "Apply"
          )}
        </Button>
      </div>
    </AnimatedSheetShell>
  );
};

export default FilterSheet;
