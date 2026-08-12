import { describe, expect, it } from "vitest";

import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  dateRangePieces,
  financialTrendsDateRange,
  insightsSummaryFromMonthlyBuckets,
  insightsSummaryHybrid,
  monthlySpendingFromBuckets,
  monthlySpendingFromTransactions,
  splitDateRangeIntoMonthSegments,
} from "./from-monthly-buckets";

const bucket = (
  overrides: Partial<MonthlyFinancialSummary>,
): MonthlyFinancialSummary => ({
  id: "1",
  year: 2026,
  month: 6,
  currency: "PHP",
  fxBased: true,
  calculatedAt: "2026-06-30T00:00:00.000Z",
  totalIncome: 100,
  totalExpenses: 40,
  netSavings: 60,
  savingsPercentage: 60,
  monthStartDate: "2026-06-01",
  monthEndDate: "2026-06-30",
  ...overrides,
});

describe("insights from monthly buckets", () => {
  it("sums the selected range for the summary cards", () => {
    expect(
      insightsSummaryFromMonthlyBuckets(
        [
          bucket({ month: 6, totalIncome: 100, totalExpenses: 40 }),
          bucket({
            id: "2",
            month: 7,
            totalIncome: 50,
            totalExpenses: 10,
            monthStartDate: "2026-07-01",
            monthEndDate: "2026-07-31",
          }),
        ],
        "2026-06-01",
        "2026-06-30",
      ),
    ).toEqual({
      totalIncome: 100,
      totalExpenses: 40,
      netSavings: 60,
    });
  });

  it("anchors financial trends to the filtered month", () => {
    expect(financialTrendsDateRange("2026-02-28")).toEqual({
      startDate: "2025-09-01",
      endDate: "2026-02-28",
    });
  });

  it("builds monthly spending rows for charts", () => {
    expect(
      monthlySpendingFromBuckets(
        [
          bucket({ month: 6, totalIncome: 100, totalExpenses: 40 }),
          bucket({
            id: "2",
            month: 7,
            totalIncome: 50,
            totalExpenses: 10,
            monthStartDate: "2026-07-01",
            monthEndDate: "2026-07-31",
          }),
        ],
        "2026-06-01",
        "2026-07-31",
      ),
    ).toEqual([
      { month: "Jun", income: 100, expenses: 40, savings: 60 },
      { month: "Jul", income: 50, expenses: 10, savings: 40 },
    ]);
  });

  it("maps filtered category amounts onto the expense series without savings", () => {
    expect(
      monthlySpendingFromTransactions(
        [
          {
            id: "1",
            date: "2026-06-15",
            description: "Groceries",
            amount: 500,
            categoryName: "Food",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.EXPENSE,
            inSeries: false,
            hasImage: false,
          },
          {
            id: "2",
            date: "2026-07-10",
            description: "More food",
            amount: 200,
            categoryName: "Food",
            fromAccountName: "Cash",
            toAccountName: "",
            type: CombinedTransactionTypeEnum.EXPENSE,
            inSeries: false,
            hasImage: false,
          },
        ],
        "2026-06-01",
        "2026-07-31",
        "expense",
      ),
    ).toEqual([
      { month: "Jun", income: 0, expenses: 500, savings: 0 },
      { month: "Jul", income: 0, expenses: 200, savings: 0 },
    ]);
  });

  it("maps filtered category amounts onto the income series without savings", () => {
    expect(
      monthlySpendingFromTransactions(
        [
          {
            id: "1",
            date: "2026-06-01",
            description: "Salary",
            amount: 50000,
            categoryName: "Salary",
            fromAccountName: "",
            toAccountName: "Cash",
            type: CombinedTransactionTypeEnum.INCOME,
            inSeries: false,
            hasImage: false,
          },
        ],
        "2026-06-01",
        "2026-07-31",
        "income",
      ),
    ).toEqual([
      { month: "Jun", income: 50000, expenses: 0, savings: 0 },
      { month: "Jul", income: 0, expenses: 0, savings: 0 },
    ]);
  });

  describe("dateRangePieces", () => {
    it("treats a single calendar month as one partial slice (backend parity)", () => {
      expect(dateRangePieces("2026-08-01", "2026-08-31")).toEqual({
        firstStart: "2026-08-01",
        firstEnd: "2026-08-31",
        lastStart: null,
        lastEnd: null,
        fullMonthDates: [],
      });
    });

    it("splits Aug 1 – Sep 5 into a full August month and partial September", () => {
      expect(dateRangePieces("2026-08-01", "2026-09-05")).toEqual({
        firstStart: null,
        firstEnd: null,
        lastStart: "2026-09-01",
        lastEnd: "2026-09-05",
        fullMonthDates: ["2026-08-01"],
      });
    });
  });

  describe("splitDateRangeIntoMonthSegments", () => {
    it("splits Aug 1 – Sep 5 into a full August month and partial September", () => {
      expect(
        splitDateRangeIntoMonthSegments("2026-08-01", "2026-09-05"),
      ).toEqual([
        { kind: "full_month", year: 2026, month: 8 },
        { kind: "partial", startDate: "2026-09-01", endDate: "2026-09-05" },
      ]);
    });

    it("returns a single partial segment for a week inside one month", () => {
      expect(
        splitDateRangeIntoMonthSegments("2026-08-04", "2026-08-10"),
      ).toEqual([
        { kind: "partial", startDate: "2026-08-04", endDate: "2026-08-10" },
      ]);
    });

    it("returns twelve full months for a calendar year", () => {
      const segments = splitDateRangeIntoMonthSegments(
        "2025-01-01",
        "2025-12-31",
      );

      expect(segments).toHaveLength(12);
      expect(segments.every((segment) => segment.kind === "full_month")).toBe(
        true,
      );
    });
  });

  describe("insightsSummaryHybrid", () => {
    const tx = (
      overrides: Partial<IndexTransaction>,
    ): IndexTransaction => ({
      id: "1",
      date: "2026-08-01",
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

    it("uses a full-month bucket plus edge transactions", () => {
      const summaries = [
        bucket({
          month: 5,
          totalIncome: 1000,
          totalExpenses: 400,
          monthStartDate: "2026-05-01",
          monthEndDate: "2026-05-31",
        }),
        bucket({
          id: "jul",
          month: 7,
          totalIncome: 900,
          totalExpenses: 900,
          monthStartDate: "2026-07-01",
          monthEndDate: "2026-07-31",
        }),
      ];

      const transactions = [
        tx({ id: "jul-1", date: "2026-07-02", amount: 50 }),
        tx({ id: "jul-2", date: "2026-07-05", amount: 30 }),
        tx({ id: "may-late", date: "2026-05-30", amount: 999 }),
      ];

      expect(
        insightsSummaryHybrid({
          summaries,
          transactions,
          startDate: "2026-05-01",
          endDate: "2026-07-05",
        }),
      ).toEqual({
        totalIncome: 1000,
        totalExpenses: 480,
        netSavings: 520,
      });
    });

    it("treats bucket currency case-insensitively when matching space currency", () => {
      const summaries = [
        bucket({
          month: 12,
          year: 2025,
          currency: "php",
          totalIncome: 0,
          totalExpenses: 15238,
          netSavings: -15238,
          monthStartDate: "2025-12-01",
          monthEndDate: "2025-12-31",
        }),
      ];

      expect(
        insightsSummaryHybrid({
          summaries,
          transactions: [],
          startDate: "2025-12-01",
          endDate: "2025-12-31",
          spaceCurrency: "PHP",
        }),
      ).toEqual({
        totalIncome: 0,
        totalExpenses: 15238,
        netSavings: -15238,
      });
    });

    it("uses only buckets for Jan 1 – Jul 31", () => {
      const summaries = [
        bucket({ month: 6, totalIncome: 100, totalExpenses: 40 }),
        bucket({
          id: "jul",
          month: 7,
          totalIncome: 50,
          totalExpenses: 10,
          monthStartDate: "2026-07-01",
          monthEndDate: "2026-07-31",
        }),
      ];

      expect(
        insightsSummaryHybrid({
          summaries,
          transactions: [],
          startDate: "2026-06-01",
          endDate: "2026-07-31",
        }),
      ).toEqual({
        totalIncome: 150,
        totalExpenses: 50,
        netSavings: 100,
      });
    });

    it("aggregates August from transactions when the month bucket is missing", () => {
      const transactions = [
        tx({ id: "in-1", date: "2026-08-05", amount: 500, type: CombinedTransactionTypeEnum.INCOME }),
        tx({ id: "out-1", date: "2026-08-12", amount: 120 }),
      ];

      expect(
        insightsSummaryHybrid({
          summaries: [],
          transactions,
          startDate: "2026-08-01",
          endDate: "2026-08-31",
        }),
      ).toEqual({
        totalIncome: 500,
        totalExpenses: 120,
        netSavings: 380,
      });
    });

    it("uses a fresh bucket when local transactions are empty", () => {
      expect(
        insightsSummaryHybrid({
          summaries: [
            bucket({
              month: 6,
              totalIncome: 900,
              totalExpenses: 300,
              monthStartDate: "2026-06-01",
              monthEndDate: "2026-06-30",
            }),
          ],
          transactions: [],
          startDate: "2026-06-01",
          endDate: "2026-06-30",
        }),
      ).toEqual({
        totalIncome: 900,
        totalExpenses: 300,
        netSavings: 600,
      });
    });

    it("prefers transactions when the month bucket is empty", () => {
      expect(
        insightsSummaryHybrid({
          summaries: [
            bucket({
              month: 7,
              totalIncome: 0,
              totalExpenses: 0,
              monthStartDate: "2026-07-01",
              monthEndDate: "2026-07-31",
            }),
          ],
          transactions: [
            tx({
              id: "in-1",
              date: "2026-07-10",
              amount: 800,
              type: CombinedTransactionTypeEnum.INCOME,
            }),
            tx({ id: "out-1", date: "2026-07-15", amount: 250 }),
          ],
          startDate: "2026-07-01",
          endDate: "2026-07-31",
        }),
      ).toEqual({
        totalIncome: 800,
        totalExpenses: 250,
        netSavings: 550,
      });
    });

    it("falls back to the month bucket when current-month transactions are empty", () => {
      expect(
        insightsSummaryHybrid({
          summaries: [
            bucket({
              month: 8,
              totalIncome: 900,
              totalExpenses: 300,
              monthStartDate: "2026-08-01",
              monthEndDate: "2026-08-31",
            }),
          ],
          transactions: [],
          startDate: "2026-08-01",
          endDate: "2026-08-31",
          spaceCurrency: "PHP",
        }),
      ).toEqual({
        totalIncome: 900,
        totalExpenses: 300,
        netSavings: 600,
      });
    });

    it("uses calculated transactions for the current calendar month", () => {
      const transactions = [
        tx({
          id: "in-1",
          date: "2026-08-05",
          amount: 500,
          type: CombinedTransactionTypeEnum.INCOME,
        }),
        tx({ id: "out-1", date: "2026-08-12", amount: 120 }),
      ];

      expect(
        insightsSummaryHybrid({
          summaries: [
            bucket({
              month: 8,
              totalIncome: 1,
              totalExpenses: 1,
              monthStartDate: "2026-08-01",
              monthEndDate: "2026-08-31",
            }),
          ],
          transactions,
          startDate: "2026-08-01",
          endDate: "2026-08-31",
          spaceCurrency: "PHP",
        }),
      ).toEqual({
        totalIncome: 500,
        totalExpenses: 120,
        netSavings: 380,
      });
    });
  });
});
