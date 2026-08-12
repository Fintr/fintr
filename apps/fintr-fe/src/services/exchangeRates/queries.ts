import type { AxiosInstance, AxiosRequestConfig } from "axios";

import {
  cacheCurrentExchangeRate,
  cacheRecentExchangeRates,
  loadCachedCurrentExchangeRateWithFallback,
  loadCachedRecentExchangeRates,
} from "./local-db";
import { canFetchExchangeRatesFromNetwork } from "./network-guard";

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
export class ExchangeRateOfflineError extends Error {
  constructor(message: string = "Exchange rate is not available offline") {
    super(message);
    this.name = "ExchangeRateOfflineError";
  }
}

export const getCurrentRate = async (
  api: AxiosInstance,
  fromCurrency: string,
  toCurrency: string,
  date?: string,
  requestConfig?: AxiosRequestConfig,
  options?: {
    allowNetwork?: boolean;
  },
): Promise<CurrentRateResponse> => {
  const rateDate = date || todayIsoDate();

  const cached = await loadCachedCurrentExchangeRateWithFallback({
    fromCurrency,
    toCurrency,
    date: rateDate,
    today: todayIsoDate(),
  });
  if (cached) {
    return normalizeCurrentRate(cached);
  }

  if (!canFetchExchangeRatesFromNetwork(options?.allowNetwork)) {
    throw new ExchangeRateOfflineError();
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
    allowNetwork?: boolean;
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

  if (!canFetchExchangeRatesFromNetwork(options?.allowNetwork)) {
    return { rates: [], source: "recent" };
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

export type BatchCurrentRateRequest = {
  fromCurrency: string;
  toCurrency: string;
  date?: string;
};

type BatchCurrentRateRow = {
  rate: number;
  from_currency?: string;
  fromCurrency?: string;
  to_currency?: string;
  toCurrency?: string;
  date?: string;
  source?: string;
  timestamp?: string;
};

/**
 * Always fetches the current rate from the network and writes through to IDB.
 */
export const fetchAndCacheCurrentRate = async (
  api: AxiosInstance,
  fromCurrency: string,
  toCurrency: string,
  date?: string,
  requestConfig?: AxiosRequestConfig,
): Promise<CurrentRateResponse> => {
  const rateDate = date || todayIsoDate();
  const response = await api.get("/exchange_rates/current", {
    ...requestConfig,
    params: {
      from_currency: fromCurrency,
      to_currency: toCurrency,
      date: rateDate,
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
 * Fetches many dated current rates in one request and writes each to IDB.
 */
export const fetchAndCacheBatchCurrentRates = async (
  api: AxiosInstance,
  requests: BatchCurrentRateRequest[],
  requestConfig?: AxiosRequestConfig,
): Promise<void> => {
  if (requests.length === 0) {
    return;
  }

  const response = await api.post(
    "/exchange_rates/batch",
    {
      requests: requests.map((request) => ({
        from_currency: request.fromCurrency,
        to_currency: request.toCurrency,
        date: request.date || todayIsoDate(),
      })),
    },
    requestConfig,
  );

  const rows = (response.data?.data?.rates ?? response.data?.rates ?? []) as BatchCurrentRateRow[];

  for (const row of rows) {
    const fromCurrency = String(row.from_currency ?? row.fromCurrency ?? "");
    const toCurrency = String(row.to_currency ?? row.toCurrency ?? "");
    const rateDate = String(row.date ?? todayIsoDate());
    if (!fromCurrency || !toCurrency) {
      continue;
    }

    const payload = normalizeCurrentRate(row);
    await cacheCurrentExchangeRate({
      fromCurrency,
      toCurrency,
      date: rateDate,
      payload,
    });
  }
};

/**
 * Always fetches recent rates from the network and writes through to IDB.
 */
export const fetchAndCacheRecentRates = async (
  api: AxiosInstance,
  fromCurrency: string,
  toCurrency: string,
  options?: {
    spaceId?: string;
    requestConfig?: AxiosRequestConfig;
  },
): Promise<RecentRatesResponse> => {
  const spaceId = options?.spaceId || readSpaceCode();
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
