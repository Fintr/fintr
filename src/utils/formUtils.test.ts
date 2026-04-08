import { describe, it, expect } from "vitest";
import { resolvePrefillAmountCurrency, isUploadableFile } from "./formUtils";

describe("resolvePrefillAmountCurrency", () => {
  const accounts = [
    { value: "Credit Card", currency: "PHP" },
    { value: "USD Wallet", currency: "USD" },
  ];

  it("uses default_transaction_currency when it is in the allowed currency list", () => {
    expect(
      resolvePrefillAmountCurrency({
        defaultTransactionCurrency: "USD",
        amountCurrencyCodes: ["USD", "PHP"],
        accountName: "Credit Card",
        accounts,
        spaceCurrency: "PHP",
      })
    ).toBe("USD");
  });

  it("prefers default_transaction_currency over the prefilled account's space currency (add receipt case)", () => {
    expect(
      resolvePrefillAmountCurrency({
        defaultTransactionCurrency: "EUR",
        amountCurrencyCodes: ["EUR", "PHP"],
        accountName: "Credit Card",
        accounts,
        spaceCurrency: "PHP",
      })
    ).toBe("EUR");
  });

  it("falls back to account currency when default is not in the allowed list", () => {
    expect(
      resolvePrefillAmountCurrency({
        defaultTransactionCurrency: "JPY",
        amountCurrencyCodes: ["PHP"],
        accountName: "Credit Card",
        accounts,
        spaceCurrency: "PHP",
      })
    ).toBe("PHP");
  });

  it("falls back to account currency when default_transaction_currency is unset", () => {
    expect(
      resolvePrefillAmountCurrency({
        defaultTransactionCurrency: null,
        amountCurrencyCodes: ["PHP", "USD"],
        accountName: "USD Wallet",
        accounts,
        spaceCurrency: "PHP",
      })
    ).toBe("USD");
  });

  it("falls back to space currency when account is unknown", () => {
    expect(
      resolvePrefillAmountCurrency({
        defaultTransactionCurrency: null,
        amountCurrencyCodes: ["PHP"],
        accountName: "Unknown",
        accounts,
        spaceCurrency: "PHP",
      })
    ).toBe("PHP");
  });
});

describe("isUploadableFile", () => {
  it("returns true for a File object", () => {
    const file = new File(["content"], "receipt.jpg", { type: "image/jpeg" });
    expect(isUploadableFile(file)).toBe(true);
  });

  it("returns false for a draft placeholder object", () => {
    const placeholder = {
      isRemoteFile: true,
      id: "draft-file-id",
      url: "https://example.com/receipt.jpg",
      name: "receipt.jpg",
      type: "image/jpeg",
    };
    expect(isUploadableFile(placeholder)).toBe(false);
  });
});
