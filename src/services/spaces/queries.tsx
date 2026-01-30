import { DashboardData } from "@/types/spaceTypes";
import { AxiosInstance } from "axios";

export const fetchDashboardData = async (
  api: AxiosInstance,
  startDate?: string,
  endDate?: string
) : Promise<DashboardData> => {
  const params: { start_date?: string; end_date?: string } = {};
  
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;
  
  const response = await api.get(`/dashboard`, { params });
  return response.data.data.dashboard;
};
