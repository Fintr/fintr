import { useQuery } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { fetchAIUsage, AIUsageData } from '@/services/ai/queries';

export const useAIUsage = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:ai_usage",
  });

  return useQuery<AIUsageData>({
    queryKey: ['ai', 'usage'],
    queryFn: () => fetchAIUsage(api),
    staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
    cacheTime: 10 * 60 * 1000, // Data stays in cache for 10 minutes
  });
};
