import type { TransactionTotals } from "@/types/transactionTypes";

export type TransactionPeriodSummaryAmounts = {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
};

/** Same numbers as `TransactionTotalsDisplay` / `pages[0].totals`. */
export const periodSummaryFromTransactionTotals = (
  totals: TransactionTotals,
): TransactionPeriodSummaryAmounts => {
  const income = totals.income;
  const expense = totals.expense;

  return {
    totalIncome: income,
    totalExpenses: expense,
    netSavings: income - expense,
  };
};
