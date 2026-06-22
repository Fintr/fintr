import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { fetchLoanById, Loan } from "@/services/loans/queries";

export const LOAN_DETAIL_KEY = "loanDetail" as const;

export const useLoan = (loanId: string) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  return useQuery<Loan>({
    queryKey: [LOAN_DETAIL_KEY, loanId],
    queryFn: () => fetchLoanById(api, loanId),
    enabled: !!loanId,
    staleTime: 30000,
    gcTime: 300000,
  });
};
