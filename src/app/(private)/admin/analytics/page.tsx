"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { useUserAnalytics } from "@/services/admin/analytics/queries";
import { DailyActiveUsersChart } from "@/components/admin/daily-active-users-chart";
import { AnalyticsSummaryCards } from "@/components/admin/analytics-summary-cards";

export default function UserAnalyticsPage() {
  const {
    data: analyticsData,
    isLoading,
    isError,
    error,
  } = useUserAnalytics();

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
          <CardTitle>User Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">Error loading analytics: {error?.message}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>User Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <AnalyticsSummaryCards 
            summary={analyticsData.data.summary}
            activityBreakdown={analyticsData.data.activityBreakdown}
          />
        </CardContent>
      </Card>

      <DailyActiveUsersChart 
        dailyActiveUsers={analyticsData.data.dailyActiveUsers}
        dateRange={analyticsData.data.summary.dateRange}
      />
    </div>
  );
}
