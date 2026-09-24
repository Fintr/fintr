import type { AxiosInstance } from "axios";

export type AdminProGrant = {
  id: string;
  email: string;
  expiresAt: string;
  acknowledgedAt: string | null;
  updatedAt: string;
};

export const fetchProGrants = async (api: AxiosInstance): Promise<AdminProGrant[]> => {
  const response = await api.get("/admin/finance/pro_grants");
  return response.data.data.grants ?? [];
};

export const grantProYear = async (
  api: AxiosInstance,
  email: string,
): Promise<AdminProGrant> => {
  const response = await api.post("/admin/finance/pro_grants", { email });
  return response.data.data.grant;
};
