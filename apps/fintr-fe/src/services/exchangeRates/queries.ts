import { AxiosInstance } from "axios";

export interface CurrentRateResponse {
  rate: number;
  from_currency: string;
  to_currency: string;
  source: string;
  timestamp?: string;
}

export interface RecentRateItem {
  rate: number;
  usedAt?: string;
}

export interface RecentRatesResponse {
  rates: RecentRateItem[];
  source: string;
}

/**
 * Fetch current exchange rate (cached or from API). Use for "Use current rate" in picker.
 */
export const getCurrentRate = async (
  api: AxiosInstance,
  fromCurrency: string,
  toCurrency: string,
  date?: string
): Promise<CurrentRateResponse> => {
  const params: { from_currency: string; to_currency: string; date?: string } = {
    from_currency: fromCurrency,
    to_currency: toCurrency,
  };
  if (date) params.date = date;
  const response = await api.get("/exchange_rates/current", { params });
  const data = response.data?.data ?? response.data;
  return data;
};

/**
 * Fetch recent rates used for this pair (for "Recent rates" in picker).
 */
export const getRecentRates = async (
  api: AxiosInstance,
  fromCurrency: string,
  toCurrency: string
): Promise<RecentRatesResponse> => {
  const response = await api.get("/exchange_rates/recent", {
    params: { from_currency: fromCurrency, to_currency: toCurrency },
  });
  const data = response.data?.data ?? response.data;
  return data;
};
