import { fetchDashboardData } from "@/services/spaces/queries";
import {
  cacheDashboardResponse,
  loadCachedDashboardResponse,
} from "@/services/spaces/local-cache";
import { fetchMonthlyFinancialSummaries } from "@/services/monthly-financial-summaries/queries";
import {
  buildDashboardDataFromBuckets,
  cacheDashboardShell,
  cacheMonthlyFinancialSummaries,
  dashboardShellFromDashboard,
  loadCachedDashboardShell,
  loadCachedMonthlyFinancialSummaries,
  type DashboardShell,
} from "@/services/monthly-financial-summaries/local-cache";
import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { useSetAtom } from "jotai";
import {
  accountOptionsAtom,
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
  categoryOptionsAtom,
} from "@/atoms/dashboardAtoms";
import { useCallback, useEffect, useMemo } from "react";
import { mapApiCategoryTree } from "@/utils/categoryTreeOptions";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import type { DashboardData } from "@/types/spaceTypes";

export const useDashboardData = (startDate?: string, endDate?: string) => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const [spaceCode] = useLocalStorage("spaceCode", "");

  const setAccountOptions = useSetAtom(accountOptionsAtom);
  const setExpenseCategoryOptions = useSetAtom(expenseCategoryOptionsAtom);
  const setIncomeCategoryOptions = useSetAtom(incomeCategoryOptionsAtom);
  const setCategoryOptions = useSetAtom(categoryOptionsAtom);

  const { firstDay, lastDay } = getCurrentMonthDates();
  const rangeStart = startDate || firstDay;
  const rangeEnd = endDate || lastDay;

  const localSummariesQuery = useQuery({
    queryKey: ["monthlyFinancialSummaries", "local", spaceCode],
    queryFn: async () =>
      (await loadCachedMonthlyFinancialSummaries(spaceCode)) ?? null,
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
  });

  const localShellQuery = useQuery({
    queryKey: ["dashboard", "shell", "local", spaceCode],
    queryFn: async () => (await loadCachedDashboardShell(spaceCode)) ?? null,
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
  });

  const localCacheQuery = useQuery({
    queryKey: ["dashboard", "local", spaceCode, rangeStart, rangeEnd],
    queryFn: async () =>
      (await loadCachedDashboardResponse(spaceCode, rangeStart, rangeEnd)) ??
      null,
    enabled: Boolean(spaceCode && rangeStart && rangeEnd),
    staleTime: Infinity,
  });

  const skipSummariesNetwork = useSkipCachedNetworkFetch(localSummariesQuery);
  const skipShellNetwork = useSkipCachedNetworkFetch(localShellQuery);

  const summariesQuery = useQuery({
    queryKey: ["monthlyFinancialSummaries", spaceCode],
    queryFn: async () => {
      const summaries = await fetchMonthlyFinancialSummaries(api);
      await cacheMonthlyFinancialSummaries(spaceCode, summaries);
      queryClient.setQueryData(
        ["monthlyFinancialSummaries", "local", spaceCode],
        summaries,
      );
      return summaries;
    },
    enabled: Boolean(spaceCode && isAuthenticated && !skipSummariesNetwork),
    placeholderData: localSummariesQuery.data ?? undefined,
    staleTime: skipSummariesNetwork ? Infinity : 5 * 60 * 1000,
    refetchOnMount: !skipSummariesNetwork,
  });

  const shellQuery = useQuery({
    queryKey: ["dashboard", "shell", spaceCode],
    queryFn: async () => {
      // Shell (categories/accounts/goal) is date-independent; ignore API summary.
      const dashboard = await fetchDashboardData(api);
      const shell = dashboardShellFromDashboard(dashboard);
      await cacheDashboardShell(spaceCode, shell);
      queryClient.setQueryData(
        ["dashboard", "shell", "local", spaceCode],
        shell,
      );
      return shell;
    },
    enabled: Boolean(spaceCode && isAuthenticated && !skipShellNetwork),
    placeholderData: localShellQuery.data ?? undefined,
    staleTime: skipShellNetwork ? Infinity : 5 * 60 * 1000,
    refetchOnMount: !skipShellNetwork,
  });

  const summaries: MonthlyFinancialSummary[] | undefined =
    summariesQuery.data ?? localSummariesQuery.data ?? undefined;
  const shell: DashboardShell | undefined =
    shellQuery.data ?? localShellQuery.data ?? undefined;

  const data = useMemo((): DashboardData | undefined => {
    if (shell && summaries && rangeStart && rangeEnd) {
      return buildDashboardDataFromBuckets(
        shell,
        summaries,
        rangeStart,
        rangeEnd,
      );
    }

    return localCacheQuery.data ?? undefined;
  }, [shell, summaries, rangeStart, rangeEnd, localCacheQuery.data]);

  useEffect(() => {
    if (!data || !spaceCode || !rangeStart || !rangeEnd || !shell || !summaries) {
      return;
    }

    // Persist composed dashboard for offline reads; do not write back into a
    // query that feeds `data` or we can create a render loop.
    void cacheDashboardResponse(spaceCode, data, rangeStart, rangeEnd);
  }, [data, spaceCode, rangeStart, rangeEnd, shell, summaries]);

  useEffect(() => {
    if (data) {
      setAccountOptions(data.accountOptions || []);
      setExpenseCategoryOptions(
        mapApiCategoryTree(
          data.expenseCategoryOptions as Array<Record<string, unknown>>,
        ),
      );
      setIncomeCategoryOptions(
        mapApiCategoryTree(
          data.incomeCategoryOptions as Array<Record<string, unknown>>,
        ),
      );
      setCategoryOptions(data.categoryOptions || []);
    }
  }, [
    data,
    setAccountOptions,
    setExpenseCategoryOptions,
    setIncomeCategoryOptions,
    setCategoryOptions,
  ]);

  const isLoading =
    (summariesQuery.isLoading || shellQuery.isLoading) && !data;
  const isError = (summariesQuery.isError || shellQuery.isError) && !data;

  const refetch = useCallback(async () => {
    await Promise.all([summariesQuery.refetch(), shellQuery.refetch()]);
  }, [summariesQuery.refetch, shellQuery.refetch]);

  return {
    data,
    error: summariesQuery.error ?? shellQuery.error,
    isLoading: isLoading && !localCacheQuery.data,
    isShowingLocalCache:
      Boolean(localCacheQuery.data) &&
      (isLoading || data === localCacheQuery.data),
    isError,
    isSuccess: Boolean(data),
    refetch,
  };
};
