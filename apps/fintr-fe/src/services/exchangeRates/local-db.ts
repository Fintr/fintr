import {
  deleteLocalResponseSnapshot,
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "@/lib/local-db/response-cache";

import type {
  CurrentRateResponse,
  RecentRatesResponse,
} from "./queries";

const normalizeCurrency = (code: string): string => code.trim().toUpperCase();

const currentRateKey = (
  fromCurrency: string,
  toCurrency: string,
  date: string,
): string =>
  `exchangeRate:current:${normalizeCurrency(fromCurrency)}:${normalizeCurrency(toCurrency)}:${date}`;

const recentRatesKey = (
  spaceId: string,
  fromCurrency: string,
  toCurrency: string,
): string =>
  `exchangeRate:recent:${spaceId}:${normalizeCurrency(fromCurrency)}:${normalizeCurrency(toCurrency)}`;

const exchangeRatesRefreshKey = (spaceId: string): string =>
  `exchangeRates:lastRefreshDate:${spaceId}`;

export const getExchangeRatesLastRefreshDate = async (
  spaceId: string,
): Promise<string | undefined> => {
  if (!spaceId) {
    return undefined;
  }

  try {
    const value = await getLocalResponseSnapshot<string>(
      exchangeRatesRefreshKey(spaceId),
    );
    return typeof value === "string" ? value : undefined;
  } catch (error) {
    console.warn("[local-db] Failed to read exchange rate refresh date", error);
    return undefined;
  }
};

export const markExchangeRatesRefreshed = async (
  spaceId: string,
  date: string,
): Promise<void> => {
  if (!spaceId || !date) {
    return;
  }

  try {
    await putLocalResponseSnapshot(exchangeRatesRefreshKey(spaceId), date);
  } catch (error) {
    console.warn("[local-db] Failed to mark exchange rates refreshed", error);
  }
};

export const cacheCurrentExchangeRate = async (params: {
  fromCurrency: string;
  toCurrency: string;
  date: string;
  payload: CurrentRateResponse;
}): Promise<void> => {
  const { fromCurrency, toCurrency, date, payload } = params;
  if (!fromCurrency || !toCurrency || !date) {
    return;
  }

  try {
    await putLocalResponseSnapshot(
      currentRateKey(fromCurrency, toCurrency, date),
      payload,
    );
  } catch (error) {
    console.warn("[local-db] Failed to cache current exchange rate", error);
  }
};

export const loadCachedCurrentExchangeRate = async (params: {
  fromCurrency: string;
  toCurrency: string;
  date: string;
}): Promise<CurrentRateResponse | undefined> => {
  const { fromCurrency, toCurrency, date } = params;
  if (!fromCurrency || !toCurrency || !date) {
    return undefined;
  }

  try {
    return await getLocalResponseSnapshot<CurrentRateResponse>(
      currentRateKey(fromCurrency, toCurrency, date),
    );
  } catch (error) {
    console.warn("[local-db] Failed to load current exchange rate", error);
    return undefined;
  }
};

export const clearCachedCurrentExchangeRate = async (params: {
  fromCurrency: string;
  toCurrency: string;
  date: string;
}): Promise<void> => {
  const { fromCurrency, toCurrency, date } = params;
  if (!fromCurrency || !toCurrency || !date) {
    return;
  }

  try {
    await deleteLocalResponseSnapshot(
      currentRateKey(fromCurrency, toCurrency, date),
    );
  } catch (error) {
    console.warn("[local-db] Failed to clear current exchange rate", error);
  }
};

export const cacheRecentExchangeRates = async (params: {
  spaceId: string;
  fromCurrency: string;
  toCurrency: string;
  payload: RecentRatesResponse;
}): Promise<void> => {
  const { spaceId, fromCurrency, toCurrency, payload } = params;
  if (!spaceId || !fromCurrency || !toCurrency) {
    return;
  }

  try {
    await putLocalResponseSnapshot(
      recentRatesKey(spaceId, fromCurrency, toCurrency),
      payload,
    );
  } catch (error) {
    console.warn("[local-db] Failed to cache recent exchange rates", error);
  }
};

export const loadCachedRecentExchangeRates = async (params: {
  spaceId: string;
  fromCurrency: string;
  toCurrency: string;
}): Promise<RecentRatesResponse | undefined> => {
  const { spaceId, fromCurrency, toCurrency } = params;
  if (!spaceId || !fromCurrency || !toCurrency) {
    return undefined;
  }

  try {
    return await getLocalResponseSnapshot<RecentRatesResponse>(
      recentRatesKey(spaceId, fromCurrency, toCurrency),
    );
  } catch (error) {
    console.warn("[local-db] Failed to load recent exchange rates", error);
    return undefined;
  }
};

/** Directed pairs among distinct currency codes (A→B for every A≠B). */
export const buildCurrencyPairs = (
  currencyCodes: string[],
): Array<{ fromCurrency: string; toCurrency: string }> => {
  const unique = Array.from(
    new Set(
      currencyCodes
        .map((code) => normalizeCurrency(code))
        .filter(Boolean),
    ),
  );

  const pairs: Array<{ fromCurrency: string; toCurrency: string }> = [];
  for (const fromCurrency of unique) {
    for (const toCurrency of unique) {
      if (fromCurrency !== toCurrency) {
        pairs.push({ fromCurrency, toCurrency });
      }
    }
  }
  return pairs;
};
