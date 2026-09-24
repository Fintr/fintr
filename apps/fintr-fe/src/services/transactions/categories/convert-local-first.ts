import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  getLocalDb,
  listSpaceTransactions,
  OUTBOX_COMMAND_CATEGORY_CONVERT,
  putSpaceTransactions,
  removeOutboxRecord,
  updateOutboxStatus,
} from "@/lib/local-db";
import {
  applyBudgetsPageToCaches,
  recalculateBudgetSummary,
  upsertSubcategoryBudgetInPage,
  type BudgetRow,
} from "@/services/budgets/budget-cache-ops";
import { loadCachedBudgetsResponse } from "@/services/budgets/local-cache";
import {
  isNetworkLikeMutationError,
  readBrowserOnline,
} from "@/services/local-first/network-error";
import {
  applyCategoryTreesToCaches,
  findCategoryInTrees,
  loadCategoryTrees,
  moveCategoryInTrees,
  type CategoryTrees,
} from "@/services/transactions/categories/category-cache-ops";
import { convertCategoryHierarchy } from "@/services/transactions/categories/mutation";
import { mergeMetaTransactionSnapshotsIntoIndex } from "@/services/transactions/local-cache";
import type {
  CategoryConversionPreview,
  CategoryConversionType,
} from "@/types/categoryConversionTypes";
import type { BudgetsPage } from "@/types/budgetTypes";
import type { TransactionCategory } from "@/types/transactionCategoryTypes";
import {
  CombinedTransactionTypeEnum,
  type IndexTransaction,
} from "@/types/transactionTypes";

export type CategoryConvertOutboxPayload = {
  categoryId: string;
  conversionType: CategoryConversionType;
  newParentId: string | null;
};

export type ConvertCategoryLocalFirstResult = {
  data: { id: string };
  pendingSync: boolean;
  redirectParentId: string;
  localCategory: TransactionCategory;
  previousTrees: CategoryTrees;
  serverResponse?: unknown;
  syncPromise: Promise<ConvertCategoryLocalFirstResult>;
};

export type ConvertCategoryLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

type ConversionFailure = {
  error: {
    details: Record<string, string>;
    message: string;
  };
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid-cat-cvt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const throwConversionFailure = (
  details: Record<string, string>,
): never => {
  const message = Object.values(details)[0] ?? "Conversion failed.";
  const failure: ConversionFailure = {
    error: {
      details,
      message,
    },
  };
  throw failure;
};

const isRootCategory = (category: TransactionCategory): boolean =>
  !category.parentId;

const transactionAmount = (transaction: IndexTransaction): number =>
  transaction.amountInSpaceCurrency?.amount ?? transaction.amount ?? 0;

const transactionSubcategoryId = (
  transaction: IndexTransaction,
): string | null => {
  const value = transaction.subcategoryId;
  if (value == null || value === "") {
    return null;
  }
  return value;
};

const budgetCategoryId = (row: BudgetRow): string =>
  String(row.category_id ?? row.categoryId ?? "");

const budgetSubcategoryId = (row: BudgetRow): string | null => {
  const value = row.subcategory_id ?? row.subcategoryId ?? null;
  if (value == null || value === "") {
    return null;
  }
  return String(value);
};

export const transactionMatchesConversion = (params: {
  transaction: IndexTransaction;
  conversionType: CategoryConversionType;
  categoryId: string;
  oldParentId: string | null;
}): boolean => {
  const { transaction, conversionType, categoryId, oldParentId } = params;
  const subcategoryId = transactionSubcategoryId(transaction);

  if (conversionType === "to_subcategory") {
    return transaction.categoryId === categoryId && subcategoryId == null;
  }

  if (
    transaction.categoryId === oldParentId
    && subcategoryId === categoryId
  ) {
    return true;
  }

  // First convert may have moved the category in the tree without rewriting
  // every local row. Those txs still use the subcategory as categoryId.
  return transaction.categoryId === categoryId && subcategoryId == null;
};

export const applyConversionToTransaction = (params: {
  transaction: IndexTransaction;
  conversionType: CategoryConversionType;
  category: TransactionCategory;
  newParent: TransactionCategory | null;
}): IndexTransaction => {
  const { transaction, conversionType, category, newParent } = params;

  if (conversionType === "to_subcategory") {
    return {
      ...transaction,
      categoryId: newParent?.id,
      categoryName: newParent?.name ?? transaction.categoryName,
      subcategoryId: category.id,
      subcategoryName: category.name,
    };
  }

  return {
    ...transaction,
    categoryId: category.id,
    categoryName: category.name,
    subcategoryId: null,
    subcategoryName: null,
  };
};

const mapSnapshotTransactions = (
  value: unknown,
  mapTransaction: (transaction: IndexTransaction) => IndexTransaction,
): unknown => {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((page) => {
      const row = page as TransactionsPage;
      if (!Array.isArray(row?.transactions)) {
        return page;
      }

      return {
        ...row,
        transactions: row.transactions.map(mapTransaction),
      };
    });
  }

  const page = value as TransactionsPage & { pages?: TransactionsPage[] };
  if (Array.isArray(page.pages)) {
    return {
      ...page,
      pages: page.pages.map((inner) => ({
        ...inner,
        transactions: (inner.transactions ?? []).map(mapTransaction),
      })),
    };
  }

  if (Array.isArray(page.transactions)) {
    return {
      ...page,
      transactions: page.transactions.map(mapTransaction),
    };
  }

  return value;
};

