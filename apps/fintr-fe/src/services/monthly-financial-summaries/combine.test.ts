import { describe, expect, it } from "vitest";

import { combineMonthlyFinancialSummaries } from "./combine";
import type { MonthlyFinancialSummary } from "./types";

const summary = (
  overrides: Partial<MonthlyFinancialSummary>,
): MonthlyFinancialSummary => ({
  id: "1",
  year: 2026,
  month: 7,
  currency: "PHP",
  fxBased: true,
  calculatedAt: "2026-07-31T00:00:00.000Z",
  totalIncome: 100,
  totalExpenses: 40,
  netSavings: 60,
  savingsPercentage: 60,
  monthStartDate: "2026-07-01",
  monthEndDate: "2026-07-31",
  ...overrides,
});

describe("combineMonthlyFinancialSummaries", () => {
  it("sums buckets within the inclusive month range", () => {
    const combined = combineMonthlyFinancialSummaries(
      [
        summary({
          id: "jun",
          month: 6,
          totalIncome: 50,
          totalExpenses: 10,
          monthStartDate: "2026-06-01",
          monthEndDate: "2026-06-30",
        }),
        summary({
          id: "jul",
          month: 7,
          totalIncome: 100,
          totalExpenses: 40,
        }),
        summary({
          id: "aug",
          month: 8,
          totalIncome: 200,
          totalExpenses: 80,
          monthStartDate: "2026-08-01",
          monthEndDate: "2026-08-31",
        }),
      ],
      "2026-06-01",
      "2026-07-31",
    );

    expect(combined.totalIncome).toBe("150");
    expect(combined.totalExpenses).toBe("50");
    expect(combined.netSavings).toBe("100");
    expect(combined.savingsPercentage).toBe("66.67");
  });

  it("returns zeros when no buckets match", () => {
    const combined = combineMonthlyFinancialSummaries(
      [summary({ month: 7 })],
      "2026-01-01",
      "2026-01-31",
    );

    expect(combined.totalIncome).toBe("0");
    expect(combined.totalExpenses).toBe("0");
    expect(combined.netSavings).toBe("0");
    expect(combined.calculatedAt).toBe("");
  });
});
