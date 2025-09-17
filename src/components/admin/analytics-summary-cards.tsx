"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, TrendingUp, Activity, Eye } from "lucide-react";

interface AnalyticsSummaryCardsProps {
  summary: {
    totalActiveUsers: number;
    totalApiRequests: number;
    totalLogins: number;
    totalTransactionsCreated: number;
    totalDashboardViews: number;
    averageRequestsPerUser: number;
    totalDays: number;
    averageDailyActiveUsers: number;
    dateRange: {
      startDate: string;
      endDate: string;
    };
  };
  activityBreakdown: {
    logins: number;
    apiRequests: number;
    transactionsCreated: number;
    dashboardViews: number;
  };
}

export const AnalyticsSummaryCards = ({ summary, activityBreakdown }: AnalyticsSummaryCardsProps) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Active Users</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalActiveUsers}</div>
          <p className="text-xs text-muted-foreground">
            Unique users in the period
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">API Requests</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalApiRequests}</div>
          <p className="text-xs text-muted-foreground">
            Total API requests made
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Dashboard Views</CardTitle>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalDashboardViews}</div>
          <p className="text-xs text-muted-foreground">
            Total dashboard page views
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Requests/User</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.averageRequestsPerUser.toFixed(1)}
          </div>
          <p className="text-xs text-muted-foreground">
            Average API requests per user
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Daily Users</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {summary.averageDailyActiveUsers.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground">
            Average users per day
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Analysis Period</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalDays}</div>
          <p className="text-xs text-muted-foreground">
            Days in analysis period
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