const rewriteCachedTransactionSnapshots = async (params: {
  spaceCode: string;
  conversionType: CategoryConversionType;
  categoryId: string;
  oldParentId: string | null;
  category: TransactionCategory;
  newParent: TransactionCategory | null;
}): Promise<void> => {
  const prefixPage = `transactionsPage1:${params.spaceCode}:`;
  const prefixAll = `transactionsAllPages:${params.spaceCode}:`;
  const rows = await getLocalDb().meta.toArray();

  for (const row of rows) {
    const key = String(row.key);
    if (!key.startsWith(prefixPage) && !key.startsWith(prefixAll)) {
      continue;
    }

    await getLocalDb().meta.put({
      key: row.key,
      value: mapSnapshotTransactions(row.value, (transaction) => {
        if (
          !transactionMatchesConversion({
            transaction,
            conversionType: params.conversionType,
            categoryId: params.categoryId,
            oldParentId: params.oldParentId,
          })
        ) {
          return transaction;
        }

        return applyConversionToTransaction({
          transaction,
          conversionType: params.conversionType,
          category: params.category,
          newParent: params.newParent,
        });
      }),
    });
  }
};

const validateConversion = (params: {
  trees: CategoryTrees;
  category: TransactionCategory;
  conversionType: CategoryConversionType;
  newParentId?: string | null;
}): { newParent: TransactionCategory | null } => {
  const { trees, category, conversionType, newParentId } = params;

  if (conversionType === "to_subcategory") {
    if (!isRootCategory(category)) {
      throwConversionFailure({ category: "must be a parent category" });
    }
    if (category.children && category.children.length > 0) {
      throwConversionFailure({
        category: "has subcategories; remove or move them first",
      });
    }
    if (!newParentId) {
      throwConversionFailure({ new_parent_id: "is required" });
    }

    const newParent = findCategoryInTrees(trees, newParentId);
    if (!newParent) {
      throwConversionFailure({ new_parent_id: "not found" });
    }
    if (!isRootCategory(newParent)) {
      throwConversionFailure({ new_parent_id: "must be a parent category" });
    }
    if (newParent.categoryType !== category.categoryType) {
      throwConversionFailure({ new_parent_id: "must match category type" });
    }
    if (newParent.id === category.id) {
      throwConversionFailure({
        new_parent_id: "cannot be the same category",
      });
    }

    return { newParent };
  }

  if (isRootCategory(category)) {
    throwConversionFailure({ category: "is already a parent category" });
  }
  if (category.children && category.children.length > 0) {
    throwConversionFailure({ category: "has subcategories" });
  }

  return { newParent: null };
};

