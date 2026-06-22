import { useQuery } from '@tanstack/react-query';
import { useAuthApi } from '@/hooks/useAuthApi';
import { fetchAIUsage, AIUsageData } from '@/services/ai/queries';

export const useAIUsage = () => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:ai_usage",
  });

  return useQuery<AIUsageData>({
    queryKey: ['ai', 'usage'],
    queryFn: () => fetchAIUsage(api),
    enabled: isAuthenticated, // Only run if user is authenticated
    staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Data stays in cache for 10 minutes
  });
};
