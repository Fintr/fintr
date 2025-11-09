import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { fetchTransactionDrafts } from '@/services/transactions/queries';
import { useLocalStorage } from '../useLocalStorage';

export const useTransactionDrafts = () => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");

  return useQuery({
    queryKey: ['transactionDrafts', spaceCode],
    queryFn: async () => {
      const drafts = await fetchTransactionDrafts(api);
      console.log('Fetched drafts from API:', drafts);
      return drafts;
    },
    enabled: !!api && !!spaceCode && isAuthenticated, // Only run if api exists, spaceCode exists, and user is authenticated
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 2,
  });
};
