import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthApi } from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { fetchLoansPage } from "@/services/loans/queries";
import { loadCachedLoansInfiniteData } from "@/services/loans/local-cache";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { shouldFetchNextInfinitePage } from "./shouldFetchNextInfinitePage";

export const useInfiniteLoans = ({
  loadMoreRef,
}: {
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localLoansQuery = useQuery({
    queryKey: ["loans", "local", spaceCode],
    queryFn: async () => (await loadCachedLoansInfiniteData(spaceCode)) ?? null,
    enabled: Boolean(spaceCode),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localLoansQuery);

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

  const loans = data?.pages.flatMap((page) => page?.loans ?? []) || [];

  return {
    loans,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    isError,
    isSuccess,
    refetch,
  };
};
