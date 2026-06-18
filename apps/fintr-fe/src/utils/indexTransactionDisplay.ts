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
