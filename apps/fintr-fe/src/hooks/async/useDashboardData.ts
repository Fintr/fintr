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
import {
  hydrateMonthlyFinancialSummariesFromLocalTransactions,
  mergeSummariesPreferNonEmpty,
  summariesNeedLocalHydration,
} from "@/services/monthly-financial-summaries/hydrate-from-local-transactions";
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
import { useAtomValue } from "jotai";
import { currentSpaceAtom } from "@/atoms/spaceAtoms";
import { mapApiCategoryTree } from "@/utils/categoryTreeOptions";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import type { DashboardData } from "@/types/spaceTypes";
import { filterInsightsTransactions } from "@/services/insights/filter-insights-transactions";
import { buildTransactionTotalsContext } from "@/services/insights/transaction-space-totals";
import { loadTransactionsForInsightsRange } from "@/services/insights/load-local-sources";

export const useDashboardData = (startDate?: string, endDate?: string) => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const [storedSpaceCode] = useLocalStorage("spaceCode", "");
  const currentSpace = useAtomValue(currentSpaceAtom);
  const spaceCode =
    storedSpaceCode
    || (typeof window !== "undefined"
      ? window.localStorage.getItem("spaceCode")?.trim() ?? ""
      : "")
    || currentSpace?.code?.trim()
    || "";
  const spaceCurrency = currentSpace?.currency ?? "PHP";

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

  const localTransactionsQuery = useQuery({
    queryKey: ["dashboard", "transactions", spaceCode, rangeStart, rangeEnd],
    queryFn: async () => {
      const transactions = filterInsightsTransactions(
        await loadTransactionsForInsightsRange(
          spaceCode,
          rangeStart,
          rangeEnd,
        ),
      );
      const totalsContext = await buildTransactionTotalsContext({
        spaceCode,
        spaceCurrency,
        transactions,
      });

      return {
        transactions,
        rateLookup: totalsContext.rateLookup,
      };
    },
    enabled: Boolean(spaceCode && rangeStart && rangeEnd),
    staleTime: Infinity,
  });

  const skipSummariesNetwork = useSkipCachedNetworkFetch(localSummariesQuery);
  const skipShellNetwork = useSkipCachedNetworkFetch(localShellQuery);

  const summariesQuery = useQuery({
    queryKey: ["monthlyFinancialSummaries", spaceCode],
    queryFn: async () => {
      const fetched = await fetchMonthlyFinancialSummaries(api);
      const cached = (await loadCachedMonthlyFinancialSummaries(spaceCode)) ?? [];
      const merged = mergeSummariesPreferNonEmpty(fetched, cached);
      let summaries = merged;

      if (await summariesNeedLocalHydration(spaceCode, merged)) {
        summaries = await hydrateMonthlyFinancialSummariesFromLocalTransactions(
          spaceCode,
          { existingSummaries: merged, currency: spaceCurrency },
        );
      }

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

  const summariesLoaded =
    localSummariesQuery.isSuccess || summariesQuery.isSuccess;
  const summaries: MonthlyFinancialSummary[] =
    summariesQuery.data ?? localSummariesQuery.data ?? [];
  const shell: DashboardShell | undefined =
    shellQuery.data ?? localShellQuery.data ?? undefined;

  useEffect(() => {
    if (!shell) {
      return;
    }

    setAccountOptions(shell.accountOptions || []);
    setExpenseCategoryOptions(
      mapApiCategoryTree(
        shell.expenseCategoryOptions as Array<Record<string, unknown>>,
      ),
    );
    setIncomeCategoryOptions(
      mapApiCategoryTree(
        shell.incomeCategoryOptions as Array<Record<string, unknown>>,
      ),
    );
    setCategoryOptions(shell.categoryOptions || []);
  }, [
    shell,
    setAccountOptions,
    setExpenseCategoryOptions,
    setIncomeCategoryOptions,
    setCategoryOptions,
  ]);

  const data = useMemo((): DashboardData | undefined => {
    if (shell && summariesLoaded && rangeStart && rangeEnd) {
      const transactionBundle = localTransactionsQuery.data;
      const transactions = transactionBundle?.transactions ?? [];
      return buildDashboardDataFromBuckets(
        shell,
        summaries,
        rangeStart,
        rangeEnd,
        {
          transactions,
          spaceCurrency,
          rateLookup: transactionBundle?.rateLookup,
        },
      );
    }

    return localCacheQuery.data ?? undefined;
  }, [
    shell,
    summaries,
    summariesLoaded,
    rangeStart,
    rangeEnd,
    localCacheQuery.data,
    localTransactionsQuery.data,
    spaceCurrency,
  ]);

  useEffect(() => {
    if (!data || !spaceCode || !rangeStart || !rangeEnd || !shell || !summariesLoaded) {
      return;
    }

    // Persist composed dashboard for offline reads; do not write back into a
    // query that feeds `data` or we can create a render loop.
    void cacheDashboardResponse(spaceCode, data, rangeStart, rangeEnd);
  }, [data, spaceCode, rangeStart, rangeEnd, shell, summariesLoaded]);

  const isLoading =
    (
      (localSummariesQuery.isPending && !summariesLoaded)
      || (localShellQuery.isPending && !shell)
      || ((summariesQuery.isLoading || shellQuery.isLoading) && !data)
    );
  const isError = (summariesQuery.isError || shellQuery.isError) && !data;

  const refetch = useCallback(async () => {
    await Promise.all([summariesQuery.refetch(), shellQuery.refetch()]);
  }, [summariesQuery.refetch, shellQuery.refetch]);

  return {
    data,
    summaries,
    periodTransactions: localTransactionsQuery.data?.transactions ?? [],
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
