/**
 * @deprecated Use split fetchers from `@/services/insights/fetchers` and `useInsightsQueries`.
 */
export type {
  InsightsSummary,
  FinancialHealthScore,
  ExpenseBreakdown,
  WeeklySpending,
  MonthlySpending,
  AccountBreakdownItem,
  AccountBreakdown,
  InsightMetric,
  InsightCard,
  InsightsNarratives,
  InsightsSections,
} from "./types";

import type {
  AccountBreakdown,
  ExpenseBreakdown,
  FinancialHealthScore,
  InsightsSummary,
  MonthlySpending,
  WeeklySpending,
} from "./types";

export interface InsightsData {
  summary: InsightsSummary;
  healthScores: FinancialHealthScore;
  expenseBreakdown: ExpenseBreakdown[];
  weeklySpending: WeeklySpending[];
  monthlySpending: MonthlySpending[];
  accountBreakdown: AccountBreakdown;
}
