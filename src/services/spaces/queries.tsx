import { DashboardData } from "@/types/spaceTypes";
import { AxiosInstance } from "axios";

export const fetchDashboardData = async (api: AxiosInstance) : Promise<DashboardData> => {
  const response = await api.get(`/dashboard`);
  return response.data.data.dashboard;
};
