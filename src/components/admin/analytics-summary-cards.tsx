"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, TrendingUp, Activity, Eye, Receipt, MessageSquare, ArrowLeftRight } from "lucide-react";

interface AnalyticsSummaryCardsProps {
  summary: {
    totalActiveUsers: number;
    totalApiRequests: number;
    totalLogins: number;
    totalTransactionsCreated: number;
    totalTransfersCreated: number;
    totalReceiptScans: number;
    totalAiChatUsages: number;
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
    transfersCreated: number;
    receiptScans: number;
    aiChatUsages: number;
    dashboardViews: number;
  };
}

export const AnalyticsSummaryCards = ({ summary, activityBreakdown }: AnalyticsSummaryCardsProps) => {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total active users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalActiveUsers}</div>
            <p className="text-xs text-muted-foreground">Unique users with API activity in the period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalApiRequests}</div>
            <p className="text-xs text-muted-foreground">From user activity counters</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dashboard views</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalDashboardViews}</div>
            <p className="text-xs text-muted-foreground">Tracked dashboard requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg requests / user</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.averageRequestsPerUser.toFixed(1)}</div>
            <p className="text-xs text-muted-foreground">Across active users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg daily users</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.averageDailyActiveUsers.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Mean active users per calendar day</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analysis period</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalDays}</div>
            <p className="text-xs text-muted-foreground">Days in range</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions created</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTransactionsCreated}</div>
            <p className="text-xs text-muted-foreground">Non-draft rows by created_at in period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transfers created</CardTitle>
            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalTransfersCreated}</div>
            <p className="text-xs text-muted-foreground">By created_at in period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receipt scans</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalReceiptScans}</div>
            <p className="text-xs text-muted-foreground">AI usage type OCR / receipt</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI chat usages</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalAiChatUsages}</div>
            <p className="text-xs text-muted-foreground">AI usage records (RAG / chat)</p>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Legacy login counter in breakdown: {activityBreakdown.logins} (not incremented by the app today).
        Period totals also available as: transactions {activityBreakdown.transactionsCreated}, transfers{" "}
        {activityBreakdown.transfersCreated}, receipt scans {activityBreakdown.receiptScans}, AI chat{" "}
        {activityBreakdown.aiChatUsages}.
      </p>
    </div>
  );
};
