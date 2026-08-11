import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { fetchAccountBalanceTimeline } from "@/services/transactions/accountBalanceTimeline";

export const ACCOUNT_BALANCE_TIMELINE_KEY = "accountBalanceTimeline" as const;

type UseAccountBalanceTimelineParams = {
  accountId: string;
  startDate: string;
  endDate: string;
  maxPoints?: number;
  enabled?: boolean;
};

export const useAccountBalanceTimeline = ({
  accountId,
  startDate,
  endDate,
  maxPoints = 60,
  enabled = true,
}: UseAccountBalanceTimelineParams) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  return useQuery({
    queryKey: [
      ACCOUNT_BALANCE_TIMELINE_KEY,
      accountId,
      startDate,
      endDate,
      maxPoints,
    ],
    queryFn: () =>
      fetchAccountBalanceTimeline(api, {
        accountId,
        startDate,
        endDate,
        maxPoints,
      }),
    enabled: enabled && !!accountId,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
  });
};
