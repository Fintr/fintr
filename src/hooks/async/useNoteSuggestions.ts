import { useQuery } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { fetchNoteSuggestions, NoteSuggestionsParams } from '@/services/transactions/queries';
import { useLocalStorage } from '../useLocalStorage';

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
  
  const { categoryName, transactionType, search, limit = 10, enabled = true } = options;

  return useQuery({
    queryKey: ['noteSuggestions', spaceCode, categoryName, transactionType, search],
    queryFn: async () => {
      const params: NoteSuggestionsParams = {
        categoryName,
        transactionType,
        search,
        limit,
      };
      return fetchNoteSuggestions(api, params);
    },
    enabled: !!api && !!spaceCode && isAuthenticated && enabled && !!categoryName,
    staleTime: 60000, // Consider data fresh for 60 seconds
    retry: 1,
    placeholderData: [],
  });
};
