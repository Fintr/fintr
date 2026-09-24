import { fetchTransactionsPage } from "@/services/transactions/queries";
import {
  buildTransactionsFilterKey,
  cacheTransactionsPage,
  loadAllTypeCachedRowsForFilterKey,
  loadCachedTransactionsInfiniteData,
  loadCachedTransactionsPageAt,
  mergeCacheRowsMissingFromPage,
  mergeFetchedTransactionsIntoAllTimeCache,
  mergePendingLocalIndexRowsIntoPage,
} from "@/services/transactions/local-cache";
import { buildTransactionsInfiniteQueryKey, resolveTransactionsFilterKeyForQuery } from "@/services/transactions/query-keys";
import useAuthApi from "../useAuthApi";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import type { IndexTransaction, TransactionsPage } from "@/types/transactionTypes";
import { useEffect, useMemo } from "react";

import { useLocalStorage } from "../useLocalStorage";
import { serializeFilterValues } from "@/utils/transactionFilterValues";
import type { TransactionEntryTypeFilter } from "@/utils/transactionEntryTypeFilter";
import { usePreferLocalTransactionReads } from "@/hooks/useOfflineReadMode";
import { shouldFetchNextInfinitePage } from "./shouldFetchNextInfinitePage";

const pagesAreLoaded = (
  pages: TransactionsPage[] | undefined,
): boolean => Boolean(pages?.length);

const loadEntryTypeFallbackRows = async (
  spaceId: string,
  filterKey: string,
  entryTypeFilter: TransactionEntryTypeFilter,
): Promise<IndexTransaction[]> => {
  if (entryTypeFilter === "all") {
    return [];
  }

  return loadAllTypeCachedRowsForFilterKey(spaceId, filterKey);
};

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

  const preferLocalIndexReads = usePreferLocalTransactionReads(spaceCode);

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

  const localCacheQuery = useQuery({
    queryKey: localCacheQueryKey,
    queryFn: async () => {
      const fallbackRows = await loadEntryTypeFallbackRows(
        spaceCode,
        filterKey,
        entryType,
      );

      return (
        (await loadCachedTransactionsInfiniteData(spaceCode, filterKey, {
          fallbackRows: fallbackRows.length > 0 ? fallbackRows : undefined,
        })) ?? null
      );
    },
    enabled: Boolean(spaceCode),
    staleTime: 0,
    networkMode: "always",
  });

  const cachedInfiniteData = useMemo((): InfiniteData<TransactionsPage, number> | undefined => {
    if (pagesAreLoaded(localCacheQuery.data?.pages)) {
      return {
        pages: localCacheQuery.data!.pages.slice(0, 1),
        pageParams: [1],
      };
    }

    const seeded = queryClient.getQueryData<InfiniteData<TransactionsPage, number>>(
      infiniteQueryKey,
    );

    if (pagesAreLoaded(seeded?.pages)) {
      return {
        pages: seeded!.pages.slice(0, 1),
        pageParams: [1],
      };
    }

    return undefined;
  }, [
    infiniteQueryKey,
    localCacheQuery.data,
    queryClient,
  ]);

  const queryEnabled = manualOnly
    ? false
    : !!enabled
      ? enabled && !!spaceCode && isAuthenticated
      : (enabled || !!spaceCode) && isAuthenticated;

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
    isPending,
  } = useInfiniteQuery({
    queryKey: infiniteQueryKey,
    queryFn: async ({ pageParam = 1, queryKey }) => {
      const activeFilterKey = resolveTransactionsFilterKeyForQuery(
        queryKey,
        filterKey,
      );

      if (preferLocalIndexReads && spaceCode) {
        const fallbackRows = await loadEntryTypeFallbackRows(
          spaceCode,
          activeFilterKey,
          entryType,
        );

        const localPage = await loadCachedTransactionsPageAt(
          spaceCode,
          activeFilterKey,
          pageParam,
          fallbackRows.length > 0
            ? { fallbackRows }
            : undefined,
        );

        if (localPage) {
          if (pageParam !== 1) {
            return localPage;
          }

          const cached = queryClient.getQueryData<
            InfiniteData<TransactionsPage, number>
          >(queryKey);
          const cachedRows =
            cached?.pages.flatMap((page) => page.transactions ?? []) ?? [];

          return mergeCacheRowsMissingFromPage(
            localPage,
            cachedRows,
            activeFilterKey,
          );
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
        const mergedPage =
          pageParam === 1 && spaceCode
            ? await mergePendingLocalIndexRowsIntoPage(
                spaceCode,
                page,
                activeFilterKey,
              )
            : page;
        if (spaceCode) {
          void mergeFetchedTransactionsIntoAllTimeCache(spaceCode, [mergedPage]);

          if (pageParam === 1) {
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
          const fallbackRows = await loadEntryTypeFallbackRows(
            spaceCode,
            activeFilterKey,
            entryType,
          );
          const cached = await loadCachedTransactionsPageAt(
            spaceCode,
            activeFilterKey,
            1,
            fallbackRows.length > 0
              ? { fallbackRows }
              : undefined,
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
    refetchOnMount: true,
    staleTime: preferLocalIndexReads ? 0 : 30000,
    gcTime: 300000,
    placeholderData: cachedInfiniteData,
    networkMode: "always",
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

  const hasLoadedPages = pagesAreLoaded(data?.pages);

  return {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    isError,
    isSuccess: isSuccess || hasLoadedPages,
    refetch,
    isLoading:
      (
        isLoading
        || isPending
        || isFetching
        || localCacheQuery.isFetching
        || localCacheQuery.isPending
      )
      && !hasLoadedPages,
    isShowingLocalCache: Boolean(localCacheQuery.data) && !isSuccess,
  };
};