const listCachedBudgetPages = async (
  spaceCode: string,
): Promise<Array<{ startDate: string; endDate: string; page: BudgetsPage }>> => {
  const prefix = `budgetsResponse:${spaceCode}:`;
  const rows = await getLocalDb().meta.toArray();
  const pages: Array<{
    startDate: string;
    endDate: string;
    page: BudgetsPage;
  }> = [];

  for (const row of rows) {
    if (!String(row.key).startsWith(prefix)) {
      continue;
    }

    const rest = String(row.key).slice(prefix.length);
    const match = rest.match(/^(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/);
    if (!match) {
      continue;
    }

    const page = await loadCachedBudgetsResponse(
      spaceCode,
      match[1],
      match[2],
    );
    if (page) {
      pages.push({
        startDate: match[1],
        endDate: match[2],
        page,
      });
    }
  }

  return pages;
};

const countMatchingBudgets = (params: {
  page: BudgetsPage;
  conversionType: CategoryConversionType;
  categoryId: string;
  oldParentId: string | null;
}): number => {
  const { page, conversionType, categoryId, oldParentId } = params;
  let count = 0;

  for (const row of page.budgets as BudgetRow[]) {
    if (conversionType === "to_subcategory") {
      if (
        budgetCategoryId(row) === categoryId
        && budgetSubcategoryId(row) == null
      ) {
        count += 1;
      }
      continue;
    }

    if (
      budgetCategoryId(row) === oldParentId
      && budgetSubcategoryId(row) === categoryId
    ) {
      count += 1;
    }

    const subcategories = Array.isArray(row.subcategories)
      ? row.subcategories
      : [];
    for (const sub of subcategories) {
      const subRow = sub as BudgetRow;
      if (budgetSubcategoryId(subRow) === categoryId) {
        count += 1;
      }
    }
  }

  return count;
};

const applyConversionToBudgetPage = (params: {
  page: BudgetsPage;
  conversionType: CategoryConversionType;
  category: TransactionCategory;
  newParent: TransactionCategory | null;
}): BudgetsPage => {
  const { page, conversionType, category, newParent } = params;
  const budgets = [...(page.budgets as BudgetRow[])];

  if (conversionType === "to_subcategory") {
    if (!newParent) {
      return page;
    }

    const movingIndex = budgets.findIndex(
      (row) =>
        budgetCategoryId(row) === category.id
        && budgetSubcategoryId(row) == null,
    );
    if (movingIndex < 0) {
      return page;
    }

    const [moving] = budgets.splice(movingIndex, 1);
    return upsertSubcategoryBudgetInPage(
      { ...page, budgets },
      {
        categoryId: newParent.id,
        subcategoryId: category.id,
        budgetId: String(moving.id),
        amount: Number(moving.amount ?? moving.budget ?? 0),
        date: String(moving.date ?? ""),
        subcategoryName: category.name,
        amountCurrency: String(moving.amount_currency ?? "PHP"),
      },
    );
  }

  let extracted: BudgetRow | undefined;
  const nextBudgets = budgets.map((row) => {
    const subcategories = Array.isArray(row.subcategories)
      ? [...row.subcategories]
      : [];
    const subIndex = subcategories.findIndex(
      (sub) => budgetSubcategoryId(sub as BudgetRow) === category.id,
    );
    if (subIndex < 0) {
      return row;
    }

    extracted = subcategories[subIndex] as BudgetRow;
    return {
      ...row,
      subcategories: subcategories.filter((_, index) => index !== subIndex),
    };
  });

  if (!extracted) {
    return page;
  }

  nextBudgets.push({
    id: String(extracted.id),
    date: String(extracted.date ?? ""),
    category_name: category.name,
    category_id: category.id,
    categoryId: category.id,
    subcategory_id: null,
    subcategoryId: null,
    total_spent: Number(extracted.spent ?? extracted.total_spent ?? 0),
    amount_currency: String(extracted.amount_currency ?? "PHP"),
    amount: Number(extracted.amount ?? extracted.budget ?? 0),
    subcategories: [],
  });

  return recalculateBudgetSummary({
    ...page,
    budgets: nextBudgets,
  });
};

export const previewCategoryConversionLocal = async (params: {
  spaceCode: string;
  categoryId: string;
  conversionType: CategoryConversionType;
  newParentId?: string | null;
}): Promise<CategoryConversionPreview> => {
  const { spaceCode, categoryId, conversionType, newParentId } = params;
  const trees = await loadCategoryTrees(spaceCode);
  const category = findCategoryInTrees(trees, categoryId);
  if (!category) {
    throwConversionFailure({ category: "not found" });
  }

  const { newParent } = validateConversion({
    trees,
    category,
    conversionType,
    newParentId,
  });

  const oldParentId = category.parentId ?? null;
  await mergeMetaTransactionSnapshotsIntoIndex(spaceCode);
  const transactions = await listSpaceTransactions(spaceCode);
  const matching = transactions.filter((transaction) =>
    transactionMatchesConversion({
      transaction,
      conversionType,
      categoryId,
      oldParentId,
    }),
  );

  let incomeTotal = 0;
  let expenseTotal = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const transaction of matching) {
    const amount = transactionAmount(transaction);
    if (transaction.type === CombinedTransactionTypeEnum.INCOME) {
      incomeTotal += amount;
      incomeCount += 1;
    } else if (transaction.type === CombinedTransactionTypeEnum.EXPENSE) {
      expenseTotal += amount;
      expenseCount += 1;
    }
  }

  const budgetPages = await listCachedBudgetPages(spaceCode);
  const budgetCount = budgetPages.reduce(
    (sum, { page }) =>
      sum
      + countMatchingBudgets({
        page,
        conversionType,
        categoryId,
        oldParentId,
      }),
    0,
  );

  return {
    conversionType,
    categoryId: category.id,
    categoryName: category.name,
    newParentId: newParent?.id ?? null,
    newParentName: newParent?.name ?? null,
    transactionCount: incomeCount + expenseCount,
    incomeCount,
    expenseCount,
    incomeTotal,
    expenseTotal,
    budgetCount,
  };
};

