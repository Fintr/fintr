import type { IndexTransaction } from "@/types/transactionTypes";

export const OPEN_TRANSACTION_EVENT = "fintr:open-transaction";

/** Ask the dashboard to navigate to Transactions and open this row for edit. */
export const requestOpenTransaction = (transaction: IndexTransaction): void => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(OPEN_TRANSACTION_EVENT, {
      detail: { transaction },
    }),
  );
};
