import { describe, expect, it } from "vitest";
import {
  conversionSnapshotFromTransactionData,
  conversionSnapshotMatchesTarget,
  createTransactionNeedsConversion,
  resolveAmountPickerTargetCurrency,
  shouldPreviewConversionOnlyInEdit,
  shouldShowAmountFxInEdit,
  shouldUseStoredConversionForPreview,
  storedConversionForEditForm,
  transactionNeedsConversion,
  withEditOriginalCurrency,
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
  it("keeps the assigned edit rate when snapshot target briefly differs from the ledger", () => {
    expect(
      shouldUseStoredConversionForPreview({
        isEditMode: true,
        hadStoredConversion: true,
        conversionSnapshot: {
          originalCurrency: "GBP",
          targetCurrency: "PHP",
          exchangeRate: 100,
          exchangeRateSource: "recent",
        },
        amountCurrency: "GBP",
        targetCurrency: "USD",
        accountLedgerCurrency: "USD",
        effectiveSpaceCurrency: "PHP",
      }),
    ).toBe(true);
  });

  it("keeps the assigned edit rate when converted currency was missing on seed", () => {
    expect(
      shouldUseStoredConversionForPreview({
        isEditMode: true,
        hadStoredConversion: true,
        conversionSnapshot: {
          originalCurrency: "GBP",
          targetCurrency: "GBP",
          exchangeRate: 100,
          exchangeRateSource: "recent",
        },
        amountCurrency: "GBP",
        targetCurrency: "PHP",
        accountLedgerCurrency: "PHP",
        effectiveSpaceCurrency: "PHP",
      }),
    ).toBe(true);
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
        amountCurrency: "GBP",
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
        amountCurrency: "GBP",
        targetCurrency: "USD",
        accountLedgerCurrency: "USD",
        effectiveSpaceCurrency: "PHP",
      }),
    ).toBe(true);
  });

  it("skips stored rate when amount currency changes but target leg stays the same", () => {
    expect(
      shouldUseStoredConversionForPreview({
        isEditMode: false,
        hadStoredConversion: false,
        conversionSnapshot: {
          originalCurrency: "VND",
          targetCurrency: "PHP",
          exchangeRate: 0.00233,
          exchangeRateSource: "auto",
        },
        amountCurrency: "USD",
        targetCurrency: "PHP",
        accountLedgerCurrency: "PHP",
        effectiveSpaceCurrency: "PHP",
      }),
    ).toBe(false);
  });
});

describe("storedConversionForEditForm", () => {
  it("returns the persisted backend rate for edit mode", () => {
    expect(
      storedConversionForEditForm({
        data: {
          original_display_currency: "GBP",
          currency_conversion: {
            original_amount: 100,
            original_currency: "GBP",
            converted_amount: 10_000,
            converted_currency: "PHP",
            exchange_rate: 100,
            source: "recent",
          },
        },
        targetCurrency: "PHP",
      }),
    ).toMatchObject({
      originalCurrency: "GBP",
      targetCurrency: "PHP",
      exchangeRate: 100,
      exchangeRateSource: "recent",
    });
  });

  it("builds a snapshot from detail money fields when top-level conversion keys are missing", () => {
    expect(
      storedConversionForEditForm({
        data: {
          amount: 10_000,
          amount_currency: "PHP",
          booked_amount: 100,
          booked_amount_currency: "GBP",
          original_display_amount: 100,
          original_display_currency: "GBP",
        },
        targetCurrency: "PHP",
      }),
    ).toMatchObject({
      originalCurrency: "GBP",
      targetCurrency: "PHP",
      exchangeRate: 100,
    });
  });

  it("infers the stored installment rate from plan total when conversion metadata is missing", () => {
    expect(
      storedConversionForEditForm({
        data: {
          amount: 10_000,
          amount_currency: "PHP",
          original_display_amount: 100,
          original_display_currency: "GBP",
          installment_total: 240_000,
          installment_period: 24,
        },
        targetCurrency: "PHP",
      }),
    ).toMatchObject({
      originalCurrency: "GBP",
      targetCurrency: "PHP",
      exchangeRate: 100,
    });
  });
});

describe("conversionSnapshotFromTransactionData", () => {
  it("derives exchange rate from persisted conversion amounts when rate field is missing", () => {
    expect(
      conversionSnapshotFromTransactionData({
        original_display_currency: "GBP",
        currency_conversion: {
          original_amount: 100,
          original_currency: "GBP",
          converted_amount: 10_000,
          converted_currency: "PHP",
          source: "recent",
        },
      }),
    ).toMatchObject({
      exchangeRate: 100,
    });
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
  it("returns true when amount currency differs from ledger target in create or edit", () => {
    expect(
      createTransactionNeedsConversion({
        amountCurrency: "VND",
        targetCurrency: "PHP",
        isEditMode: false,
      }),
    ).toBe(true);

    expect(
      createTransactionNeedsConversion({
        amountCurrency: "VND",
        targetCurrency: "PHP",
        isEditMode: true,
      }),
    ).toBe(true);
  });

  it("returns false when amount matches target", () => {
    expect(
      createTransactionNeedsConversion({
        amountCurrency: "PHP",
        targetCurrency: "PHP",
        isEditMode: false,
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

describe("shouldPreviewConversionOnlyInEdit", () => {
  it("always returns false so edit FX syncs to the parent for submit", () => {
    expect(
      shouldPreviewConversionOnlyInEdit({
        isEditMode: true,
        hadStoredConversion: false,
        targetCurrency: "USD",
        effectiveSpaceCurrency: "PHP",
      }),
    ).toBe(false);
  });
});

describe("withEditOriginalCurrency", () => {
  it("prepends the original currency when no account uses it", () => {
    expect(withEditOriginalCurrency(["PHP"], "GBP")).toEqual(["GBP", "PHP"]);
  });
});
