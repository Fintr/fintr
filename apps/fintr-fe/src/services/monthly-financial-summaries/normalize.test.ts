import { describe, expect, it } from "vitest";

import {
  normalizeMonthlyFinancialSummary,
  normalizeMonthlyFinancialSummaries,
} from "./normalize";

describe("normalizeMonthlyFinancialSummaries", () => {
  it("maps snake_case bootstrap rows to camelCase totals", () => {
    expect(
      normalizeMonthlyFinancialSummary({
        id: "1",
        year: 2026,
        month: 8,
        currency: "PHP",
        fx_based: true,
        calculated_at: "2026-08-12T00:00:00.000Z",
        total_income: "12,500.00",
        total_expenses: "4,200.50",
        net_savings: "8,299.50",
        savings_percentage: 66.4,
        month_start_date: "2026-08-01",
        month_end_date: "2026-08-31",
      }),
    ).toEqual({
      id: "1",
      year: 2026,
      month: 8,
      currency: "PHP",
      fxBased: true,
      calculatedAt: "2026-08-12T00:00:00.000Z",
      totalIncome: "12,500.00",
      totalExpenses: "4,200.50",
      netSavings: "8,299.50",
      savingsPercentage: 66.4,
      monthStartDate: "2026-08-01",
      monthEndDate: "2026-08-31",
    });
  });

  it("coerces string year and month for bucket matching", () => {
    const rows = normalizeMonthlyFinancialSummaries([
      {
        id: "2",
        year: "2026",
        month: "08",
        total_income: 900,
        total_expenses: 300,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.year).toBe(2026);
    expect(rows[0]?.month).toBe(8);
    expect(rows[0]?.totalIncome).toBe(900);
  });
});
