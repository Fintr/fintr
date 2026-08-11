import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import {
  buildCurrencyPairs,
  cacheCurrentExchangeRate,
  cacheRecentExchangeRates,
  loadCachedCurrentExchangeRate,
  loadCachedRecentExchangeRates,
} from "./local-db";
import { getCurrentRate, getRecentRates } from "./queries";

describe("exchange rates local DB", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
    vi.restoreAllMocks();
  });

  it("builds directed pairs across currencies", () => {
    expect(buildCurrencyPairs(["PHP", "USD", "php"])).toEqual([
      { fromCurrency: "PHP", toCurrency: "USD" },
      { fromCurrency: "USD", toCurrency: "PHP" },
    ]);
  });

  it("stores and loads current + recent rates", async () => {
    await cacheCurrentExchangeRate({
      fromCurrency: "GBP",
      toCurrency: "USD",
      date: "2026-08-08",
      payload: {
        rate: 1.25,
        from_currency: "GBP",
        to_currency: "USD",
        source: "auto",
      },
    });
    await cacheRecentExchangeRates({
      spaceId: "space-a",
      fromCurrency: "GBP",
      toCurrency: "USD",
      payload: {
        source: "recent",
        rates: [{ rate: 1.24, usedAt: "2026-08-01T00:00:00Z" }],
      },
    });

    await expect(
      loadCachedCurrentExchangeRate({
        fromCurrency: "gbp",
        toCurrency: "usd",
        date: "2026-08-08",
      }),
    ).resolves.toMatchObject({ rate: 1.25 });

    await expect(
      loadCachedRecentExchangeRates({
        spaceId: "space-a",
        fromCurrency: "GBP",
        toCurrency: "USD",
      }),
    ).resolves.toMatchObject({
      rates: [{ rate: 1.24 }],
    });
  });

  it("reads local current rate before hitting the network", async () => {
    await cacheCurrentExchangeRate({
      fromCurrency: "PHP",
      toCurrency: "USD",
      date: "2026-08-08",
      payload: {
        rate: 0.018,
        from_currency: "PHP",
        to_currency: "USD",
        source: "auto",
      },
    });

    const get = vi.fn();
    const api = { get } as never;

    const result = await getCurrentRate(api, "PHP", "USD", "2026-08-08");
    expect(result.rate).toBe(0.018);
    expect(get).not.toHaveBeenCalled();
  });

  it("falls back to the backend and stores the rate when missing locally", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        data: {
          rate: 1.1,
          fromCurrency: "EUR",
          toCurrency: "USD",
          source: "auto",
        },
      },
    });
    const api = { get } as never;

    const result = await getCurrentRate(api, "EUR", "USD", "2026-08-08");
    expect(result.rate).toBe(1.1);
    expect(get).toHaveBeenCalledOnce();

    const cached = await loadCachedCurrentExchangeRate({
      fromCurrency: "EUR",
      toCurrency: "USD",
      date: "2026-08-08",
    });
    expect(cached?.rate).toBe(1.1);

    get.mockClear();
    const second = await getCurrentRate(api, "EUR", "USD", "2026-08-08");
    expect(second.rate).toBe(1.1);
    expect(get).not.toHaveBeenCalled();
  });

  it("falls back to the backend for recent rates when missing locally", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        data: {
          source: "recent",
          rates: [{ rate: 1.05, used_at: "2026-08-02T00:00:00Z" }],
        },
      },
    });
    const api = { get } as never;

    const result = await getRecentRates(api, "EUR", "USD", {
      spaceId: "space-a",
    });
    expect(result.rates[0]?.rate).toBe(1.05);
    expect(get).toHaveBeenCalledOnce();

    get.mockClear();
    const second = await getRecentRates(api, "EUR", "USD", {
      spaceId: "space-a",
    });
    expect(second.rates[0]?.rate).toBe(1.05);
    expect(get).not.toHaveBeenCalled();
  });
});
