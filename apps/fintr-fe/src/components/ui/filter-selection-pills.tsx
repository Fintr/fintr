"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterSelectionPill = {
  value: string;
  label: string;
};

export interface FilterSelectionPillsProps {
  selections: FilterSelectionPill[];
  onRemove: (value: string) => void;
  className?: string;
}

export interface FilterClearAllButtonProps {
  onClick: () => void;
  className?: string;
}

export const FILTER_CLEAR_ALL_MIN_COUNT = 2;

export const filterClearAllButtonClassName =
  "shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm";

export const FilterClearAllButton = ({
  onClick,
  className,
}: FilterClearAllButtonProps) => (
  <button
    type="button"
    className={cn(filterClearAllButtonClassName, className)}
    onClick={onClick}
  >
    Clear all
  </button>
);

export const FilterSelectionPills = ({
  selections,
  onRemove,
  className,
}: FilterSelectionPillsProps) => {
  if (selections.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {selections.map((selection) => (
        <span
          key={selection.value}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-sm text-primary dark:border-0 dark:bg-input/30 dark:text-foreground"
        >
          <span className="truncate">{selection.label}</span>
          <button
            type="button"
            className="rounded-full p-0.5 text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={`Remove ${selection.label}`}
            onClick={() => onRemove(selection.value)}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
};

export default FilterSelectionPills;
