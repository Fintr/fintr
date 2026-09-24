"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";

import { RecurringSeriesRow } from "@/components/dashboard/recurring/recurring-series-row";
import { RecurringUpcomingCalendar } from "@/components/dashboard/recurring/recurring-upcoming-calendar";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { FilterOptionPills } from "@/components/ui/filter-option-pills";
import { useRecurringSeries } from "@/hooks/async/useRecurringSeries";
import { useSpaceContext } from "@/hooks/useSpaceContext";
import { useAuthApi } from "@/hooks/useAuthApi";
import {
  buildUpcomingCalendarDays,
  groupRecurringSeriesByFrequency,
} from "@/utils/recurringSchedule";

type RecurringViewMode = "upcoming" | "all";

const RecurringTab = () => {
  const [viewMode, setViewMode] = useState<RecurringViewMode>("upcoming");
  const { api } = useAuthApi();
  const { currentSpace } = useSpaceContext(api);
  const spaceCurrency = currentSpace?.currency ?? "PHP";
  const {
    summaries,
    upcoming,
    active,
    inactive,
    isPending,
    isError,
    error,
  } = useRecurringSeries();

  const calendarDays = useMemo(
    () => buildUpcomingCalendarDays(summaries),
    [summaries],
  );

  const frequencySections = useMemo(
    () => groupRecurringSeriesByFrequency(active),
    [active],
  );

  const comingLater = useMemo(() => {
    const upcomingIds = new Set(upcoming.map((series) => series.rootParentId));
    return active.filter((series) => !upcomingIds.has(series.rootParentId));
  }, [active, upcoming]);

  return (
    <div className="space-y-6 px-2 md:px-0">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold text-primary">Recurring</h2>
          <p className="text-sm text-muted-foreground">
            Manage subscriptions, bills, and repeating income without cluttering
            your transaction list.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/dashboard/">View transaction ledger</Link>
        </Button>
      </div>

      <FilterOptionPills
        ariaLabel="Recurring view"
        value={viewMode}
        onChange={(value) => setViewMode(value as RecurringViewMode)}
        options={[
          { value: "upcoming", label: "Upcoming" },
          { value: "all", label: "All rules" },
        ]}
      />

      {isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error?.message ?? "Failed to load recurring transactions."}
        </div>
      ) : null}

      {isPending ? (
        <div className="space-y-6">
          <RecurringUpcomingCalendar days={calendarDays} />
          <div className="flex justify-center py-16">
            <LoadingSpinner size="medium" />
          </div>
        </div>
      ) : null}

      {!isPending && !isError && summaries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No recurring transactions yet. Create one from Add Transaction and
            choose Recurring.
          </p>
        </div>
      ) : null}

      {!isPending && !isError && summaries.length > 0 && viewMode === "upcoming" ? (
        <div className="space-y-6">
          <RecurringUpcomingCalendar days={calendarDays} />

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-primary">Coming up</h3>
              <p className="text-xs text-muted-foreground">
                Charges due in the next 7 days.
              </p>
            </div>
            {upcoming.length === 0 ? (
              <p className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                You do not have any recurring charges within the next 7 days.
              </p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((series) => (
                  <RecurringSeriesRow
                    key={series.rootParentId}
                    series={series}
                    spaceCurrency={spaceCurrency}
                  />
                ))}
              </div>
            )}
          </section>

          {comingLater.length > 0 ? (
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-primary">
                  Coming later
                </h3>
                <p className="text-xs text-muted-foreground">
                  Scheduled beyond this week.
                </p>
              </div>
              <div className="space-y-2">
                {comingLater.map((series) => (
                  <RecurringSeriesRow
                    key={series.rootParentId}
                    series={series}
                    spaceCurrency={spaceCurrency}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}

      {!isPending && !isError && summaries.length > 0 && viewMode === "all" ? (
        <div className="space-y-6">
          {frequencySections.map((section) => (
            <section key={section.key} className="space-y-3">
              <h3 className="text-sm font-semibold text-primary">
                {section.label}
              </h3>
              <div className="space-y-2">
                {section.items.map((series) => (
                  <RecurringSeriesRow
                    key={series.rootParentId}
                    series={series}
                    spaceCurrency={spaceCurrency}
                  />
                ))}
              </div>
            </section>
          ))}

          {inactive.length > 0 ? (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Inactive
              </h3>
              <div className="space-y-2">
                {inactive.map((series) => (
                  <RecurringSeriesRow
                    key={series.rootParentId}
                    series={series}
                    spaceCurrency={spaceCurrency}
                    showDueLabel={false}
                    className="opacity-70"
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default RecurringTab;
