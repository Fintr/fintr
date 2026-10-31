import { describe, expect, it } from "vitest";

import { periodSummaryFromTransactionTotals } from "./transactionPeriodSummary";

describe("periodSummaryFromTransactionTotals", () => {
  it("uses income minus expense for net (positive expense totals from API)", () => {
    expect(
      periodSummaryFromTransactionTotals({
        income: 514_523.99,
        expense: 562_605.41,
        transfer: 0,
      }),
    ).toEqual({
      totalIncome: 514_523.99,
      totalExpenses: 562_605.41,
      netSavings: expect.closeTo(-48_081.42, 2),
    });
  });

  it("treats negative expense totals as increasing net income", () => {
    expect(
      periodSummaryFromTransactionTotals({
        income: 500,
        expense: -120,
        transfer: 0,
      }),
    ).toEqual({
      totalIncome: 500,
      totalExpenses: -120,
      netSavings: 620,
    });
  });
});
