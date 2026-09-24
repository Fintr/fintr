import { CombinedTransactionTypeEnum, type IndexTransaction } from "@/types/transactionTypes";
import {
  getFirstDayOfMonth,
  getLastDayOfMonth,
  getLocalIsoDateKey,
} from "@/utils/dateUtils";

export type MerchantMonthSpend = {
  thisMonth: number;
  lastMonth: number;
  currency: string;
  topCategoryName: string | null;
};

const monthWindow = (year: number, month: number) => ({
  start: getFirstDayOfMonth(year, month),
  end: getLastDayOfMonth(year, month),
});

const inRange = (date: string, start: string, end: string) => {
  const key = getLocalIsoDateKey(date);
  return key >= start && key <= end;
};

const expenseAmount = (transaction: IndexTransaction) =>
  Math.abs(transaction.amount);

export const merchantMonthlySpend = (
  transactions: IndexTransaction[],
  referenceDate: Date = new Date(),
): MerchantMonthSpend => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  const previous = new Date(year, month - 2, 1);
  const thisWindow = monthWindow(year, month);
  const lastWindow = monthWindow(
    previous.getFullYear(),
    previous.getMonth() + 1,
  );

  const expenses = transactions.filter(
    (transaction) => transaction.type === CombinedTransactionTypeEnum.EXPENSE,
  );

  const thisMonthRows = expenses.filter((transaction) =>
    inRange(transaction.date, thisWindow.start, thisWindow.end),
  );
  const lastMonthRows = expenses.filter((transaction) =>
    inRange(transaction.date, lastWindow.start, lastWindow.end),
  );

  const thisMonth = thisMonthRows.reduce(
    (sum, transaction) => sum + expenseAmount(transaction),
    0,
  );
  const lastMonth = lastMonthRows.reduce(
    (sum, transaction) => sum + expenseAmount(transaction),
    0,
  );

  const byCategory = new Map<string, number>();
  for (const transaction of thisMonthRows) {
    const name = transaction.categoryName?.trim() || "Uncategorized";
    byCategory.set(name, (byCategory.get(name) ?? 0) + expenseAmount(transaction));
  }

  let topCategoryName: string | null = null;
  let topValue = 0;
  for (const [name, value] of byCategory) {
    if (value > topValue) {
      topValue = value;
      topCategoryName = name;
    }
  }

  const currency =
    thisMonthRows[0]?.amountCurrency ??
    lastMonthRows[0]?.amountCurrency ??
    expenses[0]?.amountCurrency ??
    "PHP";

  return {
    thisMonth,
    lastMonth,
    currency,
    topCategoryName,
  };
};
