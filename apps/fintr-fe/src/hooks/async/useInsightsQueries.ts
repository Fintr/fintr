import { useQueries } from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import {
  fetchInsightsAccountBreakdown,
  fetchInsightsExpenseBreakdown,
  fetchInsightsHealthScores,
  fetchInsightsMonthlySpending,
  fetchInsightsNarratives,
  fetchInsightsSummary,
  fetchInsightsWeeklySpending,
  InsightsQueryParams,
} from "@/services/insights/fetchers";

interface UseInsightsQueriesParams extends InsightsQueryParams {}

export const useInsightsQueries = (params: UseInsightsQueriesParams = {}) => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const enabled = !!spaceCode && isAuthenticated;
  const baseKey = ["insights", spaceCode, params] as const;

  const results = useQueries({
    queries: [
      {
        queryKey: [...baseKey, "summary"],
        queryFn: () => fetchInsightsSummary(api, params),
        enabled,
        staleTime: 30_000,
      },
      {
        queryKey: [...baseKey, "narratives"],
        queryFn: () => fetchInsightsNarratives(api, params),
        enabled,
        staleTime: 30_000,
      },
      {
        queryKey: [...baseKey, "health_scores"],
        queryFn: () => fetchInsightsHealthScores(api, params),
        enabled,
        staleTime: 30_000,
      },
      {
        queryKey: [...baseKey, "expense_breakdown"],
        queryFn: () => fetchInsightsExpenseBreakdown(api, params),
        enabled,
        staleTime: 30_000,
      },
      {
        queryKey: [...baseKey, "monthly_spending"],
        queryFn: () => fetchInsightsMonthlySpending(api, params),
        enabled,
        staleTime: 30_000,
      },
      {
        queryKey: [...baseKey, "weekly_spending"],
        queryFn: () => fetchInsightsWeeklySpending(api, params),
        enabled,
        staleTime: 30_000,
      },
      {
        queryKey: [...baseKey, "account_breakdown"],
        queryFn: () => fetchInsightsAccountBreakdown(api, params),
        enabled,
        staleTime: 30_000,
      },
    ],
  });

  const [
    summaryQuery,
    narrativesQuery,
    healthQuery,
    expenseQuery,
    monthlyQuery,
    weeklyQuery,
    accountQuery,
  ] = results;

  const refetch = () =>
    Promise.all(results.map((result) => result.refetch()));

  const isLoading =
    summaryQuery.isLoading ||
    narrativesQuery.isLoading ||
    healthQuery.isLoading;

  const isError =
    summaryQuery.isError ||
    narrativesQuery.isError ||
    healthQuery.isError;

  return {
    summary: summaryQuery.data,
    narratives: narrativesQuery.data,
    healthScores: healthQuery.data,
    expenseBreakdown: expenseQuery.data ?? [],
    monthlySpending: monthlyQuery.data ?? [],
    weeklySpending: weeklyQuery.data ?? [],
    accountBreakdown: accountQuery.data,
    isLoading,
    isError,
    isAccountLoading: accountQuery.isLoading,
    isChartsLoading:
      expenseQuery.isLoading ||
      monthlyQuery.isLoading ||
      weeklyQuery.isLoading,
    refetch,
    queries: {
      summary: summaryQuery,
      narratives: narrativesQuery,
      health: healthQuery,
      expense: expenseQuery,
      monthly: monthlyQuery,
      weekly: weeklyQuery,
      account: accountQuery,
    },
  };
};
