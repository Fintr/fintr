import { describe, expect, it } from "vitest";

import {
  moneyFieldsFromDetailPayload,
  parseCurrencyConversion,
  transactionViewMoney,
} from "./transactionViewMoney";

describe("transactionViewMoney", () => {
  it("uses the booked original amount when currencies differ", () => {
    const result = transactionViewMoney(
      {
        amount: 20_000,
        amountCurrency: "PHP",
        bookedAmount: 280,
        bookedAmountCurrency: "GBP",
      },
      "PHP",
    );

    expect(result.hasConversion).toBe(true);
    expect(result.originalAmount).toBe(280);
    expect(result.originalCurrency).toBe("GBP");
    expect(result.convertedAmount).toBe(20_000);
    expect(result.convertedCurrency).toBe("PHP");
    expect(result.exchangeRate).toBeCloseTo(20_000 / 280);
  });

  it("prefers the stored conversion rate over a computed ratio", () => {
    const result = transactionViewMoney(
      {
        amount: 20_000,
        amountCurrency: "PHP",
        bookedAmount: 280,
        bookedAmountCurrency: "GBP",
        currencyConversion: {
          originalAmount: 280,
          originalCurrency: "GBP",
          convertedAmount: 20_000,
          convertedCurrency: "PHP",
          exchangeRate: 71.428571,
          source: "manual",
        },
      },
      "PHP",
    );

    expect(result.exchangeRate).toBeCloseTo(71.428571);
    expect(result.source).toBe("manual");
  });

  it("keeps GBP 200 when booked leg is correct but converted leg matches the original", () => {
    const result = transactionViewMoney(
      {
        amount: 200,
        amountCurrency: "PHP",
        bookedAmount: 200,
        bookedAmountCurrency: "GBP",
        currencyConversion: {
          originalAmount: 200,
          originalCurrency: "GBP",
          convertedAmount: 200,
          convertedCurrency: "PHP",
          exchangeRate: 100,
          source: "manual",
        },
      },
      "PHP",
    );

    expect(result.hasConversion).toBe(true);
    expect(result.originalAmount).toBe(200);
    expect(result.originalCurrency).toBe("GBP");
    expect(result.convertedAmount).toBe(20_000);
    expect(result.convertedCurrency).toBe("PHP");
    expect(result.exchangeRate).toBe(100);
  });

  it("recovers GBP 200 when conversion stored the PHP magnitude as the original", () => {
    const result = transactionViewMoney(
      {
        amount: 20_000,
        amountCurrency: "PHP",
        bookedAmount: 20_000,
        bookedAmountCurrency: "PHP",
        currencyConversion: {
          originalAmount: 20_000,
          originalCurrency: "GBP",
          convertedAmount: 20_000,
          convertedCurrency: "PHP",
          exchangeRate: 100,
          source: "recent",
        },
      },
      "PHP",
    );

    expect(result.hasConversion).toBe(true);
    expect(result.originalAmount).toBeCloseTo(200);
    expect(result.originalCurrency).toBe("GBP");
    expect(result.convertedAmount).toBe(20_000);
    expect(result.convertedCurrency).toBe("PHP");
    expect(result.exchangeRate).toBe(100);
    expect(result.source).toBe("recent");
  });

  it("shows a single amount when booked and space currencies match", () => {
    const result = transactionViewMoney(
      {
        amount: 20_000,
        amountCurrency: "PHP",
        bookedAmount: 20_000,
        bookedAmountCurrency: "PHP",
      },
      "PHP",
    );

    expect(result.hasConversion).toBe(false);
    expect(result.originalAmount).toBe(20_000);
    expect(result.originalCurrency).toBe("PHP");
    expect(result.convertedAmount).toBeNull();
  });
});

describe("parseCurrencyConversion", () => {
  it("reads camelCase conversion payloads", () => {
    expect(
      parseCurrencyConversion({
        currencyConversion: {
          originalAmount: 10,
          originalCurrency: "USD",
          convertedAmount: 580,
          convertedCurrency: "PHP",
          exchangeRate: 58,
          source: "auto",
        },
      }),
    ).toMatchObject({
      originalAmount: 10,
      originalCurrency: "USD",
      convertedAmount: 580,
      convertedCurrency: "PHP",
      exchangeRate: 58,
      source: "auto",
    });
  });
});

describe("moneyFieldsFromDetailPayload", () => {
  it("uses original_display as the booked GBP leg", () => {
    const money = moneyFieldsFromDetailPayload({
      amount: 20_000,
      amountCurrency: "PHP",
      amountInSpaceCurrency: { amount: 20_000, currency: "PHP" },
      originalDisplayAmount: 200,
      originalDisplayCurrency: "GBP",
      currencyConversion: {
        originalAmount: 200,
        originalCurrency: "GBP",
        convertedAmount: 20_000,
        convertedCurrency: "PHP",
        exchangeRate: 100,
        source: "recent",
      },
    });

    expect(money.bookedAmount).toBe(200);
    expect(money.bookedAmountCurrency).toBe("GBP");
    expect(money.amount).toBe(20_000);
    expect(money.amountCurrency).toBe("PHP");
    expect(money.currencyConversion?.originalAmount).toBe(200);
  });
});
