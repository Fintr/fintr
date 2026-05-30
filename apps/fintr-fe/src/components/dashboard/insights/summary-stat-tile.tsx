"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SummaryStatTileProps {
  label: string;
  value: string;
  valueClassName?: string;
  footer?: string;
  action?: ReactNode;
  className?: string;
}

export const statTileSurfaceClassName =
  "rounded-lg bg-[#f9f7f5] p-4 shadow-sm dark:bg-background";

export const statTilePlaceholderClassName =
  "h-[88px] animate-pulse rounded-lg bg-muted p-4";

/** Matches the Budget Summary outer `Card` surface (not the inner stat tiles). */
export const budgetSummaryCardSurfaceClassName =
  "rounded-lg bg-white dark:bg-card dark:shadow-sm";

export const SummaryStatTile = ({
  label,
  value,
  valueClassName = "text-primary",
  footer,
  action,
  className,
}: SummaryStatTileProps) => {
  return (
    <div className={cn(statTileSurfaceClassName, className)}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <h4 className="text-sm font-medium text-primary/70">{label}</h4>
        {action}
      </div>
      <div className={cn("text-2xl font-bold", valueClassName)}>{value}</div>
      {footer && (
        <p className="text-xs text-primary/60 mt-1">{footer}</p>
      )}
    </div>
  );
};

export const summaryStatGridClassName = (count: number) =>
  cn(
    "grid grid-cols-1 gap-4",
    count >= 4
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : "sm:grid-cols-2 lg:grid-cols-3",
  );
