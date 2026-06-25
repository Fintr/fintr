import { describe, expect, it } from "vitest";
import {
  resolveAmountPickerTargetCurrency,
  shouldShowAmountFxInEdit,
  shouldUseStoredConversionForPreview,
} from "./amountPickerTargetCurrency";

describe("resolveAmountPickerTargetCurrency", () => {
  it("uses account currency when amount differs from the account ledger in create mode", () => {
    expect(
      resolveAmountPickerTargetCurrency({
        amountCurrency: "GBP",
        accountLedgerCurrency: "PHP",
        editBookedCurrency: null,
        effectiveSpaceCurrency: "GBP",
        isEditMode: false,
      }),
    ).toBe("PHP");
  });

  it("uses space currency in edit mode when amount differs from space", () => {
    expect(
      resolveAmountPickerTargetCurrency({
        amountCurrency: "USD",
        accountLedgerCurrency: "PHP",
        editBookedCurrency: "PHP",
        effectiveSpaceCurrency: "GBP",
        isEditMode: true,
      }),
    ).toBe("GBP");
  });

  it("uses space currency when amount matches account but space changed", () => {
    expect(
      resolveAmountPickerTargetCurrency({
        amountCurrency: "PHP",
        accountLedgerCurrency: "PHP",
        editBookedCurrency: "PHP",
        effectiveSpaceCurrency: "GBP",
        isEditMode: true,
      }),
    ).toBe("GBP");
  });
});

describe("shouldUseStoredConversionForPreview", () => {
  it("skips stored booking rate when edit preview targets space currency", () => {
    expect(
      shouldUseStoredConversionForPreview({
        isEditMode: true,
        hadStoredConversion: true,
        conversionSnapshot: {
          originalCurrency: "USD",
          exchangeRate: 62,
          exchangeRateSource: "manual",
        },
        targetCurrency: "GBP",
        accountLedgerCurrency: "PHP",
        effectiveSpaceCurrency: "GBP",
      }),
    ).toBe(false);
  });
});

describe("shouldShowAmountFxInEdit", () => {
  it("returns true when edit mode has a cross-currency target", () => {
    expect(
      shouldShowAmountFxInEdit({
        isEditMode: true,
        conversionSnapshot: null,
        amountCurrency: "PHP",
        targetCurrency: "GBP",
      }),
    ).toBe(true);
  });
});
