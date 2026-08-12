import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import {
  getExchangeRatesLastRefreshDate,
  markExchangeRatesRefreshed,
} from "./local-db";
import {
  collectDatedExchangeRateRequests,
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
            rate: 56,
            from_currency: "USD",
            to_currency: "PHP",
            source: "auto",
            rates: [{ rate: 56, used_at: todayIsoDate() }],
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
