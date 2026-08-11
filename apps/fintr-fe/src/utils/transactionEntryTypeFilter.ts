import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

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

export const transactionMatchesEntryTypeFilter = (
  type: CombinedTransactionTypeEnum,
  entryType: TransactionEntryTypeFilter,
): boolean => {
  if (entryType === "all") {
    return true;
  }

  if (entryType === "expense") {
    return type === CombinedTransactionTypeEnum.EXPENSE;
  }

  if (entryType === "income") {
    return type === CombinedTransactionTypeEnum.INCOME;
  }

  if (entryType === "transfers") {
    return type === CombinedTransactionTypeEnum.TRANSFER;
  }

  return (
    type === CombinedTransactionTypeEnum.LOAN_DISBURSEMENT
    || type === CombinedTransactionTypeEnum.LOAN_PAYMENT
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
