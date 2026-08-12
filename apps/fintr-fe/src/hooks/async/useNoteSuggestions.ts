import { useQuery } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { fetchNoteSuggestions, NoteSuggestionsParams } from '@/services/transactions/queries';
import { loadCachedNoteSuggestions } from '@/services/transactions/note-suggestions-local';
import { useLocalStorage } from '../useLocalStorage';
import { useSkipCachedNetworkFetch } from '@/hooks/useOfflineReadMode';

export interface UseNoteSuggestionsOptions {
  categoryName?: string;
  transactionType?: 'income' | 'expense';
  search?: string;
  limit?: number;
  enabled?: boolean;
}

export const useNoteSuggestions = (options: UseNoteSuggestionsOptions = {}) => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });

  const [spaceCode] = useLocalStorage("spaceCode", "");
  const skipNetworkFetch = useSkipCachedNetworkFetch();
  
  const { categoryName, transactionType, search, limit = 10, enabled = true } = options;

  const suggestionParams: NoteSuggestionsParams = {
    categoryName,
    transactionType,
    search,
    limit,
  };

  const localCacheQuery = useQuery({
    queryKey: [
      'noteSuggestions',
      'local',
      spaceCode,
      categoryName,
      transactionType,
      search,
      limit,
    ],
    queryFn: async () =>
      loadCachedNoteSuggestions(spaceCode, suggestionParams),
    enabled: Boolean(spaceCode && categoryName),
    staleTime: Infinity,
  });

  return useQuery({
    queryKey: ['noteSuggestions', spaceCode, categoryName, transactionType, search],
    queryFn: async () => {
      if (skipNetworkFetch) {
        return loadCachedNoteSuggestions(spaceCode, suggestionParams);
      }

      return fetchNoteSuggestions(api, suggestionParams);
    },
    enabled:
      !!spaceCode &&
      isAuthenticated &&
      enabled &&
      !!categoryName &&
      (!skipNetworkFetch || localCacheQuery.isSuccess),
    staleTime: 60000,
    retry: skipNetworkFetch ? false : 1,
    placeholderData: localCacheQuery.data ?? [],
  });
};
