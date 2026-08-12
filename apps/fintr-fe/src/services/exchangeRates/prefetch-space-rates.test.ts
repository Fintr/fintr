import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import {
  getExchangeRatesLastRefreshDate,
  markExchangeRatesRefreshed,
} from "./local-db";
import {
  collectDatedExchangeRateRequests,
  collectExchangeRatePairs,
  refreshSpaceExchangeRates,
} from "./prefetch-space-rates";

const todayIsoDate = (): string => new Date().toISOString().slice(0, 10);

describe("refreshSpaceExchangeRates", () => {
  beforeEach(async () => {
    await resetLocalDbForTests();
    vi.restoreAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
    vi.restoreAllMocks();
  });

  it("skips network when already refreshed today", async () => {
    await markExchangeRatesRefreshed("SPACE_1", todayIsoDate());

    const api = {
      get: vi.fn(),
    };

    await refreshSpaceExchangeRates({
      api: api as never,
      spaceCode: "SPACE_1",
      accounts: { accounts: [{ balanceCurrency: "PHP" }] },
      transactionPages: [],
      spaceCurrency: "PHP",
      force: false,
    });

    expect(api.get).not.toHaveBeenCalled();
    expect(await getExchangeRatesLastRefreshDate("SPACE_1")).toBe(todayIsoDate());
  });

  it("forces refresh when force is true", async () => {
    await markExchangeRatesRefreshed("SPACE_1", todayIsoDate());

    const api = {
      get: vi.fn().mockResolvedValue({
        data: {
          data: {
            rates: [{ rate: 56, used_at: todayIsoDate() }],
            source: "recent",
          },
        },
      }),
      post: vi.fn().mockResolvedValue({
        data: {
          data: {
            rates: [
              {
                rate: 56,
                from_currency: "USD",
                to_currency: "PHP",
                date: todayIsoDate(),
                source: "auto",
              },
            ],
            errors: [],
          },
        },
      }),
    };

    await refreshSpaceExchangeRates({
      api: api as never,
      spaceCode: "SPACE_1",
      accounts: { accounts: [{ balanceCurrency: "USD" }] },
      transactionPages: [],
      spaceCurrency: "PHP",
      force: true,
    });

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post.mock.calls[0]?.[0]).toBe("/exchange_rates/batch");
    expect(api.post.mock.calls[0]?.[1]?.requests?.length).toBeGreaterThan(0);
    expect(api.get).toHaveBeenCalled();
  });
});

describe("collectDatedExchangeRateRequests", () => {
  it("collects one dated request per foreign currency and transaction day", () => {
    const requests = collectDatedExchangeRateRequests({
      spaceCurrency: "PHP",
      transactionPages: [
        {
          transactions: [
            {
              id: "a",
              date: "2026-03-15",
              bookedAmountCurrency: "USD",
              amountCurrency: "PHP",
            } as never,
            {
              id: "b",
              date: "2026-04-02",
              bookedAmountCurrency: "USD",
              amountCurrency: "PHP",
            } as never,
          ],
          nextPage: null,
          totalPages: 1,
          totalCount: 2,
        },
      ],
    });

    expect(requests).toEqual([
      {
        fromCurrency: "USD",
        toCurrency: "PHP",
        date: "2026-03-15",
      },
      {
        fromCurrency: "USD",
        toCurrency: "PHP",
        date: "2026-04-02",
      },
    ]);
  });
});

describe("collectExchangeRatePairs", () => {
  it("includes popular currencies toward the space currency for PHP-only accounts", () => {
    const pairs = collectExchangeRatePairs({
      spaceCurrency: "PHP",
      accounts: { accounts: [{ balanceCurrency: "PHP" }] },
      transactionPages: [],
    });

    expect(pairs).toContainEqual({
      fromCurrency: "GBP",
      toCurrency: "PHP",
    });
    expect(pairs).toContainEqual({
      fromCurrency: "USD",
      toCurrency: "PHP",
    });
    expect(pairs.some((pair) => pair.fromCurrency === "PHP")).toBe(false);
  });

  it("includes default transaction currency toward account ledger currencies", () => {
    const pairs = collectExchangeRatePairs({
      spaceCurrency: "PHP",
      accounts: { accounts: [{ balanceCurrency: "PHP" }] },
      transactionPages: [],
      defaultTransactionCurrency: "GBP",
    });

    expect(pairs).toContainEqual({
      fromCurrency: "GBP",
      toCurrency: "PHP",
    });
  });
});
