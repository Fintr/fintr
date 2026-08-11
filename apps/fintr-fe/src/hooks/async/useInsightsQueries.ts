import { useMemo } from "react";
import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import { currentSpaceAtom } from "@/atoms/spaceAtoms";
import {
  expenseCategoryOptionsAtom,
  incomeCategoryOptionsAtom,
} from "@/atoms/dashboardAtoms";
import { useLocalStorage } from "../useLocalStorage";
import { InsightsQueryParams } from "@/services/insights/fetchers";
import { buildInsightsApiParams } from "@/services/insights/params";
import { buildOfflineInsightsBundle } from "@/services/insights/offline-calculations";
import { buildOfflineNarratives } from "@/services/insights/offline-narratives";

interface UseInsightsQueriesParams extends InsightsQueryParams {}

export const useInsightsQueries = (params: UseInsightsQueriesParams = {}) => {
  const [spaceCode] = useLocalStorage("spaceCode", "");
  const currentSpace = useAtomValue(currentSpaceAtom);
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

  const categoryFilterActive = Boolean(
    apiParams.categoryId
    || apiParams.subcategoryId
    || apiParams.categoryName?.trim(),
  );
  const categoryTreeReady =
    expenseCategoryOptions.length > 0 || incomeCategoryOptions.length > 0;
  const insightsQueryEnabled =
    Boolean(spaceCode)
    && (!categoryFilterActive || categoryTreeReady);

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
    ],
    queryFn: async () => {
      try {
        const bundle = await buildOfflineInsightsBundle({
          spaceCode,
          startDate: apiParams.startDate,
          endDate: apiParams.endDate,
          categoryName: apiParams.categoryName,
          categoryId: apiParams.categoryId,
          subcategoryId: apiParams.subcategoryId,
          tagIds: apiParams.tagIds,
          categoryOptions,
        });
        const narratives = await buildOfflineNarratives({
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
          categoryOptions,
        });

        return {
          ...bundle,
          narratives,
        };
      } catch (error) {
        console.error("[insights] Failed to build offline insights", {
          spaceCode,
          startDate: apiParams.startDate,
          endDate: apiParams.endDate,
          categoryName: apiParams.categoryName,
          categoryId: apiParams.categoryId,
          error,
        });
        throw error;
      }
    },
    enabled: insightsQueryEnabled,
    staleTime: 30_000,
  });

  const local = localInsightsQuery.data;

  return {
    summary: local?.summary,
    narratives: local?.narratives,
    healthScores: local?.healthScores,
    expenseBreakdown: local?.expenseBreakdown ?? [],
    merchantBreakdown: local?.merchantBreakdown ?? [],
    subcategoryBreakdown: local?.subcategoryBreakdown ?? [],
    monthlySpending: local?.monthlySpending ?? [],
    weeklySpending: local?.weeklySpending ?? [],
    accountBreakdown: undefined,
    isLoading:
      (insightsQueryEnabled
        && (localInsightsQuery.isLoading || localInsightsQuery.isPending))
      || (categoryFilterActive && !categoryTreeReady),
    isError: insightsQueryEnabled && localInsightsQuery.isError,
    isAccountLoading: false,
    isChartsLoading:
      localInsightsQuery.isLoading || localInsightsQuery.isPending,
    refetch: () => localInsightsQuery.refetch(),
    queries: {
      local: localInsightsQuery,
    },
  };
};
