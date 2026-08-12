import { useMemo, useEffect } from "react";
import { useAtomValue } from "jotai";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { currentSpaceAtom } from "@/atoms/spaceAtoms";
import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import {
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
} from "@/atoms/dashboardAtoms";
import { useBrowserOnline } from "@/hooks/useOfflineReadMode";
import { useLocalStorage } from "../useLocalStorage";
import { InsightsQueryParams } from "@/services/insights/fetchers";
import { buildInsightsApiParams } from "@/services/insights/params";
import { buildOfflineInsightsBundle } from "@/services/insights/offline-calculations";
import { buildOfflineNarratives } from "@/services/insights/offline-narratives";
import {
  loadCachedDashboardShell,
  loadCachedMonthlyFinancialSummaries,
} from "@/services/monthly-financial-summaries/local-cache";
import { mergeSummariesPreferNonEmpty } from "@/services/monthly-financial-summaries/hydrate-from-local-transactions";
import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import { countSpaceTransactions } from "@/lib/local-db/transactions";
import { mapApiCategoryTree } from "@/utils/categoryTreeOptions";
import type { CategoryTreeOption } from "@/types/categoryTreeTypes";
import type { IndexTransaction } from "@/types/transactionTypes";

interface UseInsightsQueriesParams extends InsightsQueryParams {}

type InsightsCategoryOptions = {
  expense: CategoryTreeOption[];
  income: CategoryTreeOption[];
};

const readPersistedSpaceCode = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem("spaceCode")?.trim() ?? "";
  } catch {
    return "";
  }
};

const resolveInsightsCategoryOptions = async (
  spaceCode: string,
  categoryOptions: InsightsCategoryOptions,
): Promise<InsightsCategoryOptions> => {
  if (categoryOptions.expense.length > 0 || categoryOptions.income.length > 0) {
    return categoryOptions;
  }

  if (!spaceCode) {
    return categoryOptions;
  }

  const shell = await loadCachedDashboardShell(spaceCode);
  if (!shell) {
    return categoryOptions;
  }

  return {
    expense: mapApiCategoryTree(
      shell.expenseCategoryOptions as Array<Record<string, unknown>>,
    ),
    income: mapApiCategoryTree(
      shell.incomeCategoryOptions as Array<Record<string, unknown>>,
    ),
  };
};

const buildSummariesDigest = (
  summaries: MonthlyFinancialSummary[] | null | undefined,
): string => {
  if (!summaries || summaries.length === 0) {
    return "empty";
  }

  return summaries
    .map((row) =>
      `${row.year}:${row.month}:${row.totalIncome}:${row.totalExpenses}`,
    )
    .join("|");
};

/** Pull list + dashboard RQ rows so tag/category metadata survives Dexie wipes. */
const collectSeedTransactionsFromQueryCaches = (
  queryClient: QueryClient,
  spaceCode: string,
): IndexTransaction[] => {
  const byId = new Map<string, IndexTransaction>();

  const dashboardEntries = queryClient.getQueriesData<{
    transactions?: IndexTransaction[];
  }>({
    predicate: (query) => {
      const key = query.queryKey;
      return (
        Array.isArray(key)
        && key[0] === "dashboard"
        && key[1] === "transactions"
        && key[2] === spaceCode
      );
    },
  });

  for (const [, value] of dashboardEntries) {
    for (const row of value?.transactions ?? []) {
      if (row?.id) {
        byId.set(row.id, row);
      }
    }
  }

  const listEntries = queryClient.getQueriesData<{
    pages?: Array<{ transactions?: IndexTransaction[] }>;
  }>({
    predicate: (query) => {
      const key = query.queryKey;
      if (!Array.isArray(key) || key[0] !== "transactions") {
        return false;
      }
      return key[1] === spaceCode || key[2] === spaceCode;
    },
  });

  for (const [, value] of listEntries) {
    for (const page of value?.pages ?? []) {
      for (const row of page.transactions ?? []) {
        if (!row?.id) {
          continue;
        }

        const existing = byId.get(row.id);
        byId.set(
          row.id,
          existing
            ? ({
                ...existing,
                ...row,
                tags: row.tags?.length ? row.tags : existing.tags,
                tagIds:
                  row.tagIds?.length
                    ? row.tagIds
                    : existing.tagIds ?? existing.tags?.map((tag) => tag.id),
                categoryName: row.categoryName || existing.categoryName,
                categoryId: row.categoryId ?? existing.categoryId,
                subcategoryId: row.subcategoryId ?? existing.subcategoryId,
                subcategoryName:
                  row.subcategoryName ?? existing.subcategoryName,
              } as IndexTransaction)
            : row,
        );
      }
    }
  }

  return Array.from(byId.values());
};

