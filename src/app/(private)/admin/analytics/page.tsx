"use client";

import { useEffect, useState } from "react";
import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUserAnalytics, useUserActivityDrilldown } from "@/services/admin/analytics/queries";
import { DailyActiveUsersChart } from "@/components/admin/daily-active-users-chart";
import { AnalyticsSummaryCards } from "@/components/admin/analytics-summary-cards";
import { MonthlyActiveUserOcrSection } from "@/components/admin/monthly-active-user-ocr-section";
import { UserActivityDrilldownTable } from "@/components/admin/user-activity-drilldown-table";

export default function UserAnalyticsPage() {
  const [monthlyOcrPage, setMonthlyOcrPage] = useState(1);
  const {
    data: analyticsData,
    isLoading,
    isFetching,
    isError,
    error,
  } = useUserAnalytics(monthlyOcrPage);

  const [drilldownDate, setDrilldownDate] = useState<string | null>(null);
  const [drilldownPickerOpen, setDrilldownPickerOpen] = useState(false);

  useEffect(() => {
    if (!analyticsData?.data) {
      return;
    }
    setDrilldownDate((prev) => prev ?? analyticsData.data.summary.dateRange.endDate);
  }, [analyticsData]);

  const drilldownQuery = useUserActivityDrilldown(drilldownDate);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>User analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">Error loading analytics: {error?.message}</div>
        </CardContent>
      </Card>
    );
  }

  if (!analyticsData?.data) {
    return null;
  }

  const { summary, dailyActiveUsers, activityBreakdown, monthlyActiveUserOcr, monthlyActiveUserOcrMeta, ocrActiveUserSummary } =
    analyticsData.data;
  const minDate = summary.dateRange.startDate.slice(0, 10);
  const maxDate = summary.dateRange.endDate.slice(0, 10);
  const minDay = parse(minDate, "yyyy-MM-dd", new Date());
  const maxDay = parse(maxDate, "yyyy-MM-dd", new Date());
  const drilldownSelected = drilldownDate
    ? parse(drilldownDate, "yyyy-MM-dd", new Date())
    : undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsSummaryCards summary={summary} activityBreakdown={activityBreakdown} />
        </CardContent>
      </Card>

      <MonthlyActiveUserOcrSection
        monthlyRows={monthlyActiveUserOcr}
        meta={monthlyActiveUserOcrMeta}
        summary={ocrActiveUserSummary}
        onMonthlyOcrPageChange={setMonthlyOcrPage}
        isMonthlyOcrPageLoading={isFetching && !isLoading}
      />

      <DailyActiveUsersChart
        dailyActiveUsers={dailyActiveUsers}
        dateRange={summary.dateRange}
        onSelectDate={(iso) => setDrilldownDate(iso.slice(0, 10))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Active users detail</CardTitle>
          <p className="text-sm text-muted-foreground">
            Pick a calendar day within the summary range. Each row is a user who had API activity that day,
            with transactions, transfers, receipt scans, and AI chat counts for the same day (server time
            zone).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2 max-w-xs">
            <Label htmlFor="drilldown-date">Date</Label>
            <Popover modal open={drilldownPickerOpen} onOpenChange={setDrilldownPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="drilldown-date"
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-left font-normal text-sm"
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {drilldownSelected ? (
                    format(drilldownSelected, "MMM d, yyyy")
                  ) : (
                    <span className="text-muted-foreground">Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={drilldownSelected}
                  onSelect={(date) => {
                    if (date) {
                      setDrilldownDate(format(date, "yyyy-MM-dd"));
                      setDrilldownPickerOpen(false);
                    }
                  }}
                  initialFocus
                  defaultMonth={drilldownSelected ?? maxDay}
                  fromDate={minDay}
                  toDate={maxDay}
                />
              </PopoverContent>
            </Popover>
          </div>

          {drilldownQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : drilldownQuery.isError ? (
            <div className="text-destructive text-sm">
              Error loading drilldown: {drilldownQuery.error?.message}
            </div>
          ) : drilldownQuery.data?.data ? (
            <>
              <p className="text-sm text-muted-foreground">
                Showing {drilldownQuery.data.data.rows.length} of {drilldownQuery.data.data.meta.totalCount} users
                {drilldownQuery.data.data.meta.totalPages > 0
                  ? ` (page ${drilldownQuery.data.data.meta.page} of ${drilldownQuery.data.data.meta.totalPages}).`
                  : "."}
              </p>
              <UserActivityDrilldownTable
                rows={drilldownQuery.data.data.rows}
                averageRow={drilldownQuery.data.data.averageRow}
              />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
