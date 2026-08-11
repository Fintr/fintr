import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import type { Loan } from "./queries";

export const loanToIndexRow = (loan: Loan): IndexTransaction => ({
  id: loan.id,
  date: loan.date,
  description: loan.description?.trim() || loan.entityName,
  amount: Math.abs(Number(loan.principalAmount) || 0),
  amountCurrency: loan.principalAmountCurrency,
  categoryName: "Loan",
  fromAccountName: loan.loanType === "borrowed" ? "" : loan.accountName,
  toAccountName: loan.loanType === "borrowed" ? loan.accountName : "",
  type: CombinedTransactionTypeEnum.LOAN_DISBURSEMENT,
  inSeries: false,
  hasImage: Boolean(loan.files?.length),
  calculated: true,
  isLoanActivity: true,
  loanType: loan.loanType,
  loanId: loan.id,
  entityName: loan.entityName,
});
