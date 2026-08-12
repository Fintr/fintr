import { fetchTransactionsPage } from "@/services/transactions/queries";
import {
  buildTransactionsFilterKey,
  cacheTransactionsPage,
  loadCachedTransactionsInfiniteData,
  loadCachedTransactionsPageAt,
  mergeFetchedTransactionsIntoAllTimeCache,
  mergePendingLocalIndexRowsIntoPage,
} from "@/services/transactions/local-cache";
import { buildTransactionsInfiniteQueryKey, resolveTransactionsFilterKeyForQuery } from "@/services/transactions/query-keys";
import useAuthApi from "../useAuthApi";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import type { TransactionsPage } from "@/types/transactionTypes";
import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { useLocalStorage } from "../useLocalStorage";
import { serializeFilterValues } from "@/utils/transactionFilterValues";
import type { TransactionEntryTypeFilter } from "@/utils/transactionEntryTypeFilter";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
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
  const offlineSyncReady = useAtomValue(offlineSyncReadyAtom);

  // After bootstrap, IndexedDB is the source of truth for every filter (including All + All Time).
  const preferLocalIndexReads = skipNetworkFetch || offlineSyncReady;

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
        mode: preferLocalIndexReads ? "local" : "network",
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
      preferLocalIndexReads,
    ],
  );

  const cachedInfiniteData = useMemo((): InfiniteData<TransactionsPage, number> | undefined => {
    // Offline / entry-type reads must come from IndexedDB for the active filter.
    if (preferLocalIndexReads && localCacheQuery.data?.pages?.length) {
      return {
        pages: localCacheQuery.data.pages.slice(0, 1),
        pageParams: [1],
      };
    }

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
  }, [
    infiniteQueryKey,
    localCacheQuery.data,
    queryClient,
    preferLocalIndexReads,
  ]);

  const hasSeededPages = Boolean(cachedInfiniteData?.pages?.length);

  const waitingForLocalCache =
    preferLocalIndexReads &&
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
      const activeFilterKey = resolveTransactionsFilterKeyForQuery(
        queryKey,
        filterKey,
      );

      if (preferLocalIndexReads && spaceCode) {
        const localPage = await loadCachedTransactionsPageAt(
          spaceCode,
          activeFilterKey,
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
            ? await mergePendingLocalIndexRowsIntoPage(
                spaceCode,
                page,
                activeFilterKey,
              )
            : page;
        if (spaceCode) {
          // Every network page upserts into the all-time store so offline insights
          // category filters have full transaction rows, not just page 1.
          void mergeFetchedTransactionsIntoAllTimeCache(spaceCode, [mergedPage]);

          if (pageParam === 1) {
            // Cache must never fail the network query (IndexedDB clone errors, etc.)
            void cacheTransactionsPage(spaceCode, activeFilterKey, mergedPage).then(
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
            activeFilterKey,
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
    refetchOnWindowFocus: !preferLocalIndexReads,
    refetchOnMount: !preferLocalIndexReads,
    staleTime: preferLocalIndexReads ? Infinity : 30000,
    gcTime: 300000,
    initialData: () => cachedInfiniteData,
    placeholderData: cachedInfiniteData,
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
    isLoading:
      (isLoading || isFetching || (preferLocalIndexReads && localCacheQuery.isFetching))
      && !hasCachedPages,
    isShowingLocalCache: Boolean(localCacheQuery.data) && !isSuccess,
  };
};
