import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { AxiosInstance } from 'axios';

export interface UserAnalyticsData {
  success: boolean;
  message: string;
  data: {
    dailyActiveUsers: Record<string, number>;
    summary: {
      totalActiveUsers: number;
      totalApiRequests: number;
      totalLogins: number;
      totalTransactionsCreated: number;
      totalDashboardViews: number;
      averageRequestsPerUser: number;
      totalDays: number;
      averageDailyActiveUsers: number;
      dateRange: {
        startDate: string;
        endDate: string;
      };
    };
    activityBreakdown: {
      logins: number;
      apiRequests: number;
      transactionsCreated: number;
      dashboardViews: number;
    };
  };
}

export const useUserAnalytics = () => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:admin",
  });
  
  return useQuery<UserAnalyticsData, Error>({
    queryKey: ["admin", "user-analytics"],
    queryFn: async () => {
      const response = await api.get("/admin/user_activity/analytics");
      return response.data;
    },
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 300000, // 5 minutes
    cacheTime: 600000, // 10 minutes
  });
};

export const fetchUserAnalytics = async (
  api: AxiosInstance
): Promise<UserAnalyticsData> => {
  try {
    const response = await api.get("/admin/user_activity/analytics");
    return response.data;
  } catch (error) {
    console.error("Error fetching user analytics:", error);
    throw error;
  }
};
