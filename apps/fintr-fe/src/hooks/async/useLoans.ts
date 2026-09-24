import { useQuery } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { loansListQueryKey } from '@/services/loans/loans-list-cache';
import { fetchLoans, Loan } from '@/services/loans/queries';

/**
 * Hook for fetching all loans
 */
export const useLoans = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const [spaceCode] = useLocalStorage("spaceCode", "");

  const {
    data: loans,
    isLoading,
    isError,
    error,
    refetch,
    isSuccess,
  } = useQuery<Loan[]>({
    queryKey: loansListQueryKey(spaceCode),
    queryFn: () => fetchLoans(api),
    enabled: !!api && Boolean(spaceCode),
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  return {
    loans: loans || [],
    isLoading,
    isError,
    error,
    refetch,
    isSuccess,
  };
};


