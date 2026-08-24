"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { TransactionRowTypeIcon } from "@/components/dashboard/tabs/transactions/transaction-row-type-icon";
import { RecurringScheduleBadge } from "@/components/dashboard/recurring/recurring-schedule-badge";
import { formatCurrency } from "@/lib/utils";
import { buildRecurringSeriesDetailHref } from "@/utils/detailHrefs";
import { pushDashboardDetail } from "@/utils/detailSearchParam";
import {
  formatRelativeDueLabel,
  type RecurringSeriesSummary,
} from "@/utils/recurringSchedule";
import { activityPresentsAsIncome } from "@/utils/activityDisplay";
import { cn } from "@/lib/utils";

type RecurringSeriesRowProps = {
  series: RecurringSeriesSummary;
  spaceCurrency: string;
  showDueLabel?: boolean;
  className?: string;
};

export const RecurringSeriesRow = ({
  series,
  spaceCurrency,
  showDueLabel = true,
  className,
}: RecurringSeriesRowProps) => {
  const router = useRouter();
  const row = series.representative;
  const presentsAsIncome = activityPresentsAsIncome(row);
  const dueLabel =
    series.nextOccurrenceDate
      ? formatRelativeDueLabel(series.nextOccurrenceDate)
      : null;

  return (
    <button
      type="button"
      onClick={() =>
        pushDashboardDetail(
          router,
          buildRecurringSeriesDetailHref(series.rootParentId),
        )
      }
      className={cn(
        "flex w-full items-center gap-3 rounded-lg bg-card p-3 text-left transition-colors hover:bg-accent/50",
        className,
      )}
    >
      <TransactionRowTypeIcon row={row} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-sm text-primary">
              {series.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <RecurringScheduleBadge repeatInterval={series.repeatInterval} />
              {showDueLabel && dueLabel ? (
                <span className="text-xs text-muted-foreground">{dueLabel}</span>
              ) : null}
            </div>
          </div>
          <p
            className={cn(
              "shrink-0 text-sm font-semibold",
              presentsAsIncome
                ? "text-teal-600 dark:text-teal-500"
                : "text-red-900 dark:text-red-700",
            )}
          >
            {formatCurrency(series.amount, series.amountCurrency ?? spaceCurrency)}
          </p>
        </div>
      </div>
    </button>
  );
};
