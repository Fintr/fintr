import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { positiveTransactionFormAmount } from "@/utils/transactionFormAmount";

const TITLE_NAME_MAX_LENGTH = 40;

const truncateName = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length <= TITLE_NAME_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, TITLE_NAME_MAX_LENGTH - 1).trimEnd()}…`;
};

const formatTitleAmount = (amount: unknown, currency?: string | null): string => {
  const magnitude = positiveTransactionFormAmount(amount);
  if (magnitude === 0 && (amount == null || String(amount).trim() === "")) {
    return "";
  }

  const amountLabel = Number.isInteger(magnitude)
    ? String(magnitude)
    : magnitude.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
  const currencyLabel = currency?.trim();

  if (currencyLabel) {
    return `${currencyLabel} ${amountLabel}`;
  }

  return amountLabel;
};

const fallbackTitle = (type?: CombinedTransactionTypeEnum | string): string => {
  switch (type) {
    case CombinedTransactionTypeEnum.EXPENSE:
      return "Expense";
    case CombinedTransactionTypeEnum.INCOME:
      return "Income";
    case CombinedTransactionTypeEnum.TRANSFER:
      return "Transfer";
    default:
      return "Transaction";
  }
};

export const buildTransactionSheetTitle = ({
  type,
  categoryName,
  description,
  amount,
  currency,
  fromAccountName,
  toAccountName,
}: {
  type?: CombinedTransactionTypeEnum | string;
  categoryName?: string | null;
  description?: string | null;
  amount?: unknown;
  currency?: string | null;
  fromAccountName?: string | null;
  toAccountName?: string | null;
}): string => {
  const amountPart = formatTitleAmount(amount, currency);

  if (
    type === CombinedTransactionTypeEnum.TRANSFER &&
    fromAccountName?.trim() &&
    toAccountName?.trim()
  ) {
    const route = truncateName(
      `${fromAccountName.trim()} → ${toAccountName.trim()}`,
    );
    return amountPart ? `${route} · ${amountPart}` : route;
  }

  const name =
    description?.trim() ||
    categoryName?.trim() ||
    fallbackTitle(type);

  const displayName = truncateName(name);

  return amountPart ? `${displayName} · ${amountPart}` : displayName;
};
