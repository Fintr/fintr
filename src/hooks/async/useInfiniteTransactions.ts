import { fetchTransactionsPage } from "@/services/transactions/queries";
import useAuthApi from "../useAuthApi";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export const useInfiniteTransactions = ({
  appliedCategory,
  queryStartDate,
  queryEndDate,
  appliedMinAmount,
  appliedMaxAmount,
  enabled = null,
  manualOnly = false,
  loadMoreRef,
}: {
  appliedCategory: string;
  queryStartDate: string;
  queryEndDate: string;
  appliedMinAmount: string;
  appliedMaxAmount: string;
  enabled?: boolean | null;
  manualOnly?: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
}) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
    isError,
    isSuccess,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      "transactions",
      localStorage.getItem("spaceCode"),
      appliedCategory,
      queryStartDate,
      queryEndDate,
      appliedMinAmount,
      appliedMaxAmount,
    ],
    queryFn: ({ pageParam = 1, queryKey }) =>
      fetchTransactionsPage(api, { pageParam, queryKey }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: manualOnly
      ? false
      : !!enabled
      ? enabled && !!localStorage.getItem("spaceCode")
      : enabled || !!localStorage.getItem("spaceCode"),
    retry: false,
  });
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          console.log("[Observer Bottom] Fetching next page...");
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
      console.log("[Observer Bottom] Observing bottom sentinel:", currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
        console.log("[Observer Bottom] Unobserving bottom sentinel.");
      }
      observer.disconnect();
    };
  }, [hasNextPage, fetchNextPage, isFetchingNextPage]);

  return {
    data,
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
