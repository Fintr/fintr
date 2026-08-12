import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";
import { loadCachedAccountsResponse } from "@/services/transactions/accounts/local-cache";
import {
  buildAccountBalanceTimelineFromCache,
} from "@/services/transactions/account-balance-timeline-local";
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
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localCacheQuery = useQuery({
    queryKey: [
      ACCOUNT_BALANCE_TIMELINE_KEY,
      "local",
      spaceCode,
      accountId,
      startDate,
      endDate,
      maxPoints,
    ],
    queryFn: async () => {
      const accountsResponse = await loadCachedAccountsResponse(spaceCode);

      if (!accountsResponse) {
        return null;
      }

      return (
        (await buildAccountBalanceTimelineFromCache(
          spaceCode,
          accountsResponse,
          accountId,
          { accountId, startDate, endDate, maxPoints },
        )) ?? null
      );
    },
    enabled: Boolean(spaceCode && accountId),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localCacheQuery);

  return useQuery({
    queryKey: [
      ACCOUNT_BALANCE_TIMELINE_KEY,
      accountId,
      startDate,
      endDate,
      maxPoints,
    ],
    queryFn: async () => {
      if (skipNetworkFetch) {
        const accountsResponse = await loadCachedAccountsResponse(spaceCode);

        if (accountsResponse) {
          const cached = await buildAccountBalanceTimelineFromCache(
            spaceCode,
            accountsResponse,
            accountId,
            { accountId, startDate, endDate, maxPoints },
          );

          if (cached) {
            return cached;
          }
        }

        throw new Error("No cached account balance timeline");
      }

      try {
        return await fetchAccountBalanceTimeline(api, {
          accountId,
          startDate,
          endDate,
          maxPoints,
        });
      } catch (error) {
        const accountsResponse = await loadCachedAccountsResponse(spaceCode);

        if (accountsResponse) {
          const cached = await buildAccountBalanceTimelineFromCache(
            spaceCode,
            accountsResponse,
            accountId,
            { accountId, startDate, endDate, maxPoints },
          );

          if (cached) {
            return cached;
          }
        }

        throw error;
      }
    },
    enabled:
      enabled &&
      !!accountId &&
      !!spaceCode &&
      (!skipNetworkFetch || Boolean(localCacheQuery.data)),
    placeholderData: localCacheQuery.data ?? undefined,
    staleTime: skipNetworkFetch ? Infinity : 60_000,
    gcTime: 300_000,
    refetchOnWindowFocus: false,
    refetchOnMount: !skipNetworkFetch,
  });
};
