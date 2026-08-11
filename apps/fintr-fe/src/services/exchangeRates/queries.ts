import type { AxiosInstance, AxiosRequestConfig } from "axios";

import {
  cacheCurrentExchangeRate,
  cacheRecentExchangeRates,
  loadCachedCurrentExchangeRate,
  loadCachedRecentExchangeRates,
} from "./local-db";

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

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const readSpaceCode = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const raw = window.localStorage.getItem("spaceCode");
    if (!raw) {
      return "";
    }
    // useLocalStorage may JSON-stringify strings
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === "string" ? parsed : String(raw);
  } catch {
    return window.localStorage.getItem("spaceCode") ?? "";
  }
};

const normalizeCurrentRate = (data: unknown): CurrentRateResponse => {
  const record = (data ?? {}) as Record<string, unknown>;
  return {
    rate: Number(record.rate ?? 0),
    from_currency: String(
      record.from_currency ?? record.fromCurrency ?? "",
    ),
    to_currency: String(record.to_currency ?? record.toCurrency ?? ""),
    source: String(record.source ?? "auto"),
    timestamp:
      typeof record.timestamp === "string" ? record.timestamp : undefined,
  };
};

const normalizeRecentRates = (data: unknown): RecentRatesResponse => {
  const record = (data ?? {}) as Record<string, unknown>;
  const ratesRaw = Array.isArray(record.rates) ? record.rates : [];
  return {
    source: String(record.source ?? "recent"),
    rates: ratesRaw.map((item) => {
      const row = (item ?? {}) as Record<string, unknown>;
      return {
        rate: Number(row.rate ?? 0),
        usedAt:
          typeof row.usedAt === "string"
            ? row.usedAt
            : typeof row.used_at === "string"
              ? row.used_at
              : undefined,
      };
    }),
  };
};

/**
 * Local-first current rate: IndexedDB → network → store.
 * Falls back to network when the pair/date is missing locally.
 */
export const getCurrentRate = async (
  api: AxiosInstance,
  fromCurrency: string,
  toCurrency: string,
  date?: string,
  requestConfig?: AxiosRequestConfig,
): Promise<CurrentRateResponse> => {
  const rateDate = date || todayIsoDate();

  const cached = await loadCachedCurrentExchangeRate({
    fromCurrency,
    toCurrency,
    date: rateDate,
  });
  if (cached && Number.isFinite(Number(cached.rate)) && Number(cached.rate) > 0) {
    return normalizeCurrentRate(cached);
  }

  const params: { from_currency: string; to_currency: string; date?: string } = {
    from_currency: fromCurrency,
    to_currency: toCurrency,
    date: rateDate,
  };

  const response = await api.get("/exchange_rates/current", {
    ...requestConfig,
    params: {
      ...params,
      ...(requestConfig?.params as Record<string, unknown> | undefined),
    },
  });
  const data = normalizeCurrentRate(response.data?.data ?? response.data);
  await cacheCurrentExchangeRate({
    fromCurrency,
    toCurrency,
    date: rateDate,
    payload: data,
  });
  return data;
};

/**
 * Local-first recent rates for the active space: IndexedDB → network → store.
 */
export const getRecentRates = async (
  api: AxiosInstance,
  fromCurrency: string,
  toCurrency: string,
  options?: {
    spaceId?: string;
    requestConfig?: AxiosRequestConfig;
  },
): Promise<RecentRatesResponse> => {
  const spaceId = options?.spaceId || readSpaceCode();

  if (spaceId) {
    const cached = await loadCachedRecentExchangeRates({
      spaceId,
      fromCurrency,
      toCurrency,
    });
    if (cached && Array.isArray(cached.rates)) {
      return normalizeRecentRates(cached);
    }
  }

  const response = await api.get("/exchange_rates/recent", {
    ...options?.requestConfig,
    params: {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      ...(options?.requestConfig?.params as Record<string, unknown> | undefined),
    },
  });
  const data = normalizeRecentRates(response.data?.data ?? response.data);

  if (spaceId) {
    await cacheRecentExchangeRates({
      spaceId,
      fromCurrency,
      toCurrency,
      payload: data,
    });
  }

  return data;
};
