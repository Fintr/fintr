import { describe, expect, it } from "vitest";

import type { Loan } from "@/services/loans/queries";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  estimateMonthlyLoanPayment,
  expenseBreakdownFromTransactions,
  healthScoresFromLocalData,
  merchantBreakdownFromTransactions,
  subcategoryBreakdownFromTransactions,
  weeklySpendingFromTransactions,
} from "./offline-calculations";

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

describe("offline insights calculations", () => {
  it("groups expense breakdown by category like the backend", () => {
    const breakdown = expenseBreakdownFromTransactions([
      tx({ id: "1", categoryName: "Food", amount: 40 }),
      tx({ id: "2", categoryName: "Food", amount: 60 }),
      tx({ id: "3", categoryName: "Transport", amount: 100 }),
    ]);

    expect(breakdown).toHaveLength(2);
    expect(breakdown[0]).toMatchObject({
      name: "Food",
      value: 100,
      percentage: "50.00%",
    });
    expect(breakdown[1]).toMatchObject({
      name: "Transport",
      value: 100,
      percentage: "50.00%",
    });
  });

  it("groups merchant expense breakdown and labels blank merchants as Unassigned", () => {
    const breakdown = merchantBreakdownFromTransactions([
      tx({ id: "1", entityName: "SM Hypermarket", amount: 400 }),
      tx({ id: "2", entityName: "SM Hypermarket", amount: 100 }),
      tx({ id: "3", entityName: "", amount: 200 }),
      tx({ id: "4", amount: 50 }),
    ]);

    expect(breakdown).toEqual([
      expect.objectContaining({
        name: "SM Hypermarket",
        value: 500,
        percentage: "66.67%",
      }),
      expect.objectContaining({
        name: "Unassigned",
        value: 250,
        percentage: "33.33%",
      }),
    ]);
  });

  it("groups subcategory expense breakdown and labels blank subcategories as Unassigned", () => {
    const breakdown = subcategoryBreakdownFromTransactions([
      tx({
        id: "1",
        categoryName: "Food & Groceries",
        subcategoryName: "Groceries",
        amount: 300,
      }),
      tx({
        id: "2",
        categoryName: "Food & Groceries",
        subcategoryName: "Groceries",
        amount: 100,
      }),
      tx({
        id: "3",
        categoryName: "Food & Groceries",
        subcategoryName: "Dining Out",
        amount: 200,
      }),
      tx({
        id: "4",
        categoryName: "Food & Groceries",
        subcategoryName: null,
        amount: 50,
      }),
    ]);

    expect(breakdown).toEqual([
      expect.objectContaining({
        name: "Groceries",
        value: 400,
        percentage: "61.54%",
      }),
      expect.objectContaining({
        name: "Dining Out",
        value: 200,
        percentage: "30.77%",
      }),
      expect.objectContaining({
        name: "Unassigned",
        value: 50,
        percentage: "7.69%",
      }),
    ]);
  });

  it("builds 7-day weekly spending ending today", () => {
    const today = new Date("2026-08-08T12:00:00Z");
    const spending = weeklySpendingFromTransactions(
      [
        tx({ id: "1", date: "2026-08-08", amount: 25 }),
        tx({ id: "2", date: "2026-08-07", amount: 10 }),
        tx({ id: "3", date: "2026-07-01", amount: 999 }),
      ],
      today,
    );

    expect(spending).toHaveLength(7);
    expect(spending.at(-1)?.amount).toBe(25);
    expect(spending.at(-2)?.amount).toBe(10);
    expect(spending.reduce((sum, day) => sum + day.amount, 0)).toBe(35);
  });

  it("estimates loan payments with the amortization formula", () => {
    const loan = {
      loanType: "borrowed",
      status: "active",
      outstandingBalance: 1200,
      loanTermMonths: 12,
      interestRate: 0,
    } as Loan;

    expect(estimateMonthlyLoanPayment(loan)).toBe(100);
  });

  it("scores financial health with the backend weightings", () => {
    const health = healthScoresFromLocalData({
      summary: {
        totalIncome: 1000,
        totalExpenses: 700,
        netSavings: 300,
      },
      periodDays: 30,
      totalBudget: 800,
      monthlyDebt: 100,
    });

    // savings 30% → 100, budget 87.5% → 100, DTI 10% → 100 → overall 100
    expect(health.score).toBe(100);
    expect(health.savingsPercentage.score).toBe(100);
    expect(health.budgetUsage.score).toBe(100);
    expect(health.debtToIncomeRatio.score).toBe(100);
  });
});
