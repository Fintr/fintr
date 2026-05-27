import { AxiosInstance } from "axios";
import { buildInsightsApiParams, fetchInsightSection, InsightsQueryParams } from "./params";
import {
  transformAccountBreakdown,
  transformExpenseBreakdown,
  transformHealthScores,
  transformMonthlySpending,
  transformNarratives,
  transformSummary,
  aggregateWeeklySpending,
} from "./transforms";
import type {
  AccountBreakdown,
  ExpenseBreakdown,
  FinancialHealthScore,
  InsightsNarratives,
  InsightsSummary,
  MonthlySpending,
  WeeklySpending,
} from "./types";

export const fetchInsightsSummary = async (
  api: AxiosInstance,
  params?: InsightsQueryParams,
): Promise<InsightsSummary> => {
  const data = await fetchInsightSection<{
    totalIncome: string;
    totalExpenses: string;
    netSavings: string;
  }>(api, "summary", params);
  return transformSummary(data);
};

export const fetchInsightsNarratives = async (
  api: AxiosInstance,
  params?: InsightsQueryParams,
): Promise<InsightsNarratives> => {
  const data = await fetchInsightSection(api, "narratives", params);
  return transformNarratives(data);
};

export const fetchInsightsHealthScores = async (
  api: AxiosInstance,
  params?: InsightsQueryParams,
): Promise<FinancialHealthScore> => {
  const data = await fetchInsightSection(api, "health_scores", params);
  return transformHealthScores(data);
};

export const fetchInsightsExpenseBreakdown = async (
  api: AxiosInstance,
  params?: InsightsQueryParams,
): Promise<ExpenseBreakdown[]> => {
  const data = await fetchInsightSection<
    Array<{ categoryName: string; amount: string; percentage: string }>
  >(api, "expense_breakdown", params);
  return transformExpenseBreakdown(data);
};

export const fetchInsightsWeeklySpending = async (
  api: AxiosInstance,
  params?: InsightsQueryParams,
): Promise<WeeklySpending[]> => {
  const data = await fetchInsightSection<
    Array<{ date: string; amount: string }>
  >(api, "weekly_spending", params);
  return aggregateWeeklySpending(data);
};

export const fetchInsightsMonthlySpending = async (
  api: AxiosInstance,
  params?: InsightsQueryParams,
): Promise<MonthlySpending[]> => {
  const data = await fetchInsightSection<
    Array<{
      month_year: string;
      total_income: number;
      total_expense: number;
      net_amount: number;
    }>
  >(api, "monthly_spending", params);
  return transformMonthlySpending(data);
};

export const fetchInsightsAccountBreakdown = async (
  api: AxiosInstance,
  _params?: InsightsQueryParams,
): Promise<AccountBreakdown> => {
  const apiParams = buildInsightsApiParams(_params);
  const response = await api.get("/insights/account_breakdown", {
    params: apiParams,
  });
  return transformAccountBreakdown(response?.data?.data);
};

export type { InsightsQueryParams };
