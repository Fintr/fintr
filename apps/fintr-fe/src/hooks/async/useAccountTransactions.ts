import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import { fetchTransactionsPage } from "@/services/transactions/queries";

interface UseAccountTransactionsParams {
  accountName: string;
  enabled?: boolean;
}

export const useAccountTransactions = ({ 
  accountName, 
  enabled = true 
}: UseAccountTransactionsParams) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { firstDay: startDate, lastDay: endDate } = getCurrentMonthDates();

  return useInfiniteQuery({
    queryKey: [
      "accountTransactions",
      spaceCode,
      accountName,
      startDate,
      endDate,
    ],
    queryFn: ({ pageParam = 1 }) =>
      fetchTransactionsPage(api, { 
        pageParam, 
        queryKey: [
          "transactions",
          spaceCode,
          "", // categoryName - empty for all categories
          startDate,
          endDate,
          0, // minAmount
          999999, // maxAmount
          "", // searchQuery
          accountName, // accountName filter
        ]
      }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: enabled && !!spaceCode && !!accountName,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    cacheTime: 300000,
  });
};
