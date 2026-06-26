import { formatCurrency } from "@/lib/utils";
import type { IndexTransaction } from "@/types/transactionTypes";

type IndexRowMoneyFields = Pick<
  IndexTransaction,
  "amount" | "amountCurrency" | "bookedAmount" | "bookedAmountCurrency"
>;

/** Space-normalized row vs ledger (booked) amount/currency for list / sheets. */
export function indexTransactionDisplayMoney(
  transaction: IndexRowMoneyFields,
  spaceCurrency: string,
  showBookedCurrencies: boolean
): { amount: number; currency: string } {
  if (
    showBookedCurrencies &&
    transaction.bookedAmount != null &&
    transaction.bookedAmountCurrency != null &&
    String(transaction.bookedAmountCurrency).trim() !== ""
  ) {
    return {
      amount: transaction.bookedAmount,
      currency: transaction.bookedAmountCurrency,
    };
  }

  return {
    amount: transaction.amount,
    currency: transaction.amountCurrency ?? spaceCurrency,
  };
}

/**
 * List / sheet row amount string. Booked (native) currency shows ledger magnitude only —
 * expense vs income is conveyed by row styling, not a type-derived minus prefix.
 */
export function formatIndexTransactionListAmount(
  amount: number,
  currency: string,
  showBookedCurrencies: boolean,
): string {
  if (showBookedCurrencies) {
    return formatCurrency(Math.abs(amount), currency);
  }

  if (amount < 0) {
    return `-${formatCurrency(Math.abs(amount), currency)}`;
  }

  return formatCurrency(amount, currency);
}
