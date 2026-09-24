import { getLocalIsoDateKey } from "@/utils/dateUtils";

/**
 * Mirrors backend `balance_state`: transactions on or before the local calendar
 * day count toward account balances (`calculated`); future dates stay pending.
 */
export const isTransactionCalculatedForDate = (
  transactionDate: string | Date,
  today: string | Date = new Date(),
): boolean => {
  const transactionDay = getLocalIsoDateKey(transactionDate);
  const todayDay = getLocalIsoDateKey(today);
  return transactionDay <= todayDay;
};
