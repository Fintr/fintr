import type { IndexTransaction } from "@/types/transactionTypes";
import { isTransactionCalculatedForDate } from "@/utils/transactionCalculated";

/** Matches backend insights: exclude Initial Balance category rows. */
export const INITIAL_BALANCE_CATEGORY_NAME = "Initial Balance";

export const isInsightsCalculatedTransaction = (
  transaction: IndexTransaction,
  today?: string | Date,
): boolean => {
  // Future-dated pending rows stay out of insights (mirrors balance_state).
  if (!isTransactionCalculatedForDate(transaction.date, today)) {
    return false;
  }

  // Past/today dates always count. After re-sync, list payloads can mark past
  // rows `calculated: false` while monthly buckets / the transactions list still
  // show them — excluding those zeros category and tag dashboard filters.
  return true;
};

export const filterInsightsTransactions = (
  transactions: IndexTransaction[],
  today?: string | Date,
): IndexTransaction[] =>
  transactions.filter(
    (transaction) =>
      transaction.categoryName?.trim() !== INITIAL_BALANCE_CATEGORY_NAME
      && isInsightsCalculatedTransaction(transaction, today),
  );
