import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { cacheAccountsResponse } from "@/services/transactions/accounts/local-cache";
import {
  buildTransactionsFilterKey,
  cacheTransactionsAllPages,
} from "@/services/transactions/local-cache";
import { cacheSpaceContext } from "@/services/spaces/spaces-list-cache";
import { serializeFilterValues } from "@/utils/transactionFilterValues";
import type { TransactionsPage } from "@/types/transactionTypes";

import {
  getExchangeRatesLastRefreshDate,
  loadCachedCurrentExchangeRate,
  loadCachedRecentExchangeRates,
  markExchangeRatesRefreshed,
} from "./local-db";
import {
  refreshSpaceExchangeRates,
  refreshSpaceExchangeRatesFromCache,
} from "./prefetch-space-rates";
import { getCurrentRate, getRecentRates } from "./queries";
import { resolveAutoExchangeRates } from "./resolve-auto-rates";
import * as networkGuard from "./network-guard";

const SPACE_CODE = "space-fx-sync";
const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);
const yesterdayIsoDate = (): string => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
};

type ExchangeRateApiRates = {
  current: Record<string, number>;
  recent: Record<string, Array<{ rate: number; used_at: string }>>;
};

const currentRateKey = (
  fromCurrency: string,
  toCurrency: string,
  date: string,
): string => `${fromCurrency}:${toCurrency}:${date}`;

const recentRateKey = (fromCurrency: string, toCurrency: string): string =>
  `${fromCurrency}:${toCurrency}`;

const createExchangeRatesApi = (rates: ExchangeRateApiRates) => ({
  get: vi.fn(async (path: string, config?: { params?: Record<string, string> }) => {
    if (path !== "/exchange_rates/current" && path !== "/exchange_rates/recent") {
      throw new Error(`Unexpected API path: ${path}`);
    }

    const fromCurrency = config?.params?.from_currency ?? "";
    const toCurrency = config?.params?.to_currency ?? "";

    if (path === "/exchange_rates/current") {
      const date = config?.params?.date ?? todayIsoDate();
      const key = currentRateKey(fromCurrency, toCurrency, date);
      const rate =
        rates.current[key]
        ?? rates.current[currentRateKey(fromCurrency, toCurrency, todayIsoDate())];

      return {
        data: {
          data: {
            rate,
            from_currency: fromCurrency,
            to_currency: toCurrency,
            source: "auto",
            timestamp: `${date}T00:00:00.000Z`,
          },
        },
      };
    }

    const key = recentRateKey(fromCurrency, toCurrency);

    return {
      data: {
        data: {
          source: "last_prices",
          rates: rates.recent[key] ?? [],
        },
      },
    };
  }),
  post: vi.fn(async (path: string, body?: { requests?: Array<Record<string, string>> }) => {
    if (path !== "/exchange_rates/batch") {
      throw new Error(`Unexpected API path: ${path}`);
    }

    const batchRates = (body?.requests ?? []).map((request) => {
      const fromCurrency = request.from_currency ?? "";
      const toCurrency = request.to_currency ?? "";
      const date = request.date ?? todayIsoDate();
      const key = currentRateKey(fromCurrency, toCurrency, date);
      const rate =
        rates.current[key]
        ?? rates.current[currentRateKey(fromCurrency, toCurrency, todayIsoDate())];

      return {
        rate,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        date,
        source: "auto",
        timestamp: `${date}T00:00:00.000Z`,
      };
    });

    return {
      data: {
        data: {
          rates: batchRates,
          errors: [],
        },
      },
    };
  }),
});

const phpAccounts = {
  accounts: [
    {
      id: "acct-php",
      name: "Cash",
      balance: "0",
      balanceCurrency: "PHP",
      accountCategory: "cash",
    },
  ],
};

