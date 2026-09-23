"use client";

import React, { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { navigateDashboardClient } from "@/utils/detailSearchParam";
import { Pencil } from "lucide-react";

import { RecurringScheduleBadge } from "@/components/dashboard/recurring/recurring-schedule-badge";
import { TransactionRowTypeIcon } from "@/components/dashboard/tabs/transactions/transaction-row-type-icon";
import EditTransactionDialog, {
  type EditTransactionSuccessOptions,
} from "@/components/dashboard/forms/EditTransactionDialog";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { useRecurringSeries } from "@/hooks/async/useRecurringSeries";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useQueryClient } from "@tanstack/react-query";
import { materializeTransactionSeries } from "@/services/transactions/queries";
import { persistMaterializedSeriesTransactions } from "@/services/transactions/materialize-series-local";
import { formatCurrency, cn } from "@/lib/utils";
import { buildTransactionDetailHref } from "@/utils/detailHrefs";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import { formatLoanTerm } from "@/utils/formatLoanTerm";
import {
  buildUpcomingSeriesDisplayItems,
  buildRecurringSeriesSummaries,
  countSeriesRecordedOccurrences,
  formatRelativeDueLabel,
  repeatIntervalLabel,
  resolveInstallmentOccurrenceDisplay,
} from "@/utils/recurringSchedule";
import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { activityPresentsAsIncome } from "@/utils/activityDisplay";
import { formatTransactionRowDate } from "@/utils/dateUtils";
import { transactionRowTitle } from "@/utils/transactionDescription";

type RecurringSeriesDetailContentProps = {
  seriesId: string;
};

