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
    monthlyActiveUserOcr: MonthlyActiveUserOcrRow[];
    monthlyActiveUserOcrMeta: MonthlyActiveUserOcrMeta;
    ocrActiveUserSummary: OcrActiveUserSummary;
  };
}

export interface MonthlyActiveUserOcrMeta {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
}

export interface MonthlyActiveUserOcrRow {
  month: string;
  monthLabel: string;
  activeUserCount: number;
  totalOcrTokens: number;
  averageOcrTokensPerActiveUser: number;
}

export interface OcrActiveUserSummary {
  averageMonthlyOcrAcrossMonths: number;
  minActiveDaysRequired: number;
  monthsWithActiveUsers: number;
  monthsInRange: number;
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
    averageRow: UserActivityDrilldownRow | null;
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

export const useUserAnalytics = (monthlyOcrPage: number = 1) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:admin",
  });

  return useQuery<UserAnalyticsData, Error>({
    queryKey: ["admin", "user-analytics", monthlyOcrPage],
    queryFn: async () => {
      const response = await api.get<UserAnalyticsData>("/admin/user_activity/analytics", {
        params: {
          monthly_ocr_page: monthlyOcrPage,
          monthly_ocr_per_page: 12,
        },
      });
      return response.data;
    },
    keepPreviousData: true,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 300_000,
    cacheTime: 600_000,
  });
};

export const useUserActivityDrilldown = (date: string | null) => {
  const { api } = useAuthApi({
    scope: "openid profile email read:current_user read:admin",
  });

  return useQuery<UserActivityDrilldownData, Error>({
    queryKey: ["admin", "user-activity-drilldown", date],
    queryFn: async () => {
      const response = await api.get<UserActivityDrilldownData>("/admin/user_activity/activity_drilldown", {
        params: { date },
      });
      return response.data;
    },
    enabled: Boolean(date),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    cacheTime: 300_000,
  });
};

export const fetchUserAnalytics = async (
  api: AxiosInstance,
  monthlyOcrPage: number = 1
): Promise<UserAnalyticsData> => {
  try {
    const response = await api.get<UserAnalyticsData>("/admin/user_activity/analytics", {
      params: {
        monthly_ocr_page: monthlyOcrPage,
        monthly_ocr_per_page: 12,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching user analytics:", error);
    throw error;
  }
};
