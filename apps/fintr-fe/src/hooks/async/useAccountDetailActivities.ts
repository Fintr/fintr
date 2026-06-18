import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { fetchAccountActivitiesPage } from "@/services/transactions/accountActivities";

export const ACCOUNT_DETAIL_ACTIVITIES_KEY = "accountDetailActivities" as const;

type UseAccountDetailActivitiesParams = {
  accountId: string;
  startDate: string;
  endDate: string;
  categoryFilter: string;
  searchQuery: string;
  minAmount?: number;
  maxAmount?: number;
  enabled?: boolean;
};

export const useAccountDetailActivities = ({
  accountId,
  startDate,
  endDate,
  categoryFilter,
  minAmount,
  maxAmount,
  searchQuery,
  enabled = true,
}: UseAccountDetailActivitiesParams) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  return useInfiniteQuery({
    queryKey: [
      ACCOUNT_DETAIL_ACTIVITIES_KEY,
      accountId,
      startDate,
      endDate,
      categoryFilter,
      minAmount,
      maxAmount,
      searchQuery,
    ],
    queryFn: ({ pageParam = 1 }) =>
      fetchAccountActivitiesPage(api, {
        accountId,
        startDate,
        endDate,
        categoryFilter,
        searchQuery,
        page: pageParam,
        ...(minAmount !== undefined ? { minAmount } : {}),
        ...(maxAmount !== undefined ? { maxAmount } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: enabled && !!accountId,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 0,
    cacheTime: 300000,
  });
};
