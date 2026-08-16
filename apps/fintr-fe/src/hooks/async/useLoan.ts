import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { fetchLoanById, Loan } from "@/services/loans/queries";
import {
  cacheLoanDetail,
  loadCachedLoanSnapshot,
} from "@/services/loans/local-cache";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";

export const LOAN_DETAIL_KEY = "loanDetail" as const;

export const useLoan = (loanId: string) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localLoanQuery = useQuery({
    queryKey: [LOAN_DETAIL_KEY, "local", spaceCode, loanId],
    queryFn: async () =>
      (await loadCachedLoanSnapshot(spaceCode, loanId)) ?? null,
    enabled: Boolean(spaceCode && loanId),
    staleTime: Infinity,
    networkMode: "always",
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(
    localLoanQuery,
    spaceCode,
  );

  const networkQuery = useQuery<Loan>({
    queryKey: [LOAN_DETAIL_KEY, loanId],
    queryFn: async () => {
      if (skipNetworkFetch) {
        const cached = await loadCachedLoanSnapshot(spaceCode, loanId);
        if (cached) {
          return cached;
        }

        throw new Error("No cached loan");
      }

      try {
        const loan = await fetchLoanById(api, loanId);
        if (loan && spaceCode) {
          await cacheLoanDetail(spaceCode, loanId, loan);
          queryClient.setQueryData(
            [LOAN_DETAIL_KEY, "local", spaceCode, loanId],
            loan,
          );
        }
        return loan;
      } catch (error) {
        const cached = await loadCachedLoanSnapshot(spaceCode, loanId);
        if (cached) {
          return cached;
        }

        throw error;
      }
    },
    enabled:
      Boolean(loanId) &&
      Boolean(spaceCode) &&
      (!skipNetworkFetch || localLoanQuery.isSuccess),
    placeholderData: localLoanQuery.data ?? undefined,
    retry: false,
    refetchOnMount: !skipNetworkFetch,
    refetchOnWindowFocus: false,
    staleTime: skipNetworkFetch ? Infinity : 30000,
    gcTime: 300000,
  });

  const loan = skipNetworkFetch
    ? (localLoanQuery.data ?? networkQuery.data)
    : (networkQuery.data ?? localLoanQuery.data);

  return {
    ...networkQuery,
    data: loan ?? undefined,
    isLoading:
      localLoanQuery.isPending ||
      (networkQuery.isPending && !loan),
    isError: loan ? false : networkQuery.isError,
  };
};
