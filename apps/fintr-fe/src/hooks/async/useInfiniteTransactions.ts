import { fetchTransactionsPage } from "@/services/transactions/queries";
import {
  buildTransactionsFilterKey,
  cacheTransactionsPage,
  loadCachedTransactionsInfiniteData,
  loadCachedTransactionsPageAt,
  mergeFetchedTransactionsIntoAllTimeCache,
  mergePendingLocalIndexRowsIntoPage,
} from "@/services/transactions/local-cache";
import { buildTransactionsInfiniteQueryKey } from "@/services/transactions/query-keys";
import useAuthApi from "../useAuthApi";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import type { TransactionsPage } from "@/types/transactionTypes";
import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { useLocalStorage } from "../useLocalStorage";
import { serializeFilterValues } from "@/utils/transactionFilterValues";
import type { TransactionEntryTypeFilter } from "@/utils/transactionEntryTypeFilter";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { shouldFetchNextInfinitePage } from "./shouldFetchNextInfinitePage";

export const useInfiniteTransactions = ({
  appliedCategories,
  queryStartDate,
  queryEndDate,
  appliedMinAmount,
  appliedMaxAmount,
  searchQuery = "",
  appliedAccountNames = [],
  appliedTagIds = [],
  entryType = "all",
  enabled = null,
  manualOnly = false,
  loadMoreRef,
}: {
  appliedCategories: string[];
  queryStartDate: string;
  queryEndDate: string;
  appliedMinAmount: string;
  appliedMaxAmount: string;
  searchQuery?: string;
  appliedAccountNames?: string[];
  appliedTagIds?: string[];
  entryType?: TransactionEntryTypeFilter;
  enabled?: boolean | null;
  manualOnly?: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();
  const offlineSyncReady = useAtomValue(offlineSyncReadyAtom);

  const [spaceCode] = useLocalStorage("spaceCode", "");

  const categoriesSerialized = serializeFilterValues(appliedCategories);
  const accountNamesSerialized = serializeFilterValues(appliedAccountNames);
  const tagIdsSerialized = serializeFilterValues(appliedTagIds);

  const filterKey = useMemo(
    () =>
      buildTransactionsFilterKey({
        categoriesSerialized,
        startDate: queryStartDate,
        endDate: queryEndDate,
        minAmount: appliedMinAmount,
        maxAmount: appliedMaxAmount,
        searchQuery,
        accountNamesSerialized,
        tagIdsSerialized,
        entryType,
      }),
    [
      categoriesSerialized,
      queryStartDate,
      queryEndDate,
      appliedMinAmount,
      appliedMaxAmount,
      searchQuery,
      accountNamesSerialized,
      tagIdsSerialized,
      entryType,
    ],
  );

  const localCacheQueryKey = useMemo(
    () => ["transactions", "local", spaceCode, filterKey] as const,
    [spaceCode, filterKey],
  );

  const localCacheQuery = useQuery({
    queryKey: localCacheQueryKey,
    queryFn: async () =>
      (await loadCachedTransactionsInfiniteData(spaceCode, filterKey)) ?? null,
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
    initialData: () =>
      queryClient.getQueryData(localCacheQueryKey) ?? undefined,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCacheQuery, spaceCode);

  const infiniteQueryKey = useMemo(
    () =>
      buildTransactionsInfiniteQueryKey({
        spaceCode,
        categoriesSerialized,
        startDate: queryStartDate,
        endDate: queryEndDate,
        minAmount: appliedMinAmount,
        maxAmount: appliedMaxAmount,
        searchQuery,
        accountNamesSerialized,
        tagIdsSerialized,
        entryType,
        mode: skipNetworkFetch ? "local" : "network",
      }),
    [
      spaceCode,
      categoriesSerialized,
      queryStartDate,
      queryEndDate,
      appliedMinAmount,
      appliedMaxAmount,
      searchQuery,
      accountNamesSerialized,
      tagIdsSerialized,
      entryType,
      skipNetworkFetch,
    ],
  );

  const cachedInfiniteData = useMemo((): InfiniteData<TransactionsPage, number> | undefined => {
    const seeded = queryClient.getQueryData<InfiniteData<TransactionsPage, number>>(
      infiniteQueryKey,
    );

    if (seeded?.pages?.length) {
      return {
        pages: seeded.pages.slice(0, 1),
        pageParams: [1],
      };
    }

    if (!localCacheQuery.data) {
      return undefined;
    }

    // Only the first page — further pages come from local infinite scroll.
    return {
      pages: localCacheQuery.data.pages.slice(0, 1),
      pageParams: [1],
    };
  }, [infiniteQueryKey, localCacheQuery.data, queryClient]);

  const hasSeededPages = Boolean(cachedInfiniteData?.pages?.length);

  // Only block on local cache when we will actually read from it and have no seed yet.
  const waitingForLocalCache =
    skipNetworkFetch &&
    offlineSyncReady &&
    !hasSeededPages &&
    (localCacheQuery.isPending || localCacheQuery.isFetching);

  const queryEnabled = manualOnly
    ? false
    : (!!enabled
        ? enabled && !!spaceCode && isAuthenticated
        : (enabled || !!spaceCode) && isAuthenticated) &&
      !waitingForLocalCache;

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isFetchNextPageError,
    status,
    isError,
    isSuccess,
    refetch,
    isLoading,
  } = useInfiniteQuery({
    queryKey: infiniteQueryKey,
    queryFn: async ({ pageParam = 1, queryKey }) => {
      if (skipNetworkFetch && spaceCode) {
        const localPage = await loadCachedTransactionsPageAt(
          spaceCode,
          filterKey,
          pageParam,
        );

        if (localPage) {
          return localPage;
        }

        if (pageParam === 1) {
          return {
            transactions: [],
            nextPage: null,
            totalPages: 1,
            totalCount: 0,
            totals: { income: 0, expense: 0, transfer: 0 },
          };
        }

        return {
          transactions: [],
          nextPage: null,
          totalPages: pageParam,
          totalCount: 0,
          totals: null,
        };
      }

      try {
        const page = await fetchTransactionsPage(api, { pageParam, queryKey });
        // Keep optimistic `local:` rows (income/expense/transfer/fees) across remount refetch.
        const mergedPage =
          pageParam === 1 && spaceCode
            ? await mergePendingLocalIndexRowsIntoPage(spaceCode, page, filterKey)
            : page;
        if (spaceCode) {
          // Every network page upserts into the all-time store so offline insights
          // category filters have full transaction rows, not just page 1.
          void mergeFetchedTransactionsIntoAllTimeCache(spaceCode, [mergedPage]);

          if (pageParam === 1) {
            // Cache must never fail the network query (IndexedDB clone errors, etc.)
            void cacheTransactionsPage(spaceCode, filterKey, mergedPage).then(
              () => {
                queryClient.setQueryData(localCacheQueryKey, {
                  pages: [mergedPage],
                  pageParams: [1],
                });
              },
            );
          }
        }
        return mergedPage;
      } catch (fetchError) {
        if (pageParam === 1 && spaceCode) {
          const cached = await loadCachedTransactionsPageAt(
            spaceCode,
            filterKey,
            1,
          );
          if (cached) {
            return cached;
          }
        }
        throw fetchError;
      }
    },
    getNextPageParam: (lastPage) => lastPage?.nextPage ?? undefined,
    initialPageParam: 1,
    enabled: queryEnabled,
    retry: false,
    refetchOnWindowFocus: !skipNetworkFetch,
    refetchOnMount: !skipNetworkFetch,
    staleTime: skipNetworkFetch ? Infinity : 30000,
    gcTime: 300000,
    initialData: () => cachedInfiniteData,
    placeholderData: (previousData) => previousData ?? cachedInfiniteData,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          shouldFetchNextInfinitePage({
            isIntersecting: entries[0].isIntersecting,
            hasNextPage: Boolean(hasNextPage),
            isFetchingNextPage,
            isFetchNextPageError,
          })
        ) {
          fetchNextPage();
        }
      },
      {
        // Prefetch before the sentinel reaches the exact bottom of the viewport.
        rootMargin: "280px 0px",
        threshold: 0,
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      observer.disconnect();
    };
  }, [
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    loadMoreRef,
    data?.pages?.length,
  ]);

  const hasCachedPages = Boolean(data?.pages?.length);

  return {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    isError,
    isSuccess: isSuccess || hasCachedPages,
    refetch,
    isLoading: (isLoading || isFetching) && !hasCachedPages,
    isShowingLocalCache: Boolean(localCacheQuery.data) && !isSuccess,
  };
};
