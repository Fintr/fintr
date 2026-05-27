"use client";

import { Progress } from "@/components/ui/progress";
import { cn, getProgressColor } from "@/lib/utils";

export interface BudgetUsageBarProps {
  usagePercentage: number;
  className?: string;
  showCaption?: boolean;
  overAmountLabel?: string;
}

export const budgetUsageProgressValue = (usagePercentage: number) =>
  Math.min(Math.max(usagePercentage, 0), 100);

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
      <Progress
        value={budgetUsageProgressValue(usagePercentage)}
        className="h-2 bg-gray-200"
        indicatorClassName={getProgressColor(usagePercentage, "bg")}
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
