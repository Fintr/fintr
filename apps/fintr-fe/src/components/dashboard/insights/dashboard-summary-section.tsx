"use client";

import { ArrowDownLeft, ArrowUpRight, Filter } from "lucide-react";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import { InsightsSummary } from "@/services/insights/types";
import {
  dashboardLedgerHeroClassName,
  dashboardStampChipClassName,
} from "@/components/dashboard/insights/dashboard-insights-surface";

interface DashboardSummarySectionProps {
  summary: InsightsSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  formatAmount: (amount: number) => string;
  dateFilterLabel: string;
  categoryFilterLabel: string;
  tagFilterLabel?: string | null;
  onOpenFilters: () => void;
}

const LedgerColumnSkeleton = () => (
  <div className="space-y-2 animate-pulse px-4 py-5" aria-hidden>
    <div className="h-3 w-12 rounded bg-muted" />
    <div className="h-7 w-28 rounded bg-muted" />
  </div>
);

export const DashboardSummarySection = ({
  summary,
  isLoading,
  isError,
  formatAmount,
  dateFilterLabel,
  categoryFilterLabel,
  tagFilterLabel,
  onOpenFilters,
}: DashboardSummarySectionProps) => {
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const netTotal = summary?.netSavings ?? 0;

  const savingsRateLabel =
    !isLoading && totalIncome > 0
      ? `${((netTotal / totalIncome) * 100).toFixed(0)}% saved`
      : null;

  const netLabel = netTotal < 0 ? "Net Deficit" : "Net Income";

  const netAmountClassName =
    netTotal < 0
      ? "text-red-200"
      : "text-primary-foreground";

  return (
    <div
      className="overflow-hidden"
      data-tutorial-target="dashboard-summary"
    >
      <section
        className={cn("relative", dashboardLedgerHeroClassName)}
        style={{
          paddingTop:
            "max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px))",
        }}
      >
        <div className="relative flex items-start justify-between gap-3 px-4 pb-2 pt-4">
          <button
            type="button"
            onClick={onOpenFilters}
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
            aria-label="Open dashboard filters"
          >
            <span className={dashboardStampChipClassName}>
              {dateFilterLabel}
            </span>
            <span className={dashboardStampChipClassName}>
              {categoryFilterLabel}
            </span>
            {tagFilterLabel ? (
              <span className={dashboardStampChipClassName}>
                {tagFilterLabel}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={onOpenFilters}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground transition-colors hover:bg-primary-foreground/25"
            aria-label="Adjust filters"
          >
            <Filter className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="relative px-4 pb-6 pt-3">
          <div className="border-b border-primary-foreground/20 pb-4">
            <p className="text-sm font-medium text-primary-foreground/80">
              {netLabel}
            </p>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner size="medium" />
              </div>
            ) : isError ? (
              <p className="py-6 text-sm text-primary-foreground/95">
                Error loading insights. Please try again.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                <p
                  className={cn(
                    "text-4xl font-bold tracking-tight tabular-nums",
                    netAmountClassName,
                  )}
                >
                  {formatAmount(netTotal)}
                </p>

                {savingsRateLabel ? (
                  <span className="rounded-md border border-primary-foreground/20 bg-black/20 px-2.5 py-1 text-xs font-medium text-primary-foreground">
                    {savingsRateLabel}
                  </span>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </section>

      {!isError ? (
        <section className="border-b border-border bg-card px-4 py-1">
          <div className="grid grid-cols-2 divide-x divide-border">
            {isLoading ? (
              <>
                <LedgerColumnSkeleton />
                <LedgerColumnSkeleton />
              </>
            ) : (
              <>
                <div className="px-4 py-5">
                  <div className="flex items-center gap-1.5">
                    <ArrowDownLeft
                      className="h-4 w-4 text-teal-700 dark:text-teal-400"
                      aria-hidden
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      In
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-lg font-semibold text-primary dark:text-primary-dark-mode tabular-nums",
                    )}
                  >
                    {totalIncome === 0 ? "—" : formatAmount(totalIncome)}
                  </p>
                </div>

                <div className="px-4 py-5">
                  <div className="flex items-center gap-1.5">
                    <ArrowUpRight
                      className="h-4 w-4 text-red-800 dark:text-red-400"
                      aria-hidden
                    />
                    <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                      Out
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-2 text-lg font-semibold text-primary dark:text-primary-dark-mode tabular-nums",
                    )}
                  >
                    {totalExpenses === 0 ? "—" : formatAmount(totalExpenses)}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
};
