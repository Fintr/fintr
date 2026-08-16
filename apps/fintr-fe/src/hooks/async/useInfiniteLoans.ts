import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthApi } from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { fetchLoansPage } from "@/services/loans/queries";
import {
  cacheLoansAllPages,
  loadCachedLoansInfiniteData,
} from "@/services/loans/local-cache";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { shouldFetchNextInfinitePage } from "./shouldFetchNextInfinitePage";
import type { LoansPage } from "@/services/loans/queries";
import type { InfiniteData } from "@tanstack/react-query";

const countLoansInInfiniteData = (
  data: InfiniteData<LoansPage> | undefined,
): number =>
  data?.pages?.reduce((sum, page) => sum + (page?.loans?.length ?? 0), 0) ?? 0;

const reconcileLoansListCaches = async (params: {
  spaceCode: string;
  queryClient: ReturnType<typeof useQueryClient>;
}): Promise<void> => {
  const { spaceCode, queryClient } = params;
  if (!spaceCode) {
    return;
  }

  const networkLoans = queryClient.getQueryData<InfiniteData<LoansPage>>([
    "loans",
  ]);
  const localLoans = queryClient.getQueryData<InfiniteData<LoansPage>>([
    "loans",
    "local",
    spaceCode,
  ]);
  const indexedLoans = await loadCachedLoansInfiniteData(spaceCode);

  const networkCount = countLoansInInfiniteData(networkLoans);
  const localCount = Math.max(
    countLoansInInfiniteData(localLoans),
    countLoansInInfiniteData(indexedLoans),
  );

  if (
    networkCount > 0 &&
    networkCount > localCount &&
    networkLoans?.pages?.length
  ) {
    await cacheLoansAllPages(spaceCode, networkLoans.pages);
    queryClient.setQueryData(["loans", "local", spaceCode], networkLoans);
  }
};

export const useInfiniteLoans = ({
  loadMoreRef,
}: {
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localLoansQuery = useQuery({
    queryKey: ["loans", "local", spaceCode],
    queryFn: async () => (await loadCachedLoansInfiniteData(spaceCode)) ?? null,
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
    networkMode: "always",
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(
    localLoansQuery,
    spaceCode,
  );

  const cachedInfiniteData = localLoansQuery.data ?? undefined;

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
  } = useInfiniteQuery({
    queryKey: ["loans"],
    queryFn: ({ pageParam = 1 }) => fetchLoansPage(api, { pageParam }),
    getNextPageParam: (lastPage) => lastPage?.nextPage ?? undefined,
    initialPageParam: 1,
    enabled: !!api && !skipNetworkFetch,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: !skipNetworkFetch,
    staleTime: skipNetworkFetch ? Infinity : 30000,
    gcTime: 300000,
    placeholderData: cachedInfiniteData?.pages?.length
      ? cachedInfiniteData
      : undefined,
  });

  useEffect(() => {
    void reconcileLoansListCaches({ spaceCode, queryClient });
  }, [spaceCode, queryClient, localLoansQuery.data, data]);

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
        threshold: 0.1,
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
  ]);

  const loansFromLocal =
    cachedInfiniteData?.pages.flatMap((page) => page?.loans ?? []) ?? [];
  const loansFromNetwork =
    data?.pages.flatMap((page) => page?.loans ?? []) ?? [];
  const loans = loansFromLocal.length > 0 ? loansFromLocal : loansFromNetwork;

  const hasLocalLoans = Boolean(cachedInfiniteData?.pages?.length);
  const localReady = skipNetworkFetch && localLoansQuery.isSuccess;

  return {
    loans,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching: skipNetworkFetch ? localLoansQuery.isPending : isFetching,
    isFetchingNextPage,
    status: localReady || hasLocalLoans ? "success" : status,
    isError: isError && loans.length === 0 && !localReady,
    isSuccess: isSuccess || localReady || hasLocalLoans,
    refetch,
  };
};
