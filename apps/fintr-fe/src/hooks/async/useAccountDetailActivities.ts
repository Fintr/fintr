import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import {
  buildAccountActivitiesLocalQueryKey,
  loadCachedAccountActivitiesInfiniteData,
  loadCachedAccountActivitiesPage,
} from "@/services/transactions/account-activities-local";
import { fetchAccountActivitiesPage } from "@/services/transactions/accountActivities";

export const ACCOUNT_DETAIL_ACTIVITIES_KEY = "accountDetailActivities" as const;

type UseAccountDetailActivitiesParams = {
  accountId: string;
  accountName: string;
  startDate: string;
  endDate: string;
  categoryFilters: string[];
  searchQuery: string;
  minAmount?: number;
  maxAmount?: number;
  enabled?: boolean;
};

export const useAccountDetailActivities = ({
  accountId,
  accountName,
  startDate,
  endDate,
  categoryFilters,
  minAmount,
  maxAmount,
  searchQuery,
  enabled = true,
}: UseAccountDetailActivitiesParams) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localParams = {
    accountId,
    startDate,
    endDate,
    categoryFilters,
    searchQuery,
    ...(minAmount !== undefined ? { minAmount } : {}),
    ...(maxAmount !== undefined ? { maxAmount } : {}),
  };

  const localCacheQueryKey = buildAccountActivitiesLocalQueryKey(
    spaceCode,
    accountId,
    accountName,
    localParams,
  );

  const localCacheQuery = useQuery({
    queryKey: localCacheQueryKey,
    queryFn: async () =>
      (await loadCachedAccountActivitiesInfiniteData(
        spaceCode,
        accountName,
        localParams,
      )) ?? null,
    enabled: Boolean(spaceCode && accountId && accountName),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCacheQuery);

  return useInfiniteQuery({
    queryKey: [
      ACCOUNT_DETAIL_ACTIVITIES_KEY,
      spaceCode,
      accountId,
      startDate,
      endDate,
      categoryFilters,
      minAmount,
      maxAmount,
      searchQuery,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      const pageParams = {
        accountId,
        startDate,
        endDate,
        categoryFilters,
        searchQuery,
        page: pageParam,
        ...(minAmount !== undefined ? { minAmount } : {}),
        ...(maxAmount !== undefined ? { maxAmount } : {}),
      };

      if (skipNetworkFetch) {
        const cached = await loadCachedAccountActivitiesPage(
          spaceCode,
          accountName,
          pageParams,
        );

        if (cached != null) {
          return cached;
        }

        throw new Error("No cached account activities");
      }

      try {
        return await fetchAccountActivitiesPage(api, pageParams);
      } catch (error) {
        if (spaceCode && accountName) {
          const cached = await loadCachedAccountActivitiesPage(
            spaceCode,
            accountName,
            pageParams,
          );

          if (cached != null) {
            return cached;
          }
        }

        throw error;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled:
      enabled &&
      !!accountId &&
      !!accountName &&
      !!spaceCode &&
      (!skipNetworkFetch || Boolean(localCacheQuery.data)),
    retry: false,
    refetchOnMount: !skipNetworkFetch,
    refetchOnWindowFocus: false,
    staleTime: skipNetworkFetch ? Infinity : 0,
    gcTime: 300000,
    placeholderData: localCacheQuery.data ?? undefined,
  });
};
