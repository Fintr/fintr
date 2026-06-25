"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export type FilterSelectionPillVariant = "default" | "income" | "expense";

export type FilterSelectionPill = {
  value: string;
  label: string;
  variant?: FilterSelectionPillVariant;
};

const pillVariantClassNames: Record<
  FilterSelectionPillVariant,
  { pill: string; removeButton: string }
> = {
  default: {
    pill: "border-primary/20 bg-primary/5 text-primary dark:border-0 dark:bg-input/30 dark:text-foreground",
    removeButton:
      "text-primary/70 hover:bg-primary/10 hover:text-primary focus-visible:ring-primary/40",
  },
  income: {
    pill: "border-teal-300 bg-teal-50 text-teal-600 dark:border-teal-500/30 dark:bg-teal-950/40 dark:text-teal-500",
    removeButton:
      "text-teal-600/70 hover:bg-teal-100 hover:text-teal-600 focus-visible:ring-teal-400/40 dark:text-teal-500/70 dark:hover:bg-teal-950/60 dark:hover:text-teal-500",
  },
  expense: {
    pill: "border-red-200 bg-red-50 text-red-900 dark:border-0 dark:bg-red-950/40 dark:text-red-700",
    removeButton:
      "text-red-800/70 hover:bg-red-100 hover:text-red-900 focus-visible:ring-red-400/40 dark:text-red-700/70 dark:hover:bg-red-950/60 dark:hover:text-red-600",
  },
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
      {selections.map((selection) => {
        const variant = selection.variant ?? "default";
        const variantClassNames = pillVariantClassNames[variant];

        return (
        <span
          key={selection.value}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-sm",
            variantClassNames.pill,
          )}
        >
          <span className="truncate">{selection.label}</span>
          <button
            type="button"
            className={cn(
              "rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
              variantClassNames.removeButton,
            )}
            aria-label={`Remove ${selection.label}`}
            onClick={() => onRemove(selection.value)}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
        );
      })}
    </div>
  );
};

export default FilterSelectionPills;
