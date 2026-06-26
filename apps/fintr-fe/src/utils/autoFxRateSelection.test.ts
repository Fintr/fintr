import { describe, expect, it } from "vitest";
import {
  fxPairChanged,
  selectAutoFxRate,
  shouldPreferCurrentRateOverRecent,
} from "./autoFxRateSelection";

describe("fxPairChanged", () => {
  it("returns true when the target leg changes", () => {
    expect(
      fxPairChanged(
        { fromCurrency: "GBP", toCurrency: "PHP" },
        { fromCurrency: "GBP", toCurrency: "USD" },
      ),
    ).toBe(true);
  });

  it("returns false when the pair is unchanged", () => {
    expect(
      fxPairChanged(
        { fromCurrency: "GBP", toCurrency: "USD" },
        { fromCurrency: "GBP", toCurrency: "USD" },
      ),
    ).toBe(false);
  });
});

describe("shouldPreferCurrentRateOverRecent", () => {
  it("prefers current rate when the FX pair just changed", () => {
    expect(
      shouldPreferCurrentRateOverRecent({
        pairChanged: true,
        recentRate: 80.886,
        currentRate: 1.27,
      }),
    ).toBe(true);
  });

  it("rejects corrupted recent rates that differ wildly from the API", () => {
    expect(
      shouldPreferCurrentRateOverRecent({
        pairChanged: false,
        recentRate: 80.886,
        currentRate: 1.27,
      }),
    ).toBe(true);
  });

  it("allows recent rates close to the API quote", () => {
    expect(
      shouldPreferCurrentRateOverRecent({
        pairChanged: false,
        recentRate: 1.28,
        currentRate: 1.27,
      }),
    ).toBe(false);
  });
});

describe("selectAutoFxRate", () => {
  it("returns current rate when the pair changed", () => {
    expect(
      selectAutoFxRate({
        pairChanged: true,
        recentRates: [80.886],
        currentRate: 1.27,
      }),
    ).toEqual({ rate: 1.27, source: "auto" });
  });

  it("returns recent rate when it matches the API quote", () => {
    expect(
      selectAutoFxRate({
        pairChanged: false,
        recentRates: [1.28],
        currentRate: 1.27,
      }),
    ).toEqual({ rate: 1.28, source: "recent" });
  });

  it("falls back to current rate when there are no recent rates", () => {
    expect(
      selectAutoFxRate({
        pairChanged: false,
        recentRates: [],
        currentRate: 1.27,
      }),
    ).toEqual({ rate: 1.27, source: "auto" });
  });
});
