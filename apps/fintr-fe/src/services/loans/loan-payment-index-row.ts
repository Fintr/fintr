import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import type { LoanPayment } from "./payments";

export const loanPaymentToIndexRow = (
  payment: LoanPayment,
  loanId: string,
): IndexTransaction => ({
  id: payment.id,
  date: payment.date,
  description: payment.notes?.trim() || "Loan payment",
  amount: payment.totalPayment,
  amountCurrency: payment.currency,
  categoryName: "Loan payment",
  fromAccountName: payment.accountName,
  toAccountName: "",
  type: CombinedTransactionTypeEnum.LOAN_PAYMENT,
  inSeries: false,
  hasImage: false,
  calculated: true,
  isLoanActivity: true,
  loanId,
});
