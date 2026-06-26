import { describe, it, expect } from "vitest";
import {
  formatIndexTransactionListAmount,
  indexTransactionDisplayMoney,
} from "./indexTransactionDisplay";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

const usdTransferRow: IndexTransaction = {
  id: "transfer-1",
  date: "2024-06-01",
  description: "USD move",
  amount: 25_000,
  amountCurrency: "PHP",
  bookedAmount: 500,
  bookedAmountCurrency: "USD",
  categoryName: "",
  fromAccountName: "USD From",
  toAccountName: "USD To",
  type: CombinedTransactionTypeEnum.TRANSFER,
  inSeries: false,
  hasImage: false,
};

describe("indexTransactionDisplayMoney", () => {
  it("uses space-normalized amount and currency by default", () => {
    const result = indexTransactionDisplayMoney(usdTransferRow, "PHP", false);

    expect(result).toEqual({ amount: 25_000, currency: "PHP" });
  });

  it("uses booked USD when showBookedCurrencies is enabled", () => {
    const result = indexTransactionDisplayMoney(usdTransferRow, "PHP", true);

    expect(result).toEqual({ amount: 500, currency: "USD" });
  });

  it("does not fall back to space currency when booked fields are present and toggle is on", () => {
    const result = indexTransactionDisplayMoney(usdTransferRow, "PHP", true);

    expect(result.currency).not.toBe("PHP");
    expect(result.amount).toBe(500);
  });

  it("falls back to space currency only when booked fields are missing", () => {
    const rowMissingBooked: IndexTransaction = {
      ...usdTransferRow,
      bookedAmount: undefined,
      bookedAmountCurrency: undefined,
    };

    const result = indexTransactionDisplayMoney(rowMissingBooked, "PHP", true);

    expect(result).toEqual({ amount: 25_000, currency: "PHP" });
  });
});

describe("formatIndexTransactionListAmount", () => {
  it("shows booked currency magnitude without a minus for type-signed expenses", () => {
    const formatted = formatIndexTransactionListAmount(-100, "GBP", true);

    expect(formatted).toBe("£100.00");
    expect(formatted.startsWith("-")).toBe(false);
  });

  it("shows booked currency magnitude for positive booked amounts", () => {
    expect(formatIndexTransactionListAmount(100, "GBP", true)).toBe("£100.00");
  });

  it("keeps an explicit minus for negative space-normalized amounts", () => {
    const formatted = formatIndexTransactionListAmount(-1000, "PHP", false);

    expect(formatted.startsWith("-")).toBe(true);
    expect(formatted).toContain("1,000.00");
  });

  it("does not prefix plus for positive space-normalized amounts", () => {
    const formatted = formatIndexTransactionListAmount(500, "USD", false);

    expect(formatted.startsWith("+")).toBe(false);
    expect(formatted).toBe("$500.00");
  });
});
