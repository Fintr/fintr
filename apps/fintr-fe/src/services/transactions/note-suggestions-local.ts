import { listSpaceTransactions } from "@/lib/local-db/transactions";
import type { NoteSuggestionsParams } from "@/services/transactions/queries";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

const matchesTransactionType = (
  transaction: IndexTransaction,
  transactionType?: NoteSuggestionsParams["transactionType"],
): boolean => {
  if (!transactionType) {
    return true;
  }

  if (transactionType === "income") {
    return transaction.type === CombinedTransactionTypeEnum.INCOME;
  }

  if (transactionType === "expense") {
    return transaction.type === CombinedTransactionTypeEnum.EXPENSE;
  }

  return true;
};

const matchesCategory = (
  transaction: IndexTransaction,
  categoryName?: string,
): boolean => {
  if (!categoryName?.trim()) {
    return true;
  }

  const needle = categoryName.trim().toLowerCase();
  const category = (transaction.categoryName ?? "").trim().toLowerCase();
  const subcategory = (transaction.subcategoryName ?? "").trim().toLowerCase();

  return category === needle || subcategory === needle;
};

const matchesSearch = (
  transaction: IndexTransaction,
  search?: string,
): boolean => {
  if (!search?.trim()) {
    return true;
  }

  const needle = search.trim().toLowerCase();
  const description = (transaction.description ?? "").toLowerCase();

  return description.includes(needle);
};

export const loadCachedNoteSuggestions = async (
  spaceId: string,
  params: NoteSuggestionsParams,
): Promise<string[]> => {
  if (!spaceId) {
    return [];
  }

  const limit = params.limit ?? 10;
  const rows = await listSpaceTransactions(spaceId);

  const notes: string[] = [];

  for (const transaction of rows) {
    if (
      transaction.type !== CombinedTransactionTypeEnum.INCOME &&
      transaction.type !== CombinedTransactionTypeEnum.EXPENSE
    ) {
      continue;
    }

    if (!matchesTransactionType(transaction, params.transactionType)) {
      continue;
    }

    if (!matchesCategory(transaction, params.categoryName)) {
      continue;
    }

    if (!matchesSearch(transaction, params.search)) {
      continue;
    }

    const description = transaction.description?.trim();
    if (!description) {
      continue;
    }

    if (!notes.includes(description)) {
      notes.push(description);
    }

    if (notes.length >= limit) {
      break;
    }
  }

  return notes;
};
