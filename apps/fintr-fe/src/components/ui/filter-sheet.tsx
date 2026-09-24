"use client";

import { useId } from "react";

import { Button } from "@/components/ui/button";
import { AnimatedSheetShell } from "@/components/ui/animated-sheet-shell";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { cn } from "@/lib/utils";

/** Toolbar filter trigger with label (e.g. Budgets, Insights, Transactions). */
export const filterTriggerButtonClassName =
  "flex items-center gap-2 border-0 bg-white shadow-sm hover:bg-gray-100 dark:bg-card dark:hover:bg-accent/50";

/** Icon-only filter trigger (account / category detail). */
export const filterTriggerIconButtonClassName =
  "h-10 min-h-10 w-10 min-w-10 rounded-lg border-muted-foreground/25 bg-white text-foreground hover:bg-muted/60 dark:border-border dark:bg-card dark:hover:bg-accent/50";

/** Active-filters indicator dot on filter triggers. */
export const filterActiveBadgeClassName =
  "absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full border-2 border-white bg-red-500 dark:border-background";

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
  const { isAndroidNative, isIOSNative } = usePlatformDetection();

  const dismissSheet = () => {
    onOpenChange(false);
  };

  const handleApplyClick = () => {
    dismissSheet();
    onApply();
  };

  const handleResetClick = () => {
    dismissSheet();
    onReset();
  };

  const stopFooterGesture = (event: React.SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <AnimatedSheetShell
      open={open}
      onRequestClose={dismissSheet}
      titleId={titleId}
      side="right"
      swipeToClose
      historyKey="__fintrFilterSheet"
      panelClassName="w-full sm:max-w-lg flex flex-col h-full min-h-0 overflow-hidden p-0"
    >
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <div className="px-6 pt-4 pb-2 text-left">
          <h2
            id={titleId}
            className="text-2xl font-bold text-primary"
          >
            {title}
          </h2>
        </div>
        <div className="px-6 mt-4 space-y-4 pb-4">
          {children}
        </div>
      </div>
      <div
        className={cn(
          "mt-auto shrink-0 border-t bg-background p-4 sm:p-6 gap-2 flex flex-col sm:flex-row sm:justify-between",
          (isAndroidNative || isIOSNative) && "pb-safe-bottom",
        )}
        onTouchStart={stopFooterGesture}
        onTouchMove={stopFooterGesture}
        onTouchEnd={stopFooterGesture}
        onPointerDown={stopFooterGesture}
      >
        <Button
          type="button"
          variant="ghost"
          className="w-full sm:w-auto order-2 sm:order-1"
          onClick={handleResetClick}
        >
          Reset filters
        </Button>
        <Button
          type="button"
          className="w-full sm:w-auto order-1 sm:order-2"
          onClick={handleApplyClick}
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
