import type { AxiosInstance, AxiosRequestConfig } from "axios";

import type { MonthlyFinancialSummary } from "./types";

export const fetchMonthlyFinancialSummaries = async (
  api: AxiosInstance,
  options?: {
    startDate?: string;
    endDate?: string;
    requestConfig?: AxiosRequestConfig;
  },
): Promise<MonthlyFinancialSummary[]> => {
  const params: { start_date?: string; end_date?: string } = {};
  if (options?.startDate) {
    params.start_date = options.startDate;
  }
  if (options?.endDate) {
    params.end_date = options.endDate;
  }

  const response = await api.get("/monthly_financial_summaries", {
    params,
    ...options?.requestConfig,
  });

  return response.data?.data?.monthlyFinancialSummaries ?? [];
};
