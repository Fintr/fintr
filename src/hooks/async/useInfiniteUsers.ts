import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthApi } from "../useAuthApi";
import { fetchUsersPage, UserData } from "@/services/admin/user/queries";

export const useInfiniteUsers = ({
  loadMoreRef,
  searchQuery = "",
}: {
  loadMoreRef: React.RefObject<HTMLDivElement | null>;
  searchQuery?: string;
}) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:admin",
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
  } = useInfiniteQuery<{
    users: UserData[];
    nextPage: number | undefined;
  },
  Error,
  number,
  string[]>(
    {
      queryKey: ["admin", "users", searchQuery],
      queryFn: ({ pageParam = 1 }) => {
        console.log("[useInfiniteUsers] Query function called with pageParam:", pageParam);
        return fetchUsersPage(api, { page: pageParam, searchQuery });
      },
      getNextPageParam: (lastPage) => {
        console.log("[useInfiniteUsers] getNextPageParam - lastPage:", lastPage, "nextPage:", lastPage.nextPage);
        return lastPage.nextPage;
      },
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30000,
      cacheTime: 300000,
    }
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          console.log("[Observer Bottom] Sentinel intersecting. hasNextPage:", hasNextPage, "isFetchingNextPage:", isFetchingNextPage, "Fetching next page (users)...");
          fetchNextPage();
        } else {
          console.log("[Observer Bottom] Sentinel not intersecting or conditions not met. hasNextPage:", hasNextPage, "isFetchingNextPage:", isFetchingNextPage);
        }
      },
      {
        threshold: 0.1,
      }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
      console.log("[Observer Bottom] Observing bottom sentinel (users):", currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
        console.log("[Observer Bottom] Unobserving bottom sentinel (users).");
      }
      observer.disconnect();
    };
  }, [hasNextPage, fetchNextPage, isFetchingNextPage, loadMoreRef]);

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
