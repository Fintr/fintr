import { fetchInsights } from "@/services/insights/queries";
import { useQuery } from "@tanstack/react-query";
import useAuthApi from "../useAuthApi";
import { useLocalStorage } from "../useLocalStorage";

interface UseInsightsDataParams {
  filterType?: string;
  selectedMonth?: string;
  selectedYear?: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  selectedCategory?: string;
  selectedCategoryId?: string | null;
  selectedSubcategoryId?: string | null;
}

export const useInsightsData = (params: UseInsightsDataParams = {}) => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions",
  });
  
  const [spaceCode] = useLocalStorage("spaceCode", "");
  
  const { data, error, isLoading, isError, isSuccess, refetch } = useQuery({
    queryKey: ["insights", spaceCode, params],
    queryFn: () => fetchInsights(api, params),
    enabled: !!spaceCode && isAuthenticated, // Only run if spaceCode exists and user is authenticated
    retry: 2, // Retry failed requests twice
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Log errors for debugging
  if (isError) {
    console.error('Insights data fetch error:', error);
  }

  return { data, error, isLoading, isError, isSuccess, refetch };
}; 
 