import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import {
  buildAccountActivitiesLocalQueryKey,
  loadCachedAccountDetailTransactionsPage,
} from "@/services/transactions/account-activities-local";
import { fetchAccountTransactionsPage } from "@/services/transactions/queries";
import { parseCategoryPickerValue } from "@/types/categoryTreeTypes";

export const ACCOUNT_DETAIL_TRANSACTIONS_KEY = "accountDetailTransactions" as const;

export const ACCOUNT_ADJUSTMENT_HISTORY_KEY = "accountAdjustmentHistory" as const;

const BALANCE_ADJUSTMENT_SEARCH = "Balance adjustment";

type UseAccountDetailTransactionsParams = {
  accountId?: string;
  accountName: string;
  startDate: string;
  endDate: string;
  categoryFilter: string;
  searchQuery: string;
  minAmount?: number;
  maxAmount?: number;
  enabled?: boolean;
};

const buildLocalCacheKey = (
  spaceCode: string,
  accountId: string | undefined,
  accountName: string,
  params: Omit<UseAccountDetailTransactionsParams, "enabled" | "accountId">,
): string[] => [
  "accountDetailTransactionsLocal",
  spaceCode,
  accountId ?? "",
  accountName,
  params.startDate,
  params.endDate,
  params.categoryFilter,
  params.searchQuery,
  String(params.minAmount ?? ""),
  String(params.maxAmount ?? ""),
];

export const useAccountDetailTransactions = ({
  accountId,
  accountName,
  startDate,
  endDate,
  categoryFilter,
  minAmount,
  maxAmount,
  searchQuery,
  enabled = true,
}: UseAccountDetailTransactionsParams) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localParams = {
    startDate,
    endDate,
    categoryFilter,
    searchQuery,
    ...(minAmount !== undefined ? { minAmount } : {}),
    ...(maxAmount !== undefined ? { maxAmount } : {}),
  };

  const localCacheQueryKey = buildLocalCacheKey(
    spaceCode,
    accountId,
    accountName,
    localParams,
  );

  const localCacheQuery = useQuery({
    queryKey: localCacheQueryKey,
    queryFn: async () => {
      const firstPage = await loadCachedAccountDetailTransactionsPage(
        spaceCode,
        accountName,
        { ...localParams, page: 1 },
      );

      return firstPage ?? null;
    },
    enabled: Boolean(spaceCode && accountName),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCacheQuery);

  return useInfiniteQuery({
    queryKey: [
      ACCOUNT_DETAIL_TRANSACTIONS_KEY,
      spaceCode,
      accountId,
      accountName,
      startDate,
      endDate,
      categoryFilter,
      minAmount,
      maxAmount,
      searchQuery,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      const pageParams = {
        spaceCode,
        accountId,
        accountName,
        startDate,
        endDate,
        categoryFilter,
        searchQuery,
        page: pageParam,
        ...(minAmount !== undefined ? { minAmount } : {}),
        ...(maxAmount !== undefined ? { maxAmount } : {}),
      };

      if (skipNetworkFetch) {
        const cached = await loadCachedAccountDetailTransactionsPage(
          spaceCode,
          accountName,
          {
            startDate,
            endDate,
            categoryFilter,
            searchQuery,
            page: pageParam,
            ...(minAmount !== undefined ? { minAmount } : {}),
            ...(maxAmount !== undefined ? { maxAmount } : {}),
          },
        );

        if (cached != null) {
          return cached;
        }

        throw new Error("No cached account transactions");
      }

      try {
        return await fetchAccountTransactionsPage(api, pageParams);
      } catch (error) {
        const cached = await loadCachedAccountDetailTransactionsPage(
          spaceCode,
          accountName,
          {
            startDate,
            endDate,
            categoryFilter,
            searchQuery,
            page: pageParam,
            ...(minAmount !== undefined ? { minAmount } : {}),
            ...(maxAmount !== undefined ? { maxAmount } : {}),
          },
        );

        if (cached != null) {
          return cached;
        }

        throw error;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled:
      enabled &&
      !!spaceCode &&
      !!accountName &&
      (!skipNetworkFetch || Boolean(localCacheQuery.data)),
    retry: false,
    refetchOnMount: !skipNetworkFetch,
    refetchOnWindowFocus: false,
    staleTime: skipNetworkFetch ? Infinity : 0,
    gcTime: 300000,
    placeholderData: localCacheQuery.data
      ? { pages: [localCacheQuery.data], pageParams: [1] }
      : undefined,
  });
};

type UseAccountAdjustmentHistoryParams = {
  accountName: string;
  startDate: string;
  endDate: string;
  enabled?: boolean;
};

export const useAccountAdjustmentHistory = ({
  accountName,
  startDate,
  endDate,
  enabled = true,
}: UseAccountAdjustmentHistoryParams) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localCacheQuery = useQuery({
    queryKey: [
      "accountAdjustmentHistoryLocal",
      spaceCode,
      accountName,
      startDate,
      endDate,
    ],
    queryFn: async () => {
      const firstPage = await loadCachedAccountDetailTransactionsPage(
        spaceCode,
        accountName,
        {
          startDate,
          endDate,
          categoryFilter: "",
          searchQuery: BALANCE_ADJUSTMENT_SEARCH,
          page: 1,
        },
      );

      return firstPage ?? null;
    },
    enabled: Boolean(spaceCode && accountName),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCacheQuery);

  return useInfiniteQuery({
    queryKey: [
      ACCOUNT_ADJUSTMENT_HISTORY_KEY,
      spaceCode,
      accountName,
      startDate,
      endDate,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      const localPageParams = {
        startDate,
        endDate,
        categoryFilter: "",
        searchQuery: BALANCE_ADJUSTMENT_SEARCH,
        page: pageParam,
      };

      if (skipNetworkFetch) {
        const cached = await loadCachedAccountDetailTransactionsPage(
          spaceCode,
          accountName,
          localPageParams,
        );

        if (cached != null) {
          return cached;
        }

        throw new Error("No cached balance adjustments");
      }

      try {
        return await fetchAccountTransactionsPage(api, {
          spaceCode,
          accountName,
          startDate,
          endDate,
          categoryFilter: "",
          searchQuery: BALANCE_ADJUSTMENT_SEARCH,
          page: pageParam,
        });
      } catch (error) {
        const cached = await loadCachedAccountDetailTransactionsPage(
          spaceCode,
          accountName,
          localPageParams,
        );

        if (cached != null) {
          return cached;
        }

        throw error;
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 1,
    enabled:
      enabled &&
      !!spaceCode &&
      !!accountName &&
      (!skipNetworkFetch || Boolean(localCacheQuery.data)),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: skipNetworkFetch ? Infinity : 30_000,
    gcTime: 300000,
    placeholderData: localCacheQuery.data
      ? { pages: [localCacheQuery.data], pageParams: [1] }
      : undefined,
  });
};
