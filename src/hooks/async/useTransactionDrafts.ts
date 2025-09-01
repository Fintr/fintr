import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { fetchTransactionDrafts } from '@/services/transactions/queries';

export const useTransactionDrafts = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  return useQuery({
    queryKey: ['transactionDrafts'],
    queryFn: async () => {
      const drafts = await fetchTransactionDrafts(api);
      console.log('Fetched drafts from API:', drafts);
      return drafts;
    },
    enabled: !!api,
    staleTime: 30000, // Consider data fresh for 30 seconds
    retry: 2,
  });
};
