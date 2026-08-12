import { describe, expect, it } from "vitest";

import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  aggregateTotalsInSpaceForRange,
  amountNumericForSpaceTotal,
  summaryFromTransactionsForSpace,
} from "./transaction-space-totals";

const tx = (
  overrides: Partial<IndexTransaction>,
): IndexTransaction => ({
  id: "1",
  date: "2026-07-15",
  description: "",
  amount: 100,
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  ...overrides,
});

describe("transaction-space-totals", () => {
  it("sums income and expenses in space currency for same-currency rows", () => {
    const summary = summaryFromTransactionsForSpace(
      [
        tx({
          id: "in",
          type: CombinedTransactionTypeEnum.INCOME,
          amount: 1000,
        }),
        tx({ id: "out", amount: 200 }),
      ],
      "PHP",
    );

    expect(summary).toEqual({
      totalIncome: 1000,
      totalExpenses: 200,
      netSavings: 800,
    });
  });

  it("converts booked foreign amounts using cached rates", () => {
    const rateLookup = (from: string, to: string, date: string) => {
      if (from === "USD" && to === "PHP" && date === "2026-07-15") {
        return 58;
      }

      return undefined;
    };

    const converted = amountNumericForSpaceTotal(
      tx({
        bookedAmount: 10,
        bookedAmountCurrency: "USD",
        amount: 580,
        amountCurrency: "PHP",
      }),
      "PHP",
      rateLookup,
    );

    expect(converted).toBe(580);
  });

  it("falls back to space display amount when FX rates are unavailable offline", () => {
    const converted = amountNumericForSpaceTotal(
      tx({
        bookedAmount: 10,
        bookedAmountCurrency: "USD",
        amount: 580,
        amountCurrency: "PHP",
      }),
      "PHP",
      () => undefined,
    );

    expect(converted).toBe(580);
  });

  it("prefers space-normalized amount over stale cached FX when amountCurrency is space", () => {
    const converted = amountNumericForSpaceTotal(
      tx({
        bookedAmount: 200,
        bookedAmountCurrency: "GBP",
        amount: 200_000,
        amountCurrency: "PHP",
      }),
      "PHP",
      () => 100,
    );

    expect(converted).toBe(200_000);
  });

  it("groups by currency and date like AggregateTotalsInSpaceForRange", () => {
    const rateLookup = (from: string, to: string) => {
      if (from === "USD" && to === "PHP") {
        return 50;
      }

      return undefined;
    };

    const totals = aggregateTotalsInSpaceForRange(
      [
        tx({
          id: "a",
          date: "2026-07-01",
          bookedAmount: 10,
          bookedAmountCurrency: "USD",
        }),
        tx({
          id: "b",
          date: "2026-07-01",
          bookedAmount: 5,
          bookedAmountCurrency: "USD",
        }),
      ],
      "2026-07-01",
      "2026-07-31",
      "PHP",
      rateLookup,
    );

    expect(totals.totalExpenses).toBe(750);
  });
});
