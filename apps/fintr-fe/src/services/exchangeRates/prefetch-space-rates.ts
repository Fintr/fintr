import type { AxiosInstance, AxiosRequestConfig } from "axios";

import { offlineBootstrapDateRange } from "@/lib/local-sync/offline-bootstrap-dates";
import { extractAccountsFromResponse, loadCachedAccountsResponse } from "@/services/transactions/accounts/local-cache";
import {
  buildTransactionsFilterKey,
  loadCachedTransactionsInfiniteData,
} from "@/services/transactions/local-cache";
import { loadCachedSpaceContext } from "@/services/spaces/spaces-list-cache";
import { serializeFilterValues } from "@/utils/transactionFilterValues";
import type { TransactionsPage } from "@/types/transactionTypes";

import {
  buildCurrencyPairs,
  getExchangeRatesLastRefreshDate,
  markExchangeRatesRefreshed,
} from "./local-db";
import {
  fetchAndCacheCurrentRate,
  fetchAndCacheRecentRates,
} from "./queries";

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

const normalizeCurrency = (code: string): string => code.trim().toUpperCase();

export type DatedExchangeRateRequest = {
  fromCurrency: string;
  toCurrency: string;
  date: string;
};

export const collectDatedExchangeRateRequests = (params: {
  spaceCurrency?: string;
  transactionPages: TransactionsPage[];
}): DatedExchangeRateRequest[] => {
  const space = normalizeCurrency(params.spaceCurrency ?? "PHP");
  const requests = new Map<string, DatedExchangeRateRequest>();

  for (const page of params.transactionPages) {
    for (const transaction of page.transactions) {
      const date = transaction.date.slice(0, 10);
      if (!date) {
        continue;
      }

      for (const currency of [
        transaction.bookedAmountCurrency,
        transaction.amountCurrency,
      ]) {
        if (!currency) {
          continue;
        }

        const fromCurrency = normalizeCurrency(currency);
        if (fromCurrency === space) {
          continue;
        }

        const key = `${fromCurrency}:${space}:${date}`;
        if (!requests.has(key)) {
          requests.set(key, {
            fromCurrency,
            toCurrency: space,
            date,
          });
        }
      }
    }
  }

  return Array.from(requests.values());
};

export type CollectExchangeRatePairsParams = {
  spaceCurrency?: string;
  accounts: unknown;
  transactionPages: TransactionsPage[];
};

export const collectExchangeRatePairs = (
  params: CollectExchangeRatePairsParams,
): Array<{ fromCurrency: string; toCurrency: string }> => {
  const accountCurrencies = extractAccountsFromResponse(params.accounts).map(
    (account) => account.balanceCurrency,
  );
  const transactionCurrencies = params.transactionPages.flatMap((page) =>
    page.transactions.flatMap((transaction) => [
      transaction.amountCurrency,
      transaction.bookedAmountCurrency,
    ]),
  );

  return buildCurrencyPairs([
    params.spaceCurrency ?? "PHP",
    ...accountCurrencies,
    ...transactionCurrencies.filter(
      (code): code is string => typeof code === "string" && code.length > 0,
    ),
  ]);
};

export type RefreshSpaceExchangeRatesParams = {
  api: AxiosInstance;
  spaceCode: string;
  accounts: unknown;
  transactionPages: TransactionsPage[];
  spaceCurrency?: string;
  requestConfig?: AxiosRequestConfig;
  force?: boolean;
};

/**
 * Refresh FX pairs for a space. Skips work when already refreshed today unless
 * `force` is true (e.g. user just came back online).
 */
