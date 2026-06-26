import { describe, expect, it } from "vitest";
import {
  conversionSnapshotMatchesTarget,
  createTransactionNeedsConversion,
  resolveAmountPickerTargetCurrency,
  shouldShowAmountFxInEdit,
  shouldUseStoredConversionForPreview,
  transactionNeedsConversion,
} from "./amountPickerTargetCurrency";

describe("resolveAmountPickerTargetCurrency", () => {
  it("uses account currency when amount differs from the account ledger", () => {
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

  it("uses account currency in edit mode when amount differs from account (not space)", () => {
    expect(
      resolveAmountPickerTargetCurrency({
        amountCurrency: "GBP",
        accountLedgerCurrency: "USD",
        editBookedCurrency: "USD",
        effectiveSpaceCurrency: "PHP",
        isEditMode: true,
      }),
    ).toBe("USD");
  });

  it("returns null when amount already matches the account ledger", () => {
    expect(
      resolveAmountPickerTargetCurrency({
        amountCurrency: "PHP",
        accountLedgerCurrency: "PHP",
        editBookedCurrency: "PHP",
        effectiveSpaceCurrency: "GBP",
        isEditMode: true,
      }),
    ).toBeNull();
  });

  it("falls back to space currency when no account is selected yet", () => {
    expect(
      resolveAmountPickerTargetCurrency({
        amountCurrency: "GBP",
        accountLedgerCurrency: null,
        editBookedCurrency: null,
        effectiveSpaceCurrency: "PHP",
        isEditMode: false,
      }),
    ).toBe("PHP");
  });
});

describe("conversionSnapshotMatchesTarget", () => {
  it("rejects snapshots whose target currency no longer matches", () => {
    expect(
      conversionSnapshotMatchesTarget(
        {
          originalCurrency: "GBP",
          targetCurrency: "PHP",
          exchangeRate: 80,
          exchangeRateSource: "auto",
        },
        "USD",
      ),
    ).toBe(false);
  });
});

describe("shouldUseStoredConversionForPreview", () => {
  it("skips stored rate when snapshot target differs from current target in edit mode", () => {
    expect(
      shouldUseStoredConversionForPreview({
        isEditMode: true,
        hadStoredConversion: true,
        conversionSnapshot: {
          originalCurrency: "GBP",
          targetCurrency: "PHP",
          exchangeRate: 80,
          exchangeRateSource: "manual",
        },
        targetCurrency: "USD",
        accountLedgerCurrency: "USD",
        effectiveSpaceCurrency: "PHP",
      }),
    ).toBe(false);
  });

  it("skips stored rate in create mode when account changes the target leg", () => {
    expect(
      shouldUseStoredConversionForPreview({
        isEditMode: false,
        hadStoredConversion: false,
        conversionSnapshot: {
          originalCurrency: "GBP",
          targetCurrency: "PHP",
          exchangeRate: 80.886,
          exchangeRateSource: "auto",
        },
        targetCurrency: "USD",
        accountLedgerCurrency: "USD",
        effectiveSpaceCurrency: "PHP",
      }),
    ).toBe(false);
  });

  it("uses stored rate in create mode when snapshot target still matches", () => {
    expect(
      shouldUseStoredConversionForPreview({
        isEditMode: false,
        hadStoredConversion: false,
        conversionSnapshot: {
          originalCurrency: "GBP",
          targetCurrency: "USD",
          exchangeRate: 1.27,
          exchangeRateSource: "auto",
        },
        targetCurrency: "USD",
        accountLedgerCurrency: "USD",
        effectiveSpaceCurrency: "PHP",
      }),
    ).toBe(true);
  });
});

describe("transactionNeedsConversion", () => {
  it("returns true when amount currency differs from ledger target", () => {
    expect(
      transactionNeedsConversion({
        amountCurrency: "GBP",
        targetCurrency: "USD",
      }),
    ).toBe(true);
  });
});

describe("createTransactionNeedsConversion", () => {
  it("returns true when create mode amount currency differs from ledger target", () => {
    expect(
      createTransactionNeedsConversion({
        amountCurrency: "VND",
        targetCurrency: "PHP",
        isEditMode: false,
      }),
    ).toBe(true);
  });

  it("returns false when amount matches target or in edit mode", () => {
    expect(
      createTransactionNeedsConversion({
        amountCurrency: "PHP",
        targetCurrency: "PHP",
        isEditMode: false,
      }),
    ).toBe(false);

    expect(
      createTransactionNeedsConversion({
        amountCurrency: "VND",
        targetCurrency: "PHP",
        isEditMode: true,
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
