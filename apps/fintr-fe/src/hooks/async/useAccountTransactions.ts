import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { getCurrentMonthDates } from "@/utils/dateUtils";
import { fetchTransactionsPage } from "@/services/transactions/queries";

interface UseAccountTransactionsParams {
  accountName: string;
  /** Inclusive YYYY-MM-DD; defaults to calendar current month when omitted. */
  startDate?: string;
  /** Inclusive YYYY-MM-DD; defaults to calendar current month when omitted. */
  endDate?: string;
  enabled?: boolean;
}

export const useAccountTransactions = ({
  accountName,
  startDate: startDateProp,
  endDate: endDateProp,
  enabled = true,
}: UseAccountTransactionsParams) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");
  const { firstDay: defaultStart, lastDay: defaultEnd } = getCurrentMonthDates();
  const startDate = startDateProp ?? defaultStart;
  const endDate = endDateProp ?? defaultEnd;

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
          undefined,
          undefined,
          "", // searchQuery
          accountName, // accountName filter
        ]
      }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: enabled && !!spaceCode && !!accountName,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    gcTime: 300000,
  });
};
