import { describe, expect, it } from "vitest";

import {
  mergeSummariesPreferNonEmpty,
} from "./hydrate-from-local-transactions";
import type { MonthlyFinancialSummary } from "./types";

const bucket = (
  overrides: Partial<MonthlyFinancialSummary>,
): MonthlyFinancialSummary => ({
  id: "1",
  year: 2026,
  month: 7,
  currency: "PHP",
  fxBased: true,
  calculatedAt: "2026-07-31T00:00:00.000Z",
  totalIncome: 0,
  totalExpenses: 0,
  netSavings: 0,
  savingsPercentage: 0,
  monthStartDate: "2026-07-01",
  monthEndDate: "2026-07-31",
  ...overrides,
});

describe("mergeSummariesPreferNonEmpty", () => {
  it("keeps hydrated local totals when the API returns zeros", () => {
    const merged = mergeSummariesPreferNonEmpty(
      [
        bucket({
          id: "local:2026-07",
          totalIncome: 1000,
          totalExpenses: 200,
          netSavings: 800,
        }),
      ],
      [
        bucket({
          id: "642",
          totalIncome: 0,
          totalExpenses: 0,
          netSavings: 0,
        }),
      ],
    );

    expect(merged[0]).toMatchObject({
      month: 7,
      totalIncome: 1000,
      totalExpenses: 200,
      netSavings: 800,
    });
  });
});
