"use client";

import { Progress } from "@/components/ui/progress";
import {
  cn,
  getOverBudgetOverflowProgressColor,
  getProgressColor,
} from "@/lib/utils";
import { getBudgetOverflowPercentage } from "@/lib/budgetUsage";

export interface BudgetUsageBarProps {
  usagePercentage: number;
  className?: string;
  showCaption?: boolean;
  overAmountLabel?: string;
}

export interface BudgetProgressProps {
  usagePercentage: number;
  className?: string;
}

export const budgetUsageProgressValue = (usagePercentage: number) =>
  Math.min(Math.max(usagePercentage, 0), 100);

export const BudgetProgress = ({
  usagePercentage,
  className,
}: BudgetProgressProps) => {
  const overflowPercentage = getBudgetOverflowPercentage(usagePercentage);
  const isOverBudget = usagePercentage > 100;

  if (!isOverBudget) {
    return (
      <Progress
        value={budgetUsageProgressValue(usagePercentage)}
        className={className}
        indicatorClassName={getProgressColor(usagePercentage, "bg")}
      />
    );
  }

  const basePercentage = 100 - overflowPercentage;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-full",
        className,
      )}
    >
      <div className="flex h-full w-full">
        {overflowPercentage > 0 ? (
          <div
            className={cn(
              "h-full transition-all",
              getProgressColor(usagePercentage, "bg"),
            )}
            style={{ width: `${overflowPercentage}%` }}
          />
        ) : null}
        <div
          className={cn(
            "h-full transition-all",
            getOverBudgetOverflowProgressColor("bg"),
          )}
          style={{ width: `${basePercentage}%` }}
        />
      </div>
    </div>
  );
};

export const BudgetUsageBar = ({
  usagePercentage,
  className,
  showCaption = true,
  overAmountLabel,
}: BudgetUsageBarProps) => {
  const isOverBudget = usagePercentage > 100;
  const displayPercent = Number.isFinite(usagePercentage)
    ? usagePercentage.toFixed(1)
    : "0.0";

  return (
    <div className={cn("space-y-1", className)}>
      <BudgetProgress
        usagePercentage={usagePercentage}
        className="h-2 bg-gray-200 dark:bg-muted/40"
      />
      {showCaption && (
        <p className="text-xs text-primary/60">
          {isOverBudget ? (
            <>
              <span className={getProgressColor(usagePercentage, "font")}>
                {displayPercent}% of budget used
              </span>
              {overAmountLabel ? ` · ${overAmountLabel} over` : " · over budget"}
            </>
          ) : (
            `${displayPercent}% of budget used`
          )}
        </p>
      )}
    </div>
  );
};
