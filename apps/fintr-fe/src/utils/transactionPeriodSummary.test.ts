import { describe, expect, it } from "vitest";

import { periodSummaryFromTransactionTotals } from "./transactionPeriodSummary";

describe("periodSummaryFromTransactionTotals", () => {
  it("derives net from the same signed totals as the transaction chips", () => {
    expect(
      periodSummaryFromTransactionTotals({
        income: 500,
        expense: -120,
        transfer: 0,
      }),
    ).toEqual({
      totalIncome: 500,
      totalExpenses: 120,
      netSavings: 380,
    });
  });
});
