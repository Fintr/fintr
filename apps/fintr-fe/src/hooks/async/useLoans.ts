import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { fetchLoans, Loan } from '@/services/loans/queries';

/**
 * Hook for fetching all loans
 */
export const useLoans = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  const queryClient = useQueryClient();

  const {
    data: loans,
    isLoading,
    isError,
    error,
    refetch,
    isSuccess,
  } = useQuery<Loan[]>({
    queryKey: ['loans'],
    queryFn: () => fetchLoans(api),
    enabled: !!api,
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