export const useInsightsQueries = (params: UseInsightsQueriesParams = {}) => {
  const queryClient = useQueryClient();
  const [storedSpaceCode] = useLocalStorage("spaceCode", "");
  const currentSpace = useAtomValue(currentSpaceAtom);
  const spaceCode =
    readPersistedSpaceCode()
    || storedSpaceCode
    || currentSpace?.code?.trim()
    || "";
  const isOnline = useBrowserOnline();
  const offlineSyncReady = useAtomValue(offlineSyncReadyAtom);
  const expenseCategoryOptions = useAtomValue(expenseCategoryOptionsAtom);
  const incomeCategoryOptions = useAtomValue(incomeCategoryOptionsAtom);
  const apiParams = useMemo(() => buildInsightsApiParams(params), [params]);
  const isBusiness = currentSpace?.isOrganization ?? false;
  const currency = currentSpace?.currency ?? "PHP";
  const categoryOptions = useMemo(
    () => ({
      expense: expenseCategoryOptions,
      income: incomeCategoryOptions,
    }),
    [expenseCategoryOptions, incomeCategoryOptions],
  );
  const categoryOptionsKey = useMemo(
    () =>
      [
        ...expenseCategoryOptions.map((option) => option.id),
        ...incomeCategoryOptions.map((option) => option.id),
      ].join(","),
    [expenseCategoryOptions, incomeCategoryOptions],
  );

  const insightsQueryEnabled = Boolean(spaceCode);

  const localSummariesQuery = useQuery({
    queryKey: ["monthlyFinancialSummaries", "local", spaceCode],
    queryFn: async () =>
      (await loadCachedMonthlyFinancialSummaries(spaceCode)) ?? [],
    enabled: insightsQueryEnabled,
    staleTime: 0,
    refetchOnMount: true,
  });

  // Observe dashboard's network summaries cache (do not fetch — dashboard owns it).
  const dashboardSummariesQuery = useQuery({
    queryKey: ["monthlyFinancialSummaries", spaceCode],
    queryFn: async () =>
      (await loadCachedMonthlyFinancialSummaries(spaceCode)) ?? [],
    enabled: false,
  });

  // Cheap IndexedDB count only — never load full rows just to bust the cache.
  const localTransactionCountQuery = useQuery({
    queryKey: ["transactions", "insights-count", spaceCode],
    queryFn: async () => countSpaceTransactions(spaceCode),
    enabled: insightsQueryEnabled,
    staleTime: 30_000,
  });

  const resolvedSummaries = useMemo(
    () =>
      mergeSummariesPreferNonEmpty(
        dashboardSummariesQuery.data ?? [],
        localSummariesQuery.data ?? [],
      ),
    [dashboardSummariesQuery.data, localSummariesQuery.data],
  );

  const summariesDigest = useMemo(
    () => buildSummariesDigest(resolvedSummaries),
    [resolvedSummaries],
  );

  const transactionCount = localTransactionCountQuery.data ?? 0;

  useEffect(() => {
    if (!offlineSyncReady || !spaceCode) {
      return;
    }

    queryClient.invalidateQueries({
      queryKey: ["monthlyFinancialSummaries", "local", spaceCode],
    });
    queryClient.invalidateQueries({
      queryKey: ["transactions", "insights-count", spaceCode],
    });
    queryClient.invalidateQueries({
      queryKey: ["insights", "local", spaceCode],
    });
  }, [offlineSyncReady, spaceCode, queryClient]);

  const localInsightsQuery = useQuery({
    queryKey: [
      "insights",
      "local",
      spaceCode,
      apiParams.startDate,
      apiParams.endDate,
      apiParams.categoryName ?? "",
      apiParams.categoryId ?? "",
      apiParams.subcategoryId ?? "",
      JSON.stringify(apiParams.tagIds ?? []),
      categoryOptionsKey,
      isBusiness,
      currency,
      summariesDigest,
      transactionCount,
    ],
    queryFn: async () => {
      const resolvedCategoryOptions = await resolveInsightsCategoryOptions(
        spaceCode,
        categoryOptions,
      );

      const fromCache =
        (await loadCachedMonthlyFinancialSummaries(spaceCode)) ?? [];
      const prefetchedSummaries = mergeSummariesPreferNonEmpty(
        mergeSummariesPreferNonEmpty(
          dashboardSummariesQuery.data ?? [],
          localSummariesQuery.data ?? [],
        ),
        fromCache,
      );

      const seedTransactions = collectSeedTransactionsFromQueryCaches(
        queryClient,
        spaceCode,
      );

      const bundle = await buildOfflineInsightsBundle({
        spaceCode,
        startDate: apiParams.startDate,
        endDate: apiParams.endDate,
        currency,
        categoryName: apiParams.categoryName,
        categoryId: apiParams.categoryId,
        subcategoryId: apiParams.subcategoryId,
        tagIds: apiParams.tagIds,
        categoryOptions: resolvedCategoryOptions,
        prefetchedSummaries,
        seedTransactions,
      });

      let narratives;
      try {
        narratives = await buildOfflineNarratives({
          spaceCode,
          startDate: apiParams.startDate,
          endDate: apiParams.endDate,
          summary: bundle.summary,
          currency,
          isBusiness,
          categoryName: apiParams.categoryName,
          categoryId: apiParams.categoryId,
          subcategoryId: apiParams.subcategoryId,
          tagIds: apiParams.tagIds,
          categoryOptions: resolvedCategoryOptions,
        });
      } catch (error) {
        console.warn("[insights] offline narratives failed", error);
        narratives = {
          headline: { text: "", sentiment: "neutral" as const },
          metrics: [],
          insights: [],
          dataQuality: {
            transactionCount: 0,
            categorizedPercent: "0%",
            completenessTier: "sparse" as const,
          },
        };
      }

      return {
        ...bundle,
        narratives,
      };
    },
    // Do not wait on transaction count — that only busts the cache when Dexie
    // row count changes. Waiting on a full-table load previously froze the UI.
    enabled: insightsQueryEnabled && localSummariesQuery.isFetched,
    staleTime: 30_000,
    refetchOnMount: true,
    retry: isOnline ? 2 : 0,
    placeholderData: (previousData) => previousData,
  });

  const local = localInsightsQuery.data;

  return {
    summary: local?.summary,
    narratives: local?.narratives,
    healthScores: local?.healthScores,
    totalBudget: local?.totalBudget ?? 0,
    monthlyDebt: local?.monthlyDebt ?? 0,
    expenseBreakdown: local?.expenseBreakdown ?? [],
    merchantBreakdown: local?.merchantBreakdown ?? [],
    subcategoryBreakdown: local?.subcategoryBreakdown ?? [],
    monthlySpending: local?.monthlySpending ?? [],
    weeklySpending: local?.weeklySpending ?? [],
    accountBreakdown: undefined,
    isLoading: insightsQueryEnabled && (
      localSummariesQuery.isPending
      || localInsightsQuery.isLoading
    ),
    isError: insightsQueryEnabled && localInsightsQuery.isError,
    isAccountLoading: false,
    isChartsLoading: insightsQueryEnabled && (
      localSummariesQuery.isPending
      || localInsightsQuery.isLoading
    ),
    refetch: () => localInsightsQuery.refetch(),
    queries: {
      local: localInsightsQuery,
    },
  };
};
