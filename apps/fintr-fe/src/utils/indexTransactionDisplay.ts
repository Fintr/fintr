import type { IndexTransaction } from "@/types/transactionTypes";

/** Space-normalized row vs ledger (booked) amount/currency for list / sheets. */
export function indexTransactionDisplayMoney(
  transaction: IndexTransaction,
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
