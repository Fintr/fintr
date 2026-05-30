"use client";

import { cn } from "@/lib/utils";

export type FilterOptionPill = {
  value: string;
  label: string;
};

export interface FilterOptionPillsProps {
  options: FilterOptionPill[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
}

export const FilterOptionPills = ({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: FilterOptionPillsProps) => {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => {
        const isSelected = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
              isSelected
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-primary/15 bg-primary/5 text-primary hover:bg-primary/10 dark:border-0 dark:bg-input/30 dark:text-muted-foreground dark:hover:bg-input/50",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default FilterOptionPills;
