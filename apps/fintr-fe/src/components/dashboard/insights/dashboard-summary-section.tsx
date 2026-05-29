"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import LoadingSpinner from "@/components/ui/loading-spinner";
import {
  SummaryStatTile,
  summaryStatGridClassName,
} from "@/components/dashboard/insights/summary-stat-tile";
import { InsightsSummary } from "@/services/insights/types";

interface DashboardSummarySectionProps {
  summary: InsightsSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  formatAmount: (amount: number) => string;
}

export const DashboardSummarySection = ({
  summary,
  isLoading,
  isError,
  formatAmount,
}: DashboardSummarySectionProps) => {
  return (
    <Card
      className="border-0 shadow-sm"
      data-tutorial-target="dashboard-summary"
    >
      <CardHeader className="px-4 pb-2">
        <CardTitle>Dashboard Summary</CardTitle>
        <CardDescription>
          Overview of your financial performance
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        {isLoading ? (
          <div className="text-center py-8">
            <LoadingSpinner size="medium" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-red-900">
            Error loading insights. Please try again.
          </div>
        ) : (
          <div className={summaryStatGridClassName(3)}>
            <SummaryStatTile
              label="Total Income"
              value={formatAmount(summary?.totalIncome || 0)}
              valueClassName={
                (summary?.totalIncome || 0) >= 0
                  ? "text-teal-600 dark:text-teal-500"
                  : "text-red-900 dark:text-red-700"
              }
            />
            <SummaryStatTile
              label="Total Expenses"
              value={formatAmount(summary?.totalExpenses || 0)}
              valueClassName="text-red-900 dark:text-red-700"
            />
            <SummaryStatTile
              label="Net Savings"
              value={formatAmount(summary?.netSavings || 0)}
              valueClassName={
                (summary?.netSavings || 0) >= 0
                  ? "text-teal-600 dark:text-teal-500"
                  : "text-red-900 dark:text-red-700"
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};
