import { useQuery } from "@tanstack/react-query";
import { useAuthApi } from "@/hooks/useAuthApi";
import { AxiosInstance } from "axios";

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
      totalTransfersCreated: number;
      totalReceiptScans: number;
      totalAiChatUsages: number;
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
      transfersCreated: number;
      receiptScans: number;
      aiChatUsages: number;
      dashboardViews: number;
    };
  };
}

export interface UserActivityDrilldownRow {
  id: string;
  email: string;
  fullName: string;
  apiRequestCount: number;
  dashboardViewedCount: number;
  totalRequests: number;
  transactionsCreated: number;
  standaloneTransactions: number;
  transferLegTransactions: number;
  transfersCreated: number;
  receiptScans: number;
  aiChatUsages: number;
  aiInteractions: number;
}

export interface UserActivityDrilldownData {
  success: boolean;
  message: string;
  data: {
    rows: UserActivityDrilldownRow[];
    meta: {
      startDate: string;
      endDate: string;
      totalCount: number;
      page: number;
      perPage: number;
      totalPages: number;
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
    staleTime: 300_000,
    gcTime: 600_000,
  });
};

export const useUserActivityDrilldown = (date: string | null) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:admin",
  });

  return useQuery<UserActivityDrilldownData, Error>({
    queryKey: ["admin", "user-activity-drilldown", date],
    queryFn: async () => {
      const response = await api.get("/admin/user_activity/activity_drilldown", {
        params: { date },
      });
      return response.data;
    },
    enabled: Boolean(date),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    gcTime: 300_000,
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
