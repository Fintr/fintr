import { useQuery } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { fetchTransactionDrafts } from '@/services/transactions/queries';
import { useLocalStorage } from '../useLocalStorage';
import { useSkipCachedNetworkFetch } from '@/hooks/useOfflineReadMode';

export const useTransactionDrafts = () => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");
  const skipNetworkFetch = useSkipCachedNetworkFetch();

  return useQuery({
    queryKey: ['transactionDrafts', spaceCode],
    queryFn: async () => {
      const drafts = await fetchTransactionDrafts(api);
      return drafts;
    },
    enabled: !!api && !!spaceCode && isAuthenticated && !skipNetworkFetch,
    staleTime: 30000,
    retry: 2,
    placeholderData: [],
  });
};