export const RecurringSeriesDetailContent = ({
  seriesId,
}: RecurringSeriesDetailContentProps) => {
  const queryClient = useQueryClient();
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const { summaries, isPending, isError, error, refetch } = useRecurringSeries();
  const [editOpen, setEditOpen] = React.useState(false);
  const materializeAttemptedRef = useRef(false);

  const series = useMemo(
    () => summaries.find((entry) => entry.rootParentId === seriesId),
    [summaries, seriesId],
  );

  const isInstallment =
    series?.scheduleType === ScheduleTypeEnum.INSTALLMENT
    || series?.scheduleType === "installment";

  const upcomingItems = useMemo(
    () =>
      series
        ? buildUpcomingSeriesDisplayItems(
            series,
            undefined,
            isInstallment && (series.installmentPeriod ?? 0) > 0
              ? (series.installmentPeriod ?? 0)
              : 7,
          )
        : [],
    [series, isInstallment],
  );

  const hasProjectedInstallments = upcomingItems.some((item) => item.isProjected);

  useEffect(() => {
    if (
      !api
      || !series
      || !isInstallment
      || !hasProjectedInstallments
      || materializeAttemptedRef.current
    ) {
      return;
    }

    materializeAttemptedRef.current = true;
    void (async () => {
      try {
        const transactions = await materializeTransactionSeries(
          api,
          series.rootParentId,
        ) ?? [];
        // Persist the full series so projected (dashed) payments become
        // real IndexedDB rows the user can open, without waiting for cable.
        if (spaceCode && transactions.length > 0) {
          await persistMaterializedSeriesTransactions({
            spaceId: spaceCode,
            transactions,
            queryClient,
          });
        }
        await refetch();
      } catch {
        materializeAttemptedRef.current = false;
      }
    })();
  }, [
    api,
    hasProjectedInstallments,
    isInstallment,
    queryClient,
    refetch,
    series,
    spaceCode,
  ]);

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner size="medium" />
      </div>
    );
  }

  if (isError || !series) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
        <p className="text-muted-foreground">
          {error?.message ?? "Could not load this recurring series."}
        </p>
        <Button type="button" variant="outline" asChild>
          <Link href="/dashboard/recurring">Back to recurring</Link>
        </Button>
      </div>
    );
  }

  const representative = series.representative;
  const presentsAsIncome = activityPresentsAsIncome(representative);
  const repeatInterval = series.repeatInterval;
  const installmentPeriod = series.installmentPeriod ?? null;
  const title = transactionRowTitle({
    description: representative.description,
    fallback: representative.categoryName,
  });
  const recordedOccurrenceCount = countSeriesRecordedOccurrences(
    series.occurrences,
  );
  const pastOccurrences = series.occurrences
    .filter((row) => row.date < new Date().toISOString().slice(0, 10))
    .sort((left, right) => right.date.localeCompare(left.date));

  const handleEditSuccess = async (options?: EditTransactionSuccessOptions) => {
    setEditOpen(false);

    if (!options?.deleted) {
      // Local-first already wrote IndexedDB; force a fresh series summary so
      // totals and occurrence amounts update immediately on this page.
      await refetch();
      return;
    }

    if (options.deleteScope === DeleteScopeEnum.ALL_IN_SERIES) {
      navigateDashboardClient("/dashboard/recurring");
      return;
    }

    const result = await refetch();
    const stillExists = buildRecurringSeriesSummaries(result.data ?? []).some(
      (entry) => entry.rootParentId === seriesId,
    );

    if (!stillExists) {
      navigateDashboardClient("/dashboard/recurring");
    }
  };

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-muted-foreground">
              {isInstallment ? "Installment" : "Recurring series"}
            </p>
            <h1 className="truncate text-2xl font-bold text-primary">{title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <RecurringScheduleBadge
                repeatInterval={repeatInterval}
                size="md"
              />
              {series.nextOccurrenceDate ? (
                <span className="text-sm text-muted-foreground">
                  Next: {formatRelativeDueLabel(series.nextOccurrenceDate)}
                </span>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="mr-2 h-4 w-4" aria-hidden />
            {isInstallment ? "Edit installment" : "Edit rule"}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <TransactionRowTypeIcon row={representative} />
          <p
            className={cn(
              "text-3xl font-semibold",
              presentsAsIncome
                ? "text-teal-600 dark:text-teal-500"
                : "text-red-900 dark:text-red-700",
            )}
          >
            {formatCurrency(
              series.amount,
              series.amountCurrency ?? spaceCurrency,
            )}
          </p>
        </div>

        <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-muted-foreground">
              {isInstallment ? "Term" : "Repeats"}
            </span>
            <span className="text-sm font-medium text-foreground">
              {isInstallment && installmentPeriod
                ? `${formatLoanTerm(installmentPeriod)} · Monthly`
                : repeatIntervalLabel(repeatInterval)}
            </span>
          </div>
          {isInstallment && installmentPeriod ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-sm font-medium text-foreground">
                {formatCurrency(
                  series.installmentTotal ?? series.amount * installmentPeriod,
                  series.amountCurrency ?? spaceCurrency,
                )}
              </span>
            </div>
          ) : null}
          {isInstallment && installmentPeriod ? (
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-muted-foreground">Payments</span>
              <span className="text-sm font-medium text-foreground">
                {installmentPeriod}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-muted-foreground">Recorded</span>
            <span className="text-sm font-medium text-foreground">
              {recordedOccurrenceCount}
            </span>
          </div>
        </dl>

        {upcomingItems.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-primary">
              {isInstallment ? "Upcoming" : "Next"}
            </h2>
            <div className="space-y-2">
              {upcomingItems.map((item) => {
                const display = resolveInstallmentOccurrenceDisplay(
                  item.row,
                  series,
                  spaceCurrency,
                );
                const content = (
                  <>
                    <span>{formatTransactionRowDate(item.date)}</span>
                    <span className="font-medium">
                      {formatCurrency(display.amount, display.currency)}
                    </span>
                  </>
                );

                if (item.row && !item.isProjected) {
                  return (
                    <Link
                      key={item.date}
                      href={buildTransactionDetailHref(item.row.id)}
                      className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-accent/50"
                    >
                      {content}
                    </Link>
                  );
                }

                return (
                  <div
                    key={item.date}
                    className="flex items-center justify-between rounded-lg border border-dashed border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground"
                  >
                    {content}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {pastOccurrences.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-primary">Past</h2>
            <div className="space-y-2">
              {pastOccurrences.slice(0, 8).map((row) => {
                const display = resolveInstallmentOccurrenceDisplay(
                  row,
                  series,
                  spaceCurrency,
                );

                return (
                <Link
                  key={row.id}
                  href={buildTransactionDetailHref(row.id)}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-accent/50"
                >
                  <span>{formatTransactionRowDate(row.date)}</span>
                  <span className="font-medium">
                    {formatCurrency(display.amount, display.currency)}
                  </span>
                </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <EditTransactionDialog
        transaction={representative}
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        onSuccess={handleEditSuccess}
      />
    </>
  );
};
