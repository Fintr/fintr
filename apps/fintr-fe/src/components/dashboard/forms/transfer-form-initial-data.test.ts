import { describe, expect, it } from "vitest";
import { ScheduleTypeEnum } from "@/constants/transactionConstants";
import type { UpdateTransferType } from "@/services/transactions/transfers/mutation";
import {
  buildTransferInitialData,
  conversionSnapshotFromTransferInitialData,
  shouldIncludeTransferExchangeRate,
  transferInitialDataSignature,
} from "./transfer-form-initial-data";

describe("transfer-form-initial-data", () => {
  const baseTransferRow = {
    id: "transfer-1",
    amount: 100,
    transactionCost: 5,
    fromAccountName: "Cash",
    toAccountName: "Gotrade",
    description: "Move funds",
    date: "2026-08-09",
    scheduleType: ScheduleTypeEnum.ONE_TIME,
    repeatInterval: "",
    description_field: "ignored",
  };

  it("builds edit seed data using the original amount when a conversion exists", () => {
    const transferConv = {
      id: "conv-1",
      originalAmount: 100,
      originalCurrency: "PHP",
      convertedAmount: 1.72,
      convertedCurrency: "USD",
      exchangeRate: 0.0172,
      source: "manual",
      rateTimestamp: "2026-08-09T00:00:00Z",
      note: null,
    };

    const initial = buildTransferInitialData(
      {
        ...baseTransferRow,
        amount: 1.72,
        hasCurrencyConversion: true,
        currencyConversion: transferConv,
      },
      transferConv,
    );

    expect(initial.amount).toBe(100);
    expect(initial.toAccountName).toBe("Gotrade");
    expect(initial.currencyConversion?.convertedCurrency).toBe("USD");
  });

  it("uses a stable signature for the same logical seed data", () => {
    const seed: UpdateTransferType = {
      id: "transfer-1",
      amount: 100,
      transactionCost: 5,
      fromAccountName: "Cash",
      toAccountName: "Gotrade",
      description: "Move funds",
      date: "2026-08-09",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
    };

    const signatureA = transferInitialDataSignature(seed);
    const signatureB = transferInitialDataSignature({ ...seed });

    expect(signatureA).toBe(signatureB);
  });

  it("changes signature when the destination account changes in seed data", () => {
    const seed: UpdateTransferType = {
      id: "transfer-1",
      amount: 100,
      transactionCost: 0,
      fromAccountName: "Cash",
      toAccountName: "Gotrade",
      date: "2026-08-09",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
    };

    const changed = {
      ...seed,
      toAccountName: "Binance",
    };

    expect(transferInitialDataSignature(seed)).not.toBe(
      transferInitialDataSignature(changed),
    );
  });

  it("builds a conversion snapshot from stored conversion metadata", () => {
    const seed: UpdateTransferType = {
      id: "transfer-1",
      amount: 100,
      transactionCost: 0,
      fromAccountName: "Cash",
      toAccountName: "Gotrade",
      date: "2026-08-09",
      scheduleType: ScheduleTypeEnum.ONE_TIME,
      currencyConversion: {
        id: "conv-1",
        originalAmount: 100,
        originalCurrency: "PHP",
        convertedAmount: 1.72,
        convertedCurrency: "USD",
        exchangeRate: 0.0172,
        source: "auto",
        rateTimestamp: "2026-08-09T00:00:00Z",
        note: null,
      },
    };

    expect(conversionSnapshotFromTransferInitialData(seed)).toEqual({
      originalCurrency: "PHP",
      targetCurrency: "USD",
      exchangeRate: 0.0172,
      exchangeRateSource: "auto",
    });
  });

  it("only includes exchange rate metadata when currencies differ", () => {
    const snapshot = {
      originalCurrency: "PHP",
      targetCurrency: "USD",
      exchangeRate: 0.0172,
      exchangeRateSource: "auto" as const,
    };

    expect(shouldIncludeTransferExchangeRate("PHP", "USD", snapshot)).toBe(
      true,
    );
    expect(shouldIncludeTransferExchangeRate("PHP", "PHP", snapshot)).toBe(
      false,
    );
    expect(shouldIncludeTransferExchangeRate("PHP", "USD", null)).toBe(false);
  });
});