export const refreshSpaceExchangeRates = async (
  params: RefreshSpaceExchangeRatesParams,
): Promise<void> => {
  const { api, spaceCode, accounts, transactionPages, requestConfig } = params;
  if (!spaceCode) {
    return;
  }

  const today = todayIsoDate();
  const lastRefreshDate = await getExchangeRatesLastRefreshDate(spaceCode);
  if (!params.force && lastRefreshDate === today) {
    return;
  }

  const spaceContext = await loadCachedSpaceContext(spaceCode);
  const spaceCurrency = normalizeCurrency(
    params.spaceCurrency ?? spaceContext?.currency ?? "PHP",
  );
  const pairs = collectExchangeRatePairs({
    spaceCurrency,
    accounts,
    transactionPages,
  });
  const datedRequests = collectDatedExchangeRateRequests({
    spaceCurrency,
    transactionPages,
  });

  if (pairs.length === 0 && datedRequests.length === 0) {
    await markExchangeRatesRefreshed(spaceCode, today);
    return;
  }

  const recentPairsDone = new Set<string>();

  for (const request of datedRequests) {
    try {
      await fetchAndCacheCurrentRate(
        api,
        request.fromCurrency,
        request.toCurrency,
        request.date,
        requestConfig,
      );
    } catch (rateError) {
      console.warn(
        "[exchange-rates] Dated refresh failed",
        spaceCode,
        request,
        rateError,
      );
    }
  }

  const pairKeys = new Set<string>([
    ...pairs.map((pair) => `${pair.fromCurrency}:${pair.toCurrency}`),
    ...datedRequests.map(
      (request) => `${request.fromCurrency}:${request.toCurrency}`,
    ),
  ]);

  for (const pairKey of pairKeys) {
    const [fromCurrency, toCurrency] = pairKey.split(":");
    if (!fromCurrency || !toCurrency) {
      continue;
    }

    const hasDatedRate = datedRequests.some(
      (request) =>
        request.fromCurrency === fromCurrency
        && request.toCurrency === toCurrency,
    );

    if (!hasDatedRate) {
      try {
        await fetchAndCacheCurrentRate(
          api,
          fromCurrency,
          toCurrency,
          today,
          requestConfig,
        );
      } catch (rateError) {
        console.warn(
          "[exchange-rates] Today refresh failed",
          spaceCode,
          pairKey,
          rateError,
        );
      }
    }

    if (recentPairsDone.has(pairKey)) {
      continue;
    }

    try {
      await fetchAndCacheRecentRates(
        api,
        fromCurrency,
        toCurrency,
        {
          spaceId: spaceCode,
          requestConfig,
        },
      );
      recentPairsDone.add(pairKey);
    } catch (rateError) {
      console.warn(
        "[exchange-rates] Recent refresh failed",
        spaceCode,
        pairKey,
        rateError,
      );
    }
  }

  await markExchangeRatesRefreshed(spaceCode, today);
};

export const refreshSpaceExchangeRatesFromCache = async (
  api: AxiosInstance,
  spaceCode: string,
  options?: {
    force?: boolean;
    requestConfig?: AxiosRequestConfig;
  },
): Promise<void> => {
  if (!spaceCode) {
    return;
  }

  const accounts = await loadCachedAccountsResponse(spaceCode);
  const { startDate, endDate } = offlineBootstrapDateRange();
  const filterKey = buildTransactionsFilterKey({
    categoriesSerialized: serializeFilterValues([]),
    startDate,
    endDate,
    minAmount: "",
    maxAmount: "",
    searchQuery: "",
    accountNamesSerialized: serializeFilterValues([]),
    tagIdsSerialized: serializeFilterValues([]),
    entryType: "all",
  });
  const cachedTransactions = await loadCachedTransactionsInfiniteData(
    spaceCode,
    filterKey,
  );
  const transactionPages =
    cachedTransactions?.pages?.filter(
      (page): page is TransactionsPage => Boolean(page),
    ) ?? [];

  await refreshSpaceExchangeRates({
    api,
    spaceCode,
    accounts: accounts ?? { accounts: [] },
    transactionPages,
    force: options?.force,
    requestConfig: options?.requestConfig,
  });
};
