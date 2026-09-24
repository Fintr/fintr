import type { AxiosInstance } from "axios";

import {
  selectAutoFxRate,
  type FxRatePair,
} from "@/utils/autoFxRateSelection";

import {
  loadCachedCurrentExchangeRateWithFallback,
  loadCachedRecentExchangeRates,
} from "./local-db";
import { canFetchExchangeRatesFromNetwork } from "./network-guard";
import {
  getCurrentRate,
  getRecentRates,
  type CurrentRateResponse,
  type RecentRateItem,
  type RecentRatesResponse,
} from "./queries";

export type ResolvedAutoExchangeRates = {
  /** True when both current (required) came from local DB without a network round-trip. */
  fromLocal: boolean;
  current: CurrentRateResponse;
  recent: RecentRatesResponse;
  appliedRate: number;
  appliedSource: "auto" | "recent";
  displayedRateDate: string;
};

const emptyRecent = (): RecentRatesResponse => ({
  rates: [],
  source: "recent",
});

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const isValidCurrentRate = (payload: CurrentRateResponse | undefined): boolean =>
  Boolean(
    payload
    && Number.isFinite(Number(payload.rate))
    && Number(payload.rate) > 0,
  );

const currentFromRecent = (
  recent: RecentRatesResponse | undefined,
  fromCurrency: string,
  toCurrency: string,
): CurrentRateResponse | undefined => {
  const rawRate = Number(recent?.rates?.[0]?.rate ?? 0);
  if (!Number.isFinite(rawRate) || rawRate <= 0) {
    return undefined;
  }

  return {
    rate: rawRate,
    from_currency: fromCurrency,
    to_currency: toCurrency,
    source: "recent",
  };
};

/**
 * Resolve the auto FX rate for the amount picker.
 * Local DB first; network only when the current rate is missing locally.
 * UI components should call this — not local-db helpers directly.
 */
export const resolveAutoExchangeRates = async (params: {
  api: AxiosInstance;
  fromCurrency: string;
  toCurrency: string;
  date: string;
  spaceId?: string;
  pairChanged: boolean;
  previousPair?: FxRatePair | null;
}): Promise<ResolvedAutoExchangeRates> => {
  const {
    api,
    fromCurrency,
    toCurrency,
    date,
    spaceId,
    pairChanged,
  } = params;

  const [cachedRecent, cachedCurrent] = await Promise.all([
    spaceId
      ? loadCachedRecentExchangeRates({
          spaceId,
          fromCurrency,
          toCurrency,
        })
      : Promise.resolve(undefined),
    loadCachedCurrentExchangeRateWithFallback({
      fromCurrency,
      toCurrency,
      date,
      today: todayIsoDate(),
    }),
  ]);

  let current: CurrentRateResponse;
  let recent: RecentRatesResponse;
  let fromLocal = false;

  if (isValidCurrentRate(cachedCurrent)) {
    current = cachedCurrent;
    recent = cachedRecent ?? emptyRecent();
    fromLocal = true;
  } else if (!canFetchExchangeRatesFromNetwork()) {
    const recentCurrent = currentFromRecent(
      cachedRecent,
      fromCurrency,
      toCurrency,
    );
    if (!recentCurrent) {
      throw new Error("Exchange rate is not available offline");
    }

    current = recentCurrent;
    recent = cachedRecent ?? emptyRecent();
    fromLocal = true;
  } else {
    const [networkRecent, networkCurrent] = await Promise.all([
      getRecentRates(api, fromCurrency, toCurrency, { spaceId }),
      getCurrentRate(api, fromCurrency, toCurrency, date),
    ]);
    current = networkCurrent;
    recent = networkRecent;
    fromLocal = false;
  }

  const rates = recent.rates ?? [];
  const currentRaw = Number(current.rate);
  const { rate: appliedRate, source: appliedSource } = selectAutoFxRate({
    pairChanged,
    recentRates: rates.map((row) => Number(row.rate)),
    currentRate: currentRaw,
  });

  let displayedRateDate = date;
  if (appliedSource === "recent" && rates.length > 0) {
    displayedRateDate =
      rates[0].usedAt ??
      (rates[0] as RecentRateItem & { timestamp?: string }).timestamp ??
      date;
  }

  return {
    fromLocal,
    current,
    recent,
    appliedRate,
    appliedSource,
    displayedRateDate,
  };
};