/**
 * Local-first category hierarchy convert: patch trees, transactions, and
 * budgets immediately, enqueue outbox, then POST convert.
 */
export const convertCategoryLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    categoryId: string;
    conversionType: CategoryConversionType;
    newParentId?: string | null;
  },
  options: ConvertCategoryLocalFirstOptions = {},
): Promise<ConvertCategoryLocalFirstResult> => {
  const { spaceCode, categoryId, conversionType } = params;
  const newParentId = params.newParentId ?? null;
  const { queryClient, waitForSync = true } = options;

  if (!spaceCode) {
    throw new Error("spaceCode is required to convert a local category");
  }

  const previousTrees = await loadCategoryTrees(spaceCode);
  const category = findCategoryInTrees(previousTrees, categoryId);
  if (!category) {
    throwConversionFailure({ category: "not found" });
  }

  const { newParent } = validateConversion({
    trees: previousTrees,
    category,
    conversionType,
    newParentId,
  });

  const oldParentId = category.parentId ?? null;
  const redirectParentId =
    conversionType === "to_subcategory"
      ? (newParent?.id ?? categoryId)
      : categoryId;

  const nextTrees = moveCategoryInTrees(
    previousTrees,
    categoryId,
    conversionType === "to_subcategory" ? newParent?.id ?? null : null,
  );

  await mergeMetaTransactionSnapshotsIntoIndex(spaceCode);

  const previousTransactions = await listSpaceTransactions(spaceCode);
  const nextTransactions = previousTransactions.map((transaction) => {
    if (
      !transactionMatchesConversion({
        transaction,
        conversionType,
        categoryId,
        oldParentId,
      })
    ) {
      return transaction;
    }

    return applyConversionToTransaction({
      transaction,
      conversionType,
      category,
      newParent,
    });
  });
  await putSpaceTransactions(spaceCode, nextTransactions);
  await rewriteCachedTransactionSnapshots({
    spaceCode,
    conversionType,
    categoryId,
    oldParentId,
    category,
    newParent,
  });

  if (queryClient) {
    await queryClient.cancelQueries({
      queryKey: ["transactionCategories", spaceCode],
    });
  }

  await applyCategoryTreesToCaches({
    spaceCode,
    trees: nextTrees,
    queryClient,
  });

  if (queryClient) {
    await queryClient.invalidateQueries({
      queryKey: ["transactionCategories", "local", spaceCode],
    });
    await queryClient.invalidateQueries({ queryKey: ["transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["budgets"] });
    await queryClient.invalidateQueries({
      queryKey: ["dashboard", "shell", "local", spaceCode],
    });
  }

  const previousBudgetPages = await listCachedBudgetPages(spaceCode);
  for (const { startDate, endDate, page } of previousBudgetPages) {
    await applyBudgetsPageToCaches({
      spaceCode,
      startDate,
      endDate,
      page: applyConversionToBudgetPage({
        page,
        conversionType,
        category,
        newParent,
      }),
      queryClient,
    });
  }

  const clientMutationId = newClientMutationId();
  const payload: CategoryConvertOutboxPayload = {
    categoryId,
    conversionType,
    newParentId:
      conversionType === "to_subcategory" ? newParent?.id ?? null : null,
  };
  await enqueueOutboxRecord({
    spaceId: spaceCode,
    commandType: OUTBOX_COMMAND_CATEGORY_CONVERT,
    payload,
    clientMutationId,
  });

  let resolveSync!: (value: ConvertCategoryLocalFirstResult) => void;
  let rejectSync!: (reason?: unknown) => void;
  const syncPromise = new Promise<ConvertCategoryLocalFirstResult>(
    (resolve, reject) => {
      resolveSync = resolve;
      rejectSync = reject;
    },
  );

  const localCategory: TransactionCategory = {
    ...category,
    parentId:
      conversionType === "to_subcategory" ? newParent?.id ?? null : null,
  };

  const runSync = async (): Promise<void> => {
    if (!readBrowserOnline()) {
      await updateOutboxStatus({
        id: clientMutationId,
        status: "pending",
        lastError: "Offline — will sync when online",
      });

      resolveSync({
        data: { id: categoryId },
        pendingSync: true,
        redirectParentId,
        localCategory,
        previousTrees,
        syncPromise,
      });
      return;
    }

    await updateOutboxStatus({ id: clientMutationId, status: "syncing" });

    try {
      const serverResponse = await convertCategoryHierarchy(api, categoryId, {
        conversionType,
        newParentId: payload.newParentId,
      });
      await removeOutboxRecord(clientMutationId);

      resolveSync({
        data: { id: categoryId },
        pendingSync: false,
        redirectParentId: serverResponse.redirectParentId ?? redirectParentId,
        localCategory,
        previousTrees,
        serverResponse,
        syncPromise,
      });
    } catch (error) {
      if (isNetworkLikeMutationError(error)) {
        await updateOutboxStatus({
          id: clientMutationId,
          status: "pending",
          lastError:
            error instanceof Error
              ? error.message
              : "Network error on convert",
        });

        resolveSync({
          data: { id: categoryId },
          pendingSync: true,
          redirectParentId,
          localCategory,
          previousTrees,
          syncPromise,
        });
        return;
      }

      await applyCategoryTreesToCaches({
        spaceCode,
        trees: previousTrees,
        queryClient,
      });
      await putSpaceTransactions(spaceCode, previousTransactions);
      for (const { startDate, endDate, page } of previousBudgetPages) {
        await applyBudgetsPageToCaches({
          spaceCode,
          startDate,
          endDate,
          page,
          queryClient,
        });
      }
      await removeOutboxRecord(clientMutationId);
      rejectSync(error);
    }
  };

  void runSync();

  const pendingResult: ConvertCategoryLocalFirstResult = {
    data: { id: categoryId },
    pendingSync: true,
    redirectParentId,
    localCategory,
    previousTrees,
    syncPromise,
  };

  if (!waitForSync) {
    return pendingResult;
  }

  return syncPromise;
};
