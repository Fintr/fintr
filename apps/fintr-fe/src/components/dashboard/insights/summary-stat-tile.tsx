"use client";

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface SummaryStatTileProps {
  label: string;
  value: string;
  valueClassName?: string;
  footer?: ReactNode;
  action?: ReactNode;
  className?: string;
  compact?: boolean;
  variant?: "default" | "insight";
}

export const statTileSurfaceClassName =
  "rounded-lg bg-[#f9f7f5] p-4 shadow-sm dark:bg-background";

/** Insight dashboard metric tiles — ledger inset cells. */
export const insightMetricTileSurfaceClassName =
  "flex flex-col rounded-none border-0 bg-transparent p-4";

export const statTilePlaceholderClassName =
  "h-[5.5rem] animate-pulse rounded-xl bg-muted p-3.5";

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
  compact = false,
  variant = "default",
}: SummaryStatTileProps) => {
  const isInsight = variant === "insight";

  return (
    <div
      className={cn(
        isInsight ? insightMetricTileSurfaceClassName : statTileSurfaceClassName,
        !isInsight && compact && "p-4",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2",
          isInsight ? "mb-1" : "mb-1.5",
        )}
      >
        <h4
          className={cn(
            "font-medium text-foreground",
            isInsight ? "text-sm" : compact ? "text-xs" : "text-sm",
          )}
        >
          {label}
        </h4>
        {action}
      </div>
      <div
        className={cn(
          "font-bold",
          isInsight ? "text-lg" : compact ? "text-lg" : "text-2xl",
          valueClassName,
        )}
      >
        {value}
      </div>
      {footer ? (
        <div
          className={cn(
            "leading-snug",
            isInsight ? "mt-2" : "mt-2.5",
            compact && !isInsight ? "text-[11px]" : isInsight ? "text-[10px]" : "text-xs",
          )}
        >
          {footer}
        </div>
      ) : null}
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

export const insightMetricRailClassName = (count: number) =>
  cn(
    "hidden gap-3 lg:grid lg:overflow-visible",
    count >= 4
      ? "lg:grid-cols-2 xl:grid-cols-4"
      : "lg:grid-cols-2 xl:grid-cols-3",
  );

export const insightMetricRailItemClassName = "min-w-0";

export const summaryStatRailClassName = (count: number) =>
  cn(
    "insight-rail-peek -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 snap-x snap-proximity",
    "sm:mx-0 sm:grid sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 sm:snap-none",
    count >= 4
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : "sm:grid-cols-2 lg:grid-cols-3",
  );

export const summaryStatRailItemClassName =
  "w-[min(78vw,17.5rem)] shrink-0 snap-start sm:w-auto";
