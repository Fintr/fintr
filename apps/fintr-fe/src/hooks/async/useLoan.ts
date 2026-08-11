import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { fetchLoanById, Loan } from "@/services/loans/queries";
import { loadCachedLoanDetail } from "@/services/loans/local-cache";
import { useSkipCachedNetworkFetch } from "@/hooks/useOfflineReadMode";

export const LOAN_DETAIL_KEY = "loanDetail" as const;

export const useLoan = (loanId: string) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const localLoanQuery = useQuery({
    queryKey: [LOAN_DETAIL_KEY, "local", spaceCode, loanId],
    queryFn: async () =>
      (await loadCachedLoanDetail(spaceCode, loanId)) ?? null,
    enabled: Boolean(spaceCode && loanId),
    staleTime: Infinity,
  });

  const skipNetworkFetch = useSkipCachedNetworkFetch(localLoanQuery);

  return useQuery<Loan>({
    queryKey: [LOAN_DETAIL_KEY, loanId],
    queryFn: () => fetchLoanById(api, loanId),
    enabled: !!loanId && !skipNetworkFetch,
    placeholderData: localLoanQuery.data ?? undefined,
    refetchOnMount: !skipNetworkFetch,
    staleTime: skipNetworkFetch ? Infinity : 30000,
    gcTime: 300000,
  });
};
