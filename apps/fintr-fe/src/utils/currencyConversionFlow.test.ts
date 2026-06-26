import { describe, expect, it } from "vitest";
import {
  conversionSnapshotMatchesTarget,
  resolveAmountPickerTargetCurrency,
  shouldUseStoredConversionForPreview,
  transactionNeedsConversion,
} from "./amountPickerTargetCurrency";
import {
  fxPairChanged,
  selectAutoFxRate,
} from "./autoFxRateSelection";
import { operativeMultiplierFromManualQuote } from "./fxQuoteDisplay";

/**
 * Regression scenarios for multi-currency expense/income forms.
 * Composes the pure helpers the forms and AmountWithRatePicker rely on.
 */
describe("currency conversion flow — GBP on USD account in PHP space", () => {
  const spaceCurrency = "PHP";
  const amountCurrency = "GBP";

  it("targets space currency before an account is chosen", () => {
    expect(
      resolveAmountPickerTargetCurrency({
        amountCurrency,
        accountLedgerCurrency: null,
        editBookedCurrency: null,
        effectiveSpaceCurrency: spaceCurrency,
      }),
    ).toBe("PHP");
  });

  it("targets USD once a USD account is selected", () => {
    expect(
      resolveAmountPickerTargetCurrency({
        amountCurrency,
        accountLedgerCurrency: "USD",
        editBookedCurrency: null,
        effectiveSpaceCurrency: spaceCurrency,
      }),
    ).toBe("USD");
  });

  it("discards a PHP-target snapshot after Binance (USD) is selected", () => {
    const staleSnapshot = {
      originalCurrency: "GBP",
      targetCurrency: "PHP",
      exchangeRate: 80.886,
      exchangeRateSource: "auto" as const,
    };

    expect(
      shouldUseStoredConversionForPreview({
        isEditMode: false,
        hadStoredConversion: false,
        conversionSnapshot: staleSnapshot,
        targetCurrency: "USD",
        accountLedgerCurrency: "USD",
        effectiveSpaceCurrency: spaceCurrency,
      }),
    ).toBe(false);

    expect(
      conversionSnapshotMatchesTarget(staleSnapshot, "USD"),
    ).toBe(false);
  });

  it("detects an FX pair change from GBP→PHP to GBP→USD", () => {
    expect(
      fxPairChanged(
        { fromCurrency: "GBP", toCurrency: "PHP" },
        { fromCurrency: "GBP", toCurrency: "USD" },
      ),
    ).toBe(true);
  });

  it("prefers live GBP→USD over corrupted recent rate after account change", () => {
    const selection = selectAutoFxRate({
      pairChanged: true,
      recentRates: [80.886],
      currentRate: 1.27,
    });

    expect(selection).toEqual({ rate: 1.27, source: "auto" });
    expect(100 * selection.rate).toBeCloseTo(127, 0);
  });

  it("still needs conversion metadata when amount and account currencies differ", () => {
    expect(
      transactionNeedsConversion({
        amountCurrency,
        targetCurrency: "USD",
      }),
    ).toBe(true);
  });
});

describe("currency conversion flow — VND expense in PHP space", () => {
  it("targets PHP when account is also PHP", () => {
    expect(
      resolveAmountPickerTargetCurrency({
        amountCurrency: "VND",
        accountLedgerCurrency: "PHP",
        editBookedCurrency: null,
        effectiveSpaceCurrency: "PHP",
      }),
    ).toBe("PHP");
  });

  it("interprets manual VND-per-PHP entry as divide (operative multiplier)", () => {
    const operative = operativeMultiplierFromManualQuote(405, 0.00233);

    expect(operative).toBeCloseTo(1 / 405, 6);
    expect(20_000 * operative).toBeCloseTo(49.38, 1);
  });
});
