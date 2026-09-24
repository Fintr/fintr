import "fake-indexeddb/auto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";

import {
  cacheCurrentExchangeRate,
  cacheRecentExchangeRates,
} from "./local-db";
import { resolveAutoExchangeRates } from "./resolve-auto-rates";

vi.mock("./queries", () => ({
  getCurrentRate: vi.fn(),
  getRecentRates: vi.fn(),
}));

import { getCurrentRate, getRecentRates } from "./queries";

describe("resolveAutoExchangeRates", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
    vi.clearAllMocks();
  });

  it("uses local DB rates without calling the network", async () => {
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

    const resolved = await resolveAutoExchangeRates({
      api: {} as never,
      fromCurrency: "GBP",
      toCurrency: "USD",
      date: "2026-08-08",
      spaceId: "space-a",
      pairChanged: true,
    });

    expect(resolved.fromLocal).toBe(true);
    expect(resolved.appliedRate).toBe(1.25);
    expect(getCurrentRate).not.toHaveBeenCalled();
    expect(getRecentRates).not.toHaveBeenCalled();
  });

  it("prefers a cached recent rate when it is close to the cached current rate", async () => {
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

    const resolved = await resolveAutoExchangeRates({
      api: {} as never,
      fromCurrency: "GBP",
      toCurrency: "USD",
      date: "2026-08-08",
      spaceId: "space-a",
      pairChanged: false,
    });

    expect(resolved.fromLocal).toBe(true);
    expect(resolved.appliedRate).toBe(1.24);
    expect(resolved.appliedSource).toBe("recent");
    expect(getCurrentRate).not.toHaveBeenCalled();
    expect(getRecentRates).not.toHaveBeenCalled();
  });

  it("falls back to the network when local current rate is missing", async () => {
    vi.mocked(getCurrentRate).mockResolvedValue({
      rate: 1.1,
      from_currency: "EUR",
      to_currency: "USD",
      source: "auto",
    });
    vi.mocked(getRecentRates).mockResolvedValue({
      source: "recent",
      rates: [],
    });

    const resolved = await resolveAutoExchangeRates({
      api: {} as never,
      fromCurrency: "EUR",
      toCurrency: "USD",
      date: "2026-08-08",
      spaceId: "space-a",
      pairChanged: true,
    });

    expect(resolved.fromLocal).toBe(false);
    expect(resolved.appliedRate).toBe(1.1);
    expect(getCurrentRate).toHaveBeenCalledOnce();
    expect(getRecentRates).toHaveBeenCalledOnce();
  });
});
