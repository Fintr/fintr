import type { AxiosInstance, AxiosRequestConfig } from "axios";

import { POPULAR_CURRENCY_CODES } from "@/data/currencies";
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
  getExchangeRatesLastRefreshDate,
  markExchangeRatesRefreshed,
} from "./local-db";
import {
  fetchAndCacheBatchCurrentRates,
  fetchAndCacheRecentRates,
  type BatchCurrentRateRequest,
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
  defaultTransactionCurrency?: string | null;
  includePopularCurrencies?: boolean;
};

const addDirectedPair = (
  pairs: Map<string, { fromCurrency: string; toCurrency: string }>,
  fromCurrency: string,
  toCurrency: string,
): void => {
  if (!fromCurrency || !toCurrency || fromCurrency === toCurrency) {
    return;
  }

  pairs.set(`${fromCurrency}:${toCurrency}`, {
    fromCurrency,
    toCurrency,
  });
};

export const collectExchangeRateCurrencies = (
  params: CollectExchangeRatePairsParams,
): string[] => {
  const spaceCurrency = normalizeCurrency(params.spaceCurrency ?? "PHP");
  const accountCurrencies = extractAccountsFromResponse(params.accounts).map(
    (account) => account.balanceCurrency,
  );
  const transactionCurrencies = params.transactionPages.flatMap((page) =>
    page.transactions.flatMap((transaction) => [
      transaction.amountCurrency,
      transaction.bookedAmountCurrency,
    ]),
  );
  const includePopular = params.includePopularCurrencies !== false;

  const codes = new Set<string>([spaceCurrency]);

  for (const code of [
    ...accountCurrencies,
    ...transactionCurrencies,
    params.defaultTransactionCurrency ?? "",
    ...(includePopular ? POPULAR_CURRENCY_CODES : []),
  ]) {
    if (typeof code === "string" && code.trim()) {
      codes.add(normalizeCurrency(code));
    }
  }

  return Array.from(codes);
};

/**
 * Pairs needed for amount pickers: each amount currency → each ledger currency.
 * Includes popular/default currencies so new transactions are covered offline.
 */
export const collectExchangeRatePairs = (
  params: CollectExchangeRatePairsParams,
): Array<{ fromCurrency: string; toCurrency: string }> => {
  const spaceCurrency = normalizeCurrency(params.spaceCurrency ?? "PHP");
  const amountCurrencies = collectExchangeRateCurrencies(params);
  const ledgerCurrencies = new Set(
    extractAccountsFromResponse(params.accounts)
      .map((account) => normalizeCurrency(account.balanceCurrency))
      .filter(Boolean),
  );

  if (ledgerCurrencies.size === 0) {
    ledgerCurrencies.add(spaceCurrency);
  }

  const pairs = new Map<string, { fromCurrency: string; toCurrency: string }>();

  for (const fromCurrency of amountCurrencies) {
    for (const toCurrency of ledgerCurrencies) {
      addDirectedPair(pairs, fromCurrency, toCurrency);
    }
  }

  return Array.from(pairs.values());
};

export type RefreshSpaceExchangeRatesParams = {
  api: AxiosInstance;
  spaceCode: string;
  accounts: unknown;
  transactionPages: TransactionsPage[];
  spaceCurrency?: string;
  defaultTransactionCurrency?: string | null;
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
  const defaultTransactionCurrency =
    params.defaultTransactionCurrency
    ?? spaceContext?.defaultTransactionCurrency
    ?? null;
  const pairs = collectExchangeRatePairs({
    spaceCurrency,
    accounts,
    transactionPages,
    defaultTransactionCurrency,
  });
  const datedRequests = collectDatedExchangeRateRequests({
    spaceCurrency,
    transactionPages,
  });

  if (pairs.length === 0 && datedRequests.length === 0) {
    await markExchangeRatesRefreshed(spaceCode, today);
    return;
  }

  const batchRequests = new Map<string, BatchCurrentRateRequest>();

  for (const request of datedRequests) {
    const key = `${request.fromCurrency}:${request.toCurrency}:${request.date}`;
    batchRequests.set(key, {
      fromCurrency: request.fromCurrency,
      toCurrency: request.toCurrency,
      date: request.date,
    });
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
      const key = `${fromCurrency}:${toCurrency}:${today}`;
      batchRequests.set(key, {
        fromCurrency,
        toCurrency,
        date: today,
      });
    }
  }

  try {
    await fetchAndCacheBatchCurrentRates(
      api,
      [...batchRequests.values()],
      requestConfig,
    );
  } catch (rateError) {
    console.warn(
      "[exchange-rates] Batch dated refresh failed",
      spaceCode,
      rateError,
    );
  }

  const recentPairsDone = new Set<string>();

  for (const pairKey of pairKeys) {
    const [fromCurrency, toCurrency] = pairKey.split(":");
    if (!fromCurrency || !toCurrency) {
      continue;
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
