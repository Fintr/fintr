import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthApi } from "../useAuthApi";
import { fetchLoansPage } from "@/services/loans/queries";

export const useInfiniteLoans = ({
  loadMoreRef,
}: {
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
    queryKey: ["loans"],
    queryFn: ({ pageParam = 1 }) => fetchLoansPage(api, { pageParam }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: !!api,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    cacheTime: 300000,
  });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
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
  }, [hasNextPage, fetchNextPage, isFetchingNextPage, loadMoreRef]);

  const loans = data?.pages.flatMap((page) => page.loans) || [];

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

