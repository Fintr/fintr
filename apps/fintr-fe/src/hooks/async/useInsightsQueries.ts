import { useMemo, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { logInsightsDebug } from "@/services/insights/insights-debug";
import { insightsSummaryFromMonthlyBuckets } from "@/services/insights/from-monthly-buckets";
import { resolveMonthlySummariesForInsights } from "@/services/monthly-financial-summaries/local-cache";
import { mapApiCategoryTree } from "@/utils/categoryTreeOptions";
import type { CategoryTreeOption } from "@/types/categoryTreeTypes";
import { loadCachedDashboardShell } from "@/services/monthly-financial-summaries/local-cache";
import type { OfflineInsightsBundle } from "@/services/insights/offline-calculations";

interface UseInsightsQueriesParams extends InsightsQueryParams {}

type InsightsCategoryOptions = {
  expense: CategoryTreeOption[];
  income: CategoryTreeOption[];
};

const EMPTY_NARRATIVES = {
  headline: { text: "", sentiment: "neutral" as const },
  metrics: [],
  insights: [],
  dataQuality: {
    transactionCount: 0,
    categorizedPercent: "0%",
    completenessTier: "sparse" as const,
  },
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

const insightsFiltersAreActive = (apiParams: ReturnType<typeof buildInsightsApiParams>) =>
  Boolean(
    apiParams.categoryId
    || apiParams.subcategoryId
    || apiParams.categoryName
    || (apiParams.tagIds?.length ?? 0) > 0,
  );

/** IndexedDB reads must not wait for network — default RQ mode pauses when offline. */
const INSIGHTS_LOCAL_QUERY_OPTIONS = {
  networkMode: "always" as const,
};

const isLocalInsightsQueryLoading = (
  fetchStatus: string,
  hasData: boolean,
): boolean =>
  !hasData
  && (fetchStatus === "fetching" || fetchStatus === "paused");

const mergeUnfilteredInsightsBundle = (
  bucketSummary:
    | {
        summary: OfflineInsightsBundle["summary"];
      }
    | undefined,
  bucketBundle: OfflineInsightsBundle | undefined,
  transactionBundle: OfflineInsightsBundle | undefined,
): OfflineInsightsBundle | undefined => {
  const enriched = transactionBundle ?? bucketBundle;

  if (!enriched && !bucketSummary) {
    return undefined;
  }

  if (!enriched) {
    return {
      summary: bucketSummary!.summary,
      expenseBreakdown: [],
      merchantBreakdown: [],
      subcategoryBreakdown: [],
      weeklySpending: [],
      monthlySpending: [],
      healthScores: {
        score: 0,
        rating: "—",
        description: "",
        savingsPercentage: { percentage: "0%", score: 0 },
        debtToIncomeRatio: {
          percentage: "0%",
          score: 0,
          monthlyDebt: "0",
        },
        budgetUsage: { percentage: "0%", score: 0 },
      },
      totalBudget: 0,
      monthlyDebt: 0,
    };
  }

  const authoritativeSummary =
    bucketSummary?.summary
    ?? bucketBundle?.summary
    ?? enriched.summary;

  return {
    ...enriched,
    summary: authoritativeSummary,
    healthScores: bucketBundle?.healthScores ?? enriched.healthScores,
    monthlySpending:
      enriched.monthlySpending.length > 0
        ? enriched.monthlySpending
        : (bucketBundle?.monthlySpending ?? []),
  };
};

/**
 * Insights are computed entirely from IndexedDB.
 * React Query only schedules the IndexedDB read + offline calc (and
 * invalidates after sync) — it is not a source of financial data.
 *
 * Unfiltered views load monthly buckets first (fast Net / In / Out), then
 * period transactions for breakdowns. Category/tag filters still need the
 * full transaction history in one pass.
 */
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
  const invalidatedForSyncRef = useRef<string | null>(null);
  const filtersActive = insightsFiltersAreActive(apiParams);

  useEffect(() => {
    logInsightsDebug("hook state", {
      spaceCode,
      insightsQueryEnabled,
      filtersActive,
      startDate: apiParams.startDate,
      endDate: apiParams.endDate,
      categoryName: apiParams.categoryName ?? "",
      tagIds: apiParams.tagIds ?? [],
    });
  }, [
    spaceCode,
    insightsQueryEnabled,
    filtersActive,
    apiParams.startDate,
    apiParams.endDate,
    apiParams.categoryName,
    apiParams.tagIds,
  ]);

  const bundleQueryKey = useMemo(
    () =>
      [
        "insights",
        "local",
        "bundle",
        spaceCode,
        apiParams.startDate,
        apiParams.endDate,
        apiParams.categoryName ?? "",
        apiParams.categoryId ?? "",
        apiParams.subcategoryId ?? "",
        JSON.stringify(apiParams.tagIds ?? []),
        currency,
      ] as const,
    [
      spaceCode,
      apiParams.startDate,
      apiParams.endDate,
      apiParams.categoryName,
      apiParams.categoryId,
      apiParams.subcategoryId,
      apiParams.tagIds,
      currency,
    ],
  );

  const sharedBundleParams = useMemo(
    () => ({
      spaceCode,
      startDate: apiParams.startDate,
      endDate: apiParams.endDate,
      currency,
      categoryName: apiParams.categoryName,
      categoryId: apiParams.categoryId,
      subcategoryId: apiParams.subcategoryId,
      tagIds: apiParams.tagIds,
      categoryOptions,
    }),
    [
      spaceCode,
      apiParams.startDate,
      apiParams.endDate,
      apiParams.categoryName,
      apiParams.categoryId,
      apiParams.subcategoryId,
      apiParams.tagIds,
      currency,
      categoryOptions,
    ],
  );

  useEffect(() => {
    if (!offlineSyncReady) {
      invalidatedForSyncRef.current = null;
      return;
    }

    if (!spaceCode) {
      return;
    }

    const syncKey = spaceCode;
    if (invalidatedForSyncRef.current === syncKey) {
      return;
    }

    invalidatedForSyncRef.current = syncKey;
    queryClient.invalidateQueries({
      queryKey: ["insights", "local", spaceCode],
    });
  }, [offlineSyncReady, spaceCode, queryClient]);

  const bucketSummaryQuery = useQuery({
    queryKey: [...bundleQueryKey, "bucket-summary"] as const,
    queryFn: async () => {
      const started = performance.now();
      logInsightsDebug("bucket-summary:start", {
        spaceCode,
        startDate: apiParams.startDate,
        endDate: apiParams.endDate,
      });

      const resolved = await resolveMonthlySummariesForInsights(spaceCode);
      const summary = insightsSummaryFromMonthlyBuckets(
        resolved.summaries,
        apiParams.startDate,
        apiParams.endDate,
      );

      logInsightsDebug("bucket-summary:done", {
        ms: Math.round(performance.now() - started),
        requestedSpaceCode: spaceCode,
        resolvedSpaceCode: resolved.spaceCode,
        summaryCount: resolved.summaries.length,
        summary,
      });

      return {
        resolvedSpaceCode: resolved.spaceCode,
        summaries: resolved.summaries,
        summary,
      };
    },
    enabled: insightsQueryEnabled && !filtersActive,
    staleTime: 30_000,
    refetchOnMount: true,
    retry: isOnline ? 1 : 0,
    ...INSIGHTS_LOCAL_QUERY_OPTIONS,
  });

  const bucketBundleQuery = useQuery({
    queryKey: [...bundleQueryKey, "buckets"] as const,
    queryFn: async () => {
      const started = performance.now();
      logInsightsDebug("bucket-bundle:start", { spaceCode });

      const bundle = await buildOfflineInsightsBundle({
        spaceCode: bucketSummaryQuery.data?.resolvedSpaceCode || spaceCode,
        startDate: apiParams.startDate,
        endDate: apiParams.endDate,
        currency,
        categoryName: apiParams.categoryName,
        categoryId: apiParams.categoryId,
        subcategoryId: apiParams.subcategoryId,
        tagIds: apiParams.tagIds,
        categoryOptions,
        transactionPhase: "none",
      });

      logInsightsDebug("bucket-bundle:done", {
        ms: Math.round(performance.now() - started),
        summary: bundle.summary,
      });

      return bundle;
    },
    enabled:
      insightsQueryEnabled
      && !filtersActive
      && Boolean(bucketSummaryQuery.data),
    staleTime: 30_000,
    refetchOnMount: true,
    retry: isOnline ? 1 : 0,
    ...INSIGHTS_LOCAL_QUERY_OPTIONS,
  });

  const transactionBundleQuery = useQuery({
    queryKey: [...bundleQueryKey, "transactions"] as const,
    queryFn: async () => {
      const started = performance.now();
      const resolvedSpaceCode =
        bucketSummaryQuery.data?.resolvedSpaceCode
        || spaceCode;

      logInsightsDebug("transactions:start", { resolvedSpaceCode });

      const resolvedCategoryOptions = await resolveInsightsCategoryOptions(
        resolvedSpaceCode,
        categoryOptions,
      );

      const bundle = await buildOfflineInsightsBundle({
        ...sharedBundleParams,
        spaceCode: resolvedSpaceCode,
        categoryOptions: resolvedCategoryOptions,
        transactionPhase: "period",
      });

      logInsightsDebug("transactions:done", {
        ms: Math.round(performance.now() - started),
        summary: bundle.summary,
        expenseBreakdownCount: bundle.expenseBreakdown.length,
      });

      return bundle;
    },
    enabled:
      insightsQueryEnabled
      && !filtersActive
      && Boolean(bucketSummaryQuery.data),
    staleTime: 30_000,
    refetchOnMount: true,
    retry: isOnline ? 1 : 0,
    ...INSIGHTS_LOCAL_QUERY_OPTIONS,
  });

  const filteredBundleQuery = useQuery({
    queryKey: bundleQueryKey,
    queryFn: async () => {
      const resolvedCategoryOptions = await resolveInsightsCategoryOptions(
        spaceCode,
        categoryOptions,
      );

      return buildOfflineInsightsBundle({
        ...sharedBundleParams,
        categoryOptions: resolvedCategoryOptions,
        transactionPhase: "all",
      });
    },
    enabled: insightsQueryEnabled && filtersActive,
    staleTime: 30_000,
    refetchOnMount: true,
    retry: isOnline ? 2 : 0,
    placeholderData: (previousData) => previousData,
    ...INSIGHTS_LOCAL_QUERY_OPTIONS,
  });

  const bucketSummary = bucketSummaryQuery.data;
  const bucketBundle = bucketBundleQuery.data;

  const bundle: OfflineInsightsBundle | undefined = filtersActive
    ? filteredBundleQuery.data
    : mergeUnfilteredInsightsBundle(
        bucketSummary,
        bucketBundle,
        transactionBundleQuery.data,
      );

  const bundleLoading = filtersActive
    ? insightsQueryEnabled
      && isLocalInsightsQueryLoading(
        filteredBundleQuery.fetchStatus,
        Boolean(filteredBundleQuery.data),
      )
    : insightsQueryEnabled
      && isLocalInsightsQueryLoading(
        bucketSummaryQuery.fetchStatus,
        Boolean(bucketSummary),
      );

  useEffect(() => {
    logInsightsDebug("query-status", {
      bundleLoading,
      bucketSummaryStatus: bucketSummaryQuery.status,
      bucketSummaryFetchStatus: bucketSummaryQuery.fetchStatus,
      bucketBundleStatus: bucketBundleQuery.status,
      transactionStatus: transactionBundleQuery.status,
      filteredStatus: filteredBundleQuery.status,
      summary: bundle?.summary,
    });
  }, [
    bundleLoading,
    bucketSummaryQuery.status,
    bucketSummaryQuery.fetchStatus,
    bucketBundleQuery.status,
    transactionBundleQuery.status,
    filteredBundleQuery.status,
    bundle?.summary,
  ]);

  const transactionEnrichmentLoading =
    !filtersActive
    && insightsQueryEnabled
    && Boolean(bucketSummary)
    && isLocalInsightsQueryLoading(
      transactionBundleQuery.fetchStatus,
      Boolean(transactionBundleQuery.data),
    );

  const localNarrativesQuery = useQuery({
    queryKey: [
      "insights",
      "local",
      "narratives",
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
      bucketSummary?.summary.totalIncome ?? 0,
      bucketSummary?.summary.totalExpenses ?? 0,
      bucketSummary?.summary.netSavings ?? 0,
    ],
    queryFn: async () => {
      const resolvedCategoryOptions = await resolveInsightsCategoryOptions(
        spaceCode,
        categoryOptions,
      );
      const summary =
        bucketSummary?.summary
        ?? bundle?.summary;

      if (!summary) {
        return EMPTY_NARRATIVES;
      }

      try {
        return await buildOfflineNarratives({
          spaceCode,
          startDate: apiParams.startDate,
          endDate: apiParams.endDate,
          summary,
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
        return EMPTY_NARRATIVES;
      }
    },
    enabled:
      insightsQueryEnabled
      && Boolean(bucketSummary?.summary ?? bundle?.summary),
    staleTime: 30_000,
    refetchOnMount: true,
    retry: isOnline ? 1 : 0,
    ...INSIGHTS_LOCAL_QUERY_OPTIONS,
  });

  const refetch = async () => {
    if (filtersActive) {
      await Promise.all([
        filteredBundleQuery.refetch(),
        localNarrativesQuery.refetch(),
      ]);
      return;
    }

    await Promise.all([
      bucketSummaryQuery.refetch(),
      bucketBundleQuery.refetch(),
      transactionBundleQuery.refetch(),
      localNarrativesQuery.refetch(),
    ]);
  };

  return {
    summary: bundle?.summary,
    narratives: localNarrativesQuery.data,
    healthScores: bundle?.healthScores,
    totalBudget: bundle?.totalBudget ?? 0,
    monthlyDebt: bundle?.monthlyDebt ?? 0,
    expenseBreakdown: bundle?.expenseBreakdown ?? [],
    merchantBreakdown: bundle?.merchantBreakdown ?? [],
    subcategoryBreakdown: bundle?.subcategoryBreakdown ?? [],
    monthlySpending: bundle?.monthlySpending ?? [],
    weeklySpending: bundle?.weeklySpending ?? [],
    accountBreakdown: undefined,
    isLoading: bundleLoading,
    isNarrativesLoading:
      insightsQueryEnabled
      && isLocalInsightsQueryLoading(
        localNarrativesQuery.fetchStatus,
        localNarrativesQuery.data !== undefined,
      ),
    isError:
      insightsQueryEnabled
      && (filtersActive
        ? filteredBundleQuery.isError
        : bucketSummaryQuery.isError
          || bucketBundleQuery.isError
          || transactionBundleQuery.isError),
    isAccountLoading: false,
    isChartsLoading: bundleLoading || transactionEnrichmentLoading,
    refetch,
    queries: {
      bucketSummary: bucketSummaryQuery,
      bucketBundle: bucketBundleQuery,
      transactionBundle: transactionBundleQuery,
      filteredBundle: filteredBundleQuery,
      narratives: localNarrativesQuery,
    },
  };
};
