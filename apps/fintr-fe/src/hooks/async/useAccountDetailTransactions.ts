import { useInfiniteQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { fetchAccountTransactionsPage } from "@/services/transactions/queries";

export const ACCOUNT_DETAIL_TRANSACTIONS_KEY = "accountDetailTransactions" as const;

export const ACCOUNT_ADJUSTMENT_HISTORY_KEY = "accountAdjustmentHistory" as const;

const BALANCE_ADJUSTMENT_SEARCH = "Balance adjustment";

type UseAccountDetailTransactionsParams = {
  accountId?: string;
  accountName: string;
  startDate: string;
  endDate: string;
  categoryFilter: string;
  searchQuery: string;
  minAmount?: number;
  maxAmount?: number;
  enabled?: boolean;
};

export const useAccountDetailTransactions = ({
  accountId,
  accountName,
  startDate,
  endDate,
  categoryFilter,
  minAmount,
  maxAmount,
  searchQuery,
  enabled = true,
}: UseAccountDetailTransactionsParams) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");

  return useInfiniteQuery({
    queryKey: [
      ACCOUNT_DETAIL_TRANSACTIONS_KEY,
      spaceCode,
      accountId,
      accountName,
      startDate,
      endDate,
      categoryFilter,
      minAmount,
      maxAmount,
      searchQuery,
    ],
    queryFn: ({ pageParam = 1 }) =>
      fetchAccountTransactionsPage(api, {
        spaceCode,
        accountId,
        accountName,
        startDate,
        endDate,
        categoryFilter,
        searchQuery,
        page: pageParam,
        ...(minAmount !== undefined ? { minAmount } : {}),
        ...(maxAmount !== undefined ? { maxAmount } : {}),
      }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: enabled && !!spaceCode && !!accountName,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 300000,
  });
};

type UseAccountAdjustmentHistoryParams = {
  accountName: string;
  startDate: string;
  endDate: string;
  enabled?: boolean;
};

export const useAccountAdjustmentHistory = ({
  accountName,
  startDate,
  endDate,
  enabled = true,
}: UseAccountAdjustmentHistoryParams) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");

  return useInfiniteQuery({
    queryKey: [
      ACCOUNT_ADJUSTMENT_HISTORY_KEY,
      spaceCode,
      accountName,
      startDate,
      endDate,
    ],
    queryFn: ({ pageParam = 1 }) =>
      fetchAccountTransactionsPage(api, {
        spaceCode,
        accountName,
        startDate,
        endDate,
        categoryFilter: "",
        searchQuery: BALANCE_ADJUSTMENT_SEARCH,
        page: pageParam,
      }),
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: enabled && !!spaceCode && !!accountName,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 30000,
    gcTime: 300000,
  });
};
