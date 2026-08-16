import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { IndexTransaction } from "@/types/transactionTypes";

export type TransactionEntryTypeFilter =
  | "all"
  | "expense"
  | "income"
  | "transfers"
  | "loans";

export const TRANSACTION_ENTRY_TYPE_FILTER_OPTIONS: Array<{
  value: TransactionEntryTypeFilter;
  label: string;
}> = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfers", label: "Transfers" },
  { value: "loans", label: "Loans" },
];

export const coerceCombinedTransactionType = (
  type: unknown,
): CombinedTransactionTypeEnum | null => {
  const raw = String(type ?? "").trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const token = raw.includes("::") ? (raw.split("::").pop() ?? raw) : raw;

  if (token === CombinedTransactionTypeEnum.EXPENSE) {
    return CombinedTransactionTypeEnum.EXPENSE;
  }

  if (token === CombinedTransactionTypeEnum.INCOME) {
    return CombinedTransactionTypeEnum.INCOME;
  }

  if (
    token === CombinedTransactionTypeEnum.TRANSFER
    || token === "transfers"
  ) {
    return CombinedTransactionTypeEnum.TRANSFER;
  }

  if (
    token === CombinedTransactionTypeEnum.LOAN_PAYMENT
    || token === "loanpayment"
  ) {
    return CombinedTransactionTypeEnum.LOAN_PAYMENT;
  }

  if (
    token === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT
    || token === "loan"
  ) {
    return CombinedTransactionTypeEnum.LOAN_DISBURSEMENT;
  }

  return Object.values(CombinedTransactionTypeEnum).includes(
    raw as CombinedTransactionTypeEnum,
  )
    ? (raw as CombinedTransactionTypeEnum)
    : null;
};

export const resolveTransactionEntryType = (
  transaction: Pick<
    IndexTransaction,
    | "type"
    | "isLoanActivity"
    | "hasLoanPayment"
    | "loanId"
    | "fromAccountName"
    | "toAccountName"
    | "categoryName"
  >,
): CombinedTransactionTypeEnum | null => {
  const coerced = coerceCombinedTransactionType(transaction.type);
  if (coerced) {
    return coerced;
  }

  if (
    transaction.isLoanActivity
    || transaction.hasLoanPayment
    || transaction.loanId
  ) {
    const category = String(transaction.categoryName ?? "").toLowerCase();
    if (category.includes("payment")) {
      return CombinedTransactionTypeEnum.LOAN_PAYMENT;
    }

    return CombinedTransactionTypeEnum.LOAN_DISBURSEMENT;
  }

  const from = String(transaction.fromAccountName ?? "").trim();
  const to = String(transaction.toAccountName ?? "").trim();
  if (from && to) {
    return CombinedTransactionTypeEnum.TRANSFER;
  }

  if (from && !to) {
    return CombinedTransactionTypeEnum.EXPENSE;
  }

  if (to && !from) {
    return CombinedTransactionTypeEnum.INCOME;
  }

  return null;
};

export const transactionMatchesEntryTypeFilter = (
  type: CombinedTransactionTypeEnum | string | null | undefined,
  entryType: TransactionEntryTypeFilter,
  transaction?: Pick<
    IndexTransaction,
    | "isLoanActivity"
    | "hasLoanPayment"
    | "loanId"
    | "fromAccountName"
    | "toAccountName"
    | "categoryName"
  >,
): boolean => {
  if (entryType === "all") {
    return true;
  }

  const coerced = transaction
    ? resolveTransactionEntryType({
        ...transaction,
        type: type as IndexTransaction["type"],
      })
    : coerceCombinedTransactionType(type);
  if (!coerced) {
    return false;
  }

  if (entryType === "expense") {
    return coerced === CombinedTransactionTypeEnum.EXPENSE;
  }

  if (entryType === "income") {
    return coerced === CombinedTransactionTypeEnum.INCOME;
  }

  if (entryType === "transfers") {
    return coerced === CombinedTransactionTypeEnum.TRANSFER;
  }

  return (
    coerced === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT
    || coerced === CombinedTransactionTypeEnum.LOAN_PAYMENT
  );
};

export const entryTypeFilterToApiParam = (
  entryType: TransactionEntryTypeFilter,
): string | undefined => {
  if (entryType === "all") {
    return undefined;
  }

  return entryType;
};