const gbpTransactionPages = (): TransactionsPage[] => [
  {
    transactions: [
      {
        id: "tx-gbp-1",
        date: "2026-03-15",
        bookedAmountCurrency: "GBP",
        amountCurrency: "PHP",
      } as never,
      {
        id: "tx-gbp-2",
        date: "2026-04-02",
        bookedAmountCurrency: "GBP",
        amountCurrency: "PHP",
      } as never,
    ],
    nextPage: null,
    totalPages: 1,
    totalCount: 2,
  },
];

describe("exchange rates sync integration", () => {
  beforeEach(async () => {
    await resetLocalDbForTests();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
    vi.restoreAllMocks();
  });

  describe("bootstrap sync", () => {
    it("fetches historical, today, and recent rates from the API and serves them offline", async () => {
      const today = todayIsoDate();
      const apiRates: ExchangeRateApiRates = {
        current: {
          [currentRateKey("GBP", "PHP", "2026-03-15")]: 74.2,
          [currentRateKey("GBP", "PHP", "2026-04-02")]: 75.1,
          [currentRateKey("GBP", "PHP", today)]: 76.4,
        },
        recent: {
          [recentRateKey("GBP", "PHP")]: [],
        },
      };
      const api = createExchangeRatesApi(apiRates);

      await refreshSpaceExchangeRates({
        api: api as never,
        spaceCode: SPACE_CODE,
        accounts: phpAccounts,
        transactionPages: gbpTransactionPages(),
        spaceCurrency: "PHP",
        defaultTransactionCurrency: "GBP",
        force: true,
      });

      const batchCalls = api.post.mock.calls.filter(
        ([path]) => path === "/exchange_rates/batch",
      );
      const recentCalls = api.get.mock.calls.filter(
        ([path]) => path === "/exchange_rates/recent",
      );

      expect(batchCalls).toHaveLength(1);
      expect(batchCalls[0]?.[1]?.requests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            from_currency: "GBP",
            to_currency: "PHP",
            date: "2026-03-15",
          }),
          expect.objectContaining({
            from_currency: "GBP",
            to_currency: "PHP",
            date: "2026-04-02",
          }),
        ]),
      );
      expect(recentCalls).toContainEqual([
        "/exchange_rates/recent",
        expect.objectContaining({
          params: expect.objectContaining({
            from_currency: "GBP",
            to_currency: "PHP",
          }),
        }),
      ]);

      api.get.mockClear();

      await expect(
        loadCachedCurrentExchangeRate({
          fromCurrency: "GBP",
          toCurrency: "PHP",
          date: "2026-03-15",
        }),
      ).resolves.toMatchObject({ rate: 74.2 });

      await expect(
        getCurrentRate(api as never, "GBP", "PHP", "2026-03-15"),
      ).resolves.toMatchObject({ rate: 74.2 });
      expect(api.get).not.toHaveBeenCalled();

      await expect(
        getRecentRates(api as never, "GBP", "PHP", { spaceId: SPACE_CODE }),
      ).resolves.toMatchObject({
        rates: [],
      });
      expect(api.get).not.toHaveBeenCalled();

      const resolved = await resolveAutoExchangeRates({
        api: api as never,
        fromCurrency: "GBP",
        toCurrency: "PHP",
        date: "2026-03-15",
        spaceId: SPACE_CODE,
        pairChanged: false,
      });

      expect(resolved.fromLocal).toBe(true);
      expect(resolved.appliedRate).toBe(74.2);
      expect(resolved.appliedSource).toBe("auto");
      expect(api.get).not.toHaveBeenCalled();
    });
  });

  describe("daily online refresh", () => {
    it("refetches when the last refresh was on a previous day", async () => {
      const today = todayIsoDate();
      const api = createExchangeRatesApi({
        current: {
          [currentRateKey("GBP", "PHP", today)]: 76.4,
        },
        recent: {
          [recentRateKey("GBP", "PHP")]: [],
        },
      });

      await markExchangeRatesRefreshed(SPACE_CODE, yesterdayIsoDate());

      await refreshSpaceExchangeRates({
        api: api as never,
        spaceCode: SPACE_CODE,
        accounts: phpAccounts,
        transactionPages: [],
        spaceCurrency: "PHP",
        defaultTransactionCurrency: "GBP",
        force: false,
      });

      expect(api.get).toHaveBeenCalled();
      expect(await getExchangeRatesLastRefreshDate(SPACE_CODE)).toBe(today);
    });

    it("skips network when already refreshed today unless force is true", async () => {
      const today = todayIsoDate();
      const api = createExchangeRatesApi({
        current: {
          [currentRateKey("GBP", "PHP", today)]: 76.4,
        },
        recent: {
          [recentRateKey("GBP", "PHP")]: [],
        },
      });

      await markExchangeRatesRefreshed(SPACE_CODE, today);

      await refreshSpaceExchangeRates({
        api: api as never,
        spaceCode: SPACE_CODE,
        accounts: phpAccounts,
        transactionPages: [],
        spaceCurrency: "PHP",
        defaultTransactionCurrency: "GBP",
        force: false,
      });

      expect(api.get).not.toHaveBeenCalled();

      await refreshSpaceExchangeRates({
        api: api as never,
        spaceCode: SPACE_CODE,
        accounts: phpAccounts,
        transactionPages: [],
        spaceCurrency: "PHP",
        defaultTransactionCurrency: "GBP",
        force: true,
      });

      expect(api.get).toHaveBeenCalled();
    });

    it("refreshes from cached bootstrap data when coming back online", async () => {
      const today = todayIsoDate();
      const api = createExchangeRatesApi({
        current: {
          [currentRateKey("USD", "PHP", today)]: 58.2,
        },
        recent: {
          [recentRateKey("USD", "PHP")]: [],
        },
      });

      await cacheSpaceContext(SPACE_CODE, {
        id: "space-1",
        name: "Test",
        code: SPACE_CODE,
        currency: "PHP",
        defaultTransactionCurrency: "USD",
      } as never);
      await cacheAccountsResponse(SPACE_CODE, phpAccounts);

      const filterKey = buildTransactionsFilterKey({
        categoriesSerialized: serializeFilterValues([]),
        startDate: "2000-01-01",
        endDate: "2099-12-31",
        minAmount: "",
        maxAmount: "",
        searchQuery: "",
        accountNamesSerialized: serializeFilterValues([]),
        tagIdsSerialized: serializeFilterValues([]),
        entryType: "all",
      });
      await cacheTransactionsAllPages(SPACE_CODE, filterKey, gbpTransactionPages());

      await markExchangeRatesRefreshed(SPACE_CODE, yesterdayIsoDate());

      await refreshSpaceExchangeRatesFromCache(api as never, SPACE_CODE, {
        force: false,
      });

      expect(api.get).toHaveBeenCalled();
      await expect(
        loadCachedCurrentExchangeRate({
          fromCurrency: "USD",
          toCurrency: "PHP",
          date: today,
        }),
      ).resolves.toMatchObject({ rate: 58.2 });
    });
  });

  describe("user manual and recent rates", () => {
    it("caches manual rates from the recent endpoint and can apply them offline", async () => {
      const today = todayIsoDate();
      const manualRate = 200;
      const apiRates: ExchangeRateApiRates = {
        current: {
          [currentRateKey("GBP", "PHP", today)]: 76.4,
        },
        recent: {
          [recentRateKey("GBP", "PHP")]: [
            { rate: manualRate, used_at: "2026-07-01T10:00:00.000Z" },
          ],
        },
      };
      const api = createExchangeRatesApi(apiRates);

      await refreshSpaceExchangeRates({
        api: api as never,
        spaceCode: SPACE_CODE,
        accounts: phpAccounts,
        transactionPages: [],
        spaceCurrency: "PHP",
        defaultTransactionCurrency: "GBP",
        force: true,
      });

      api.get.mockClear();

      await expect(
        loadCachedRecentExchangeRates({
          spaceId: SPACE_CODE,
          fromCurrency: "GBP",
          toCurrency: "PHP",
        }),
      ).resolves.toMatchObject({
        rates: [{ rate: manualRate }],
      });

      const resolved = await resolveAutoExchangeRates({
        api: api as never,
        fromCurrency: "GBP",
        toCurrency: "PHP",
        date: today,
        spaceId: SPACE_CODE,
        pairChanged: false,
      });

      expect(resolved.fromLocal).toBe(true);
      expect(resolved.recent.rates?.[0]?.rate).toBe(manualRate);
      expect(resolved.appliedRate).toBe(76.4);
      expect(resolved.appliedSource).toBe("auto");
      expect(api.get).not.toHaveBeenCalled();
    });

    it("prefers a recent manual rate when it is close to today's quote", async () => {
      const today = todayIsoDate();
      const manualRate = 76.8;
      const apiRates: ExchangeRateApiRates = {
        current: {
          [currentRateKey("GBP", "PHP", today)]: 76.4,
        },
        recent: {
          [recentRateKey("GBP", "PHP")]: [
            { rate: manualRate, used_at: "2026-07-01T10:00:00.000Z" },
          ],
        },
      };
      const api = createExchangeRatesApi(apiRates);

      await refreshSpaceExchangeRates({
        api: api as never,
        spaceCode: SPACE_CODE,
        accounts: phpAccounts,
        transactionPages: [],
        spaceCurrency: "PHP",
        defaultTransactionCurrency: "GBP",
        force: true,
      });

      api.get.mockClear();

      const resolved = await resolveAutoExchangeRates({
        api: api as never,
        fromCurrency: "GBP",
        toCurrency: "PHP",
        date: today,
        spaceId: SPACE_CODE,
        pairChanged: false,
      });

      expect(resolved.appliedRate).toBe(manualRate);
      expect(resolved.appliedSource).toBe("recent");
      expect(api.get).not.toHaveBeenCalled();
    });
  });

  describe("offline reads", () => {
    it("does not call the network for current or recent rates when offline", async () => {
      const today = todayIsoDate();
      const offlineSpy = vi
        .spyOn(networkGuard, "canFetchExchangeRatesFromNetwork")
        .mockReturnValue(false);

      const api = createExchangeRatesApi({
        current: {},
        recent: {},
      });

      await expect(
        getCurrentRate(api as never, "GBP", "PHP", today),
      ).rejects.toThrow("Exchange rate is not available offline");
      await expect(
        getRecentRates(api as never, "GBP", "PHP", { spaceId: SPACE_CODE }),
      ).resolves.toEqual({ rates: [], source: "recent" });
      expect(api.get).not.toHaveBeenCalled();

      offlineSpy.mockRestore();
    });

    it("serves cached rates offline without network requests", async () => {
      const today = todayIsoDate();
      const apiRates: ExchangeRateApiRates = {
        current: {
          [currentRateKey("AUD", "PHP", today)]: 38.5,
        },
        recent: {
          [recentRateKey("AUD", "PHP")]: [
            { rate: 38.2, used_at: "2026-07-01T10:00:00.000Z" },
          ],
        },
      };
      const api = createExchangeRatesApi(apiRates);

      await refreshSpaceExchangeRates({
        api: api as never,
        spaceCode: SPACE_CODE,
        accounts: phpAccounts,
        transactionPages: [],
        spaceCurrency: "PHP",
        defaultTransactionCurrency: "AUD",
        force: true,
      });

      api.get.mockClear();
      const offlineSpy = vi
        .spyOn(networkGuard, "canFetchExchangeRatesFromNetwork")
        .mockReturnValue(false);

      await expect(
        getCurrentRate(api as never, "AUD", "PHP", today),
      ).resolves.toMatchObject({ rate: 38.5 });
      await expect(
        getRecentRates(api as never, "AUD", "PHP", { spaceId: SPACE_CODE }),
      ).resolves.toMatchObject({
        rates: [{ rate: 38.2 }],
      });
      expect(api.get).not.toHaveBeenCalled();

      offlineSpy.mockRestore();
    });
  });
});
