import { listSpaceAccounts } from "@/lib/local-db/accounts";
import {
  buildAccountNameResolvers,
  fuzzyResolveAccountIdForName,
  resolveAccountIdForName,
  type AccountNameResolver,
} from "@/lib/local-db/account-name-resolver";
import {
  listSpaceTransactions,
  putSpaceTransactions,
} from "@/lib/local-db/transactions";
import { loadCachedEntitiesResponse } from "@/services/entities/local-cache";
import {
  cacheLoansAllPages,
  loadCachedLoansInfiniteData,
} from "@/services/loans/local-cache";
import { loadCachedLoanPayments } from "@/services/loans/local-cache";
import {
  syncLoanPaymentsToLocalStores,
} from "@/services/loans/loan-payments-cache";
import { loadCategoryTrees } from "@/services/transactions/categories/category-cache-ops";
import { mapApiCategoryTree } from "@/utils/categoryTreeOptions";
import {
  resolveTransactionCategoryAssignment,
  type CategoryTreeOption,
} from "@/types/categoryTreeTypes";
import type { TransactionCategory } from "@/types/transactionCategoryTypes";
import type { CreateTransactionType, UpdateTransactionType } from "@/services/transactions/mutation";
import type { CreateTransferType } from "@/services/transactions/transfers/mutation";
import type { Account } from "@/types/accountTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

type NamedRecord = {
  id: string;
  name?: string;
  fullName?: string;
};

type RelationIds = {
  entityId?: string | null;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
};

const normalizeName = (value: string): string => value.trim().toLowerCase();

export const firstIdMatchingName = (
  rows: NamedRecord[],
  name: string | undefined | null,
): string | null => {
  const needle = name?.trim();
  if (!needle) {
    return null;
  }

  const normalized = normalizeName(needle);
  const match = rows.find((row) => {
    const candidate = row.name ?? row.fullName ?? "";
    return normalizeName(candidate) === normalized;
  });

  return match?.id ?? null;
};

const flattenCategories = (nodes: TransactionCategory[]): NamedRecord[] =>
  nodes.flatMap((node) => [
    { id: node.id, name: node.name },
    ...flattenCategories(node.children ?? []),
  ]);

const firstPresent = (
  ...values: Array<string | null | undefined>
): string | null => {
  for (const value of values) {
    if (value) {
      return value;
    }
  }

  return null;
};

export const coalesceIndexRelationIds = (params: {
  mapped: RelationIds;
  local?: RelationIds | null;
}): Required<RelationIds> => {
  const { mapped, local } = params;

  return {
    entityId: firstPresent(local?.entityId, mapped.entityId),
    accountId: firstPresent(local?.accountId, mapped.accountId),
    fromAccountId: firstPresent(local?.fromAccountId, mapped.fromAccountId),
    toAccountId: firstPresent(local?.toAccountId, mapped.toAccountId),
  };
};

export const attachCreateTransactionRelationIds = async (
  spaceId: string,
  data: CreateTransactionType,
): Promise<CreateTransactionType> => {
  const needsAccount = !data.accountId && Boolean(data.accountName?.trim());
  const needsEntity = !data.entityId && Boolean(data.entityName?.trim());
  const needsCategory =
    !data.categoryId
    && !data.subcategoryId
    && Boolean(data.categoryName?.trim());

  if (!needsAccount && !needsEntity && !needsCategory) {
    return data;
  }

  const [accounts, entities, categoryTrees, accountResolvers] = await Promise.all([
    needsAccount ? listSpaceAccounts(spaceId) : Promise.resolve([]),
    needsEntity
      ? loadCachedEntitiesResponse(spaceId).then((rows) => rows ?? [])
      : Promise.resolve([]),
    needsCategory ? loadCategoryTrees(spaceId) : Promise.resolve(null),
    needsAccount ? buildAccountNameResolvers(spaceId) : Promise.resolve([]),
  ]);

  const categoryId = needsCategory && categoryTrees
    ? data.categoryId
      ?? firstIdMatchingName(
        flattenCategories([
          ...categoryTrees.expenseCategories,
          ...categoryTrees.incomeCategories,
        ]),
        data.categoryName,
      )
      ?? undefined
    : data.categoryId ?? undefined;

  return {
    ...data,
    accountId:
      data.accountId
      ?? resolveAccountIdForName(accountResolvers, data.accountName)
      ?? firstIdMatchingName(accounts, data.accountName)
      ?? fuzzyResolveAccountIdForName(accounts, data.accountName)
      ?? undefined,
    entityId:
      data.entityId
      ?? firstIdMatchingName(
        entities.map((entity) => ({
          id: entity.id,
          name: entity.fullName,
        })),
        data.entityName,
      )
      ?? undefined,
    categoryId,
  };
};

export const attachUpdateTransactionRelationIds = async (
  spaceId: string,
  data: UpdateTransactionType,
  previous?: Pick<
    IndexTransaction,
    "fromAccountName" | "toAccountName" | "fromAccountId" | "toAccountId" | "accountId" | "type"
  > | null,
): Promise<UpdateTransactionType> => {
  const transactionType =
    data.transactionType
    ?? (previous?.type === CombinedTransactionTypeEnum.INCOME ? "income" : "expense");
  const accountName = data.accountName?.trim() ?? "";
  const previousAccountName =
    transactionType === "income"
      ? previous?.toAccountName
      : previous?.fromAccountName;
  const accountNameChanged = Boolean(
    accountName
    && previousAccountName
    && normalizeName(accountName) !== normalizeName(previousAccountName),
  );
  const needsAccount =
    Boolean(accountName)
    && (!data.accountId || accountNameChanged);

  if (!needsAccount) {
    return data;
  }

  const [accounts, accountResolvers] = await Promise.all([
    listSpaceAccounts(spaceId),
    buildAccountNameResolvers(spaceId),
  ]);

  const resolvedAccountId =
    resolveAccountIdForName(accountResolvers, accountName)
    ?? firstIdMatchingName(accounts, accountName)
    ?? fuzzyResolveAccountIdForName(accounts, accountName)
    ?? undefined;

  return {
    ...data,
    accountId: resolvedAccountId ?? data.accountId,
  };
};

export const attachCreateTransferRelationIds = async (
  spaceId: string,
  data: CreateTransferType,
): Promise<CreateTransferType> => {
  const needsFrom = !data.fromAccountId && Boolean(data.fromAccountName?.trim());
  const needsTo = !data.toAccountId && Boolean(data.toAccountName?.trim());

  if (!needsFrom && !needsTo) {
    return data;
  }

  const accounts = await listSpaceAccounts(spaceId);
  const accountResolvers = await buildAccountNameResolvers(spaceId);
  const fromAccountId =
    data.fromAccountId
    ?? resolveAccountIdForName(accountResolvers, data.fromAccountName)
    ?? firstIdMatchingName(accounts, data.fromAccountName)
    ?? undefined;
  const toAccountId =
    data.toAccountId
    ?? resolveAccountIdForName(accountResolvers, data.toAccountName)
    ?? firstIdMatchingName(accounts, data.toAccountName)
    ?? undefined;

  return {
    ...data,
    fromAccountId,
    toAccountId,
  };
};

export type RelationStampContext = {
  accounts: NamedRecord[];
  accountResolvers: AccountNameResolver[];
  entities: NamedRecord[];
  expenseOptions: CategoryTreeOption[];
  incomeOptions: CategoryTreeOption[];
};

const resolveAccountId = (
  context: RelationStampContext,
  name: string | null | undefined,
): string | null =>
  resolveAccountIdForName(context.accountResolvers, name)
  ?? firstIdMatchingName(context.accounts, name)
  ?? fuzzyResolveAccountIdForName(context.accounts, name);

const accountNameForId = (
  context: RelationStampContext,
  accountId: string | null | undefined,
): string | null => {
  if (!accountId) {
    return null;
  }

  const match = context.accounts.find((row) => row.id === accountId);
  return match?.name ?? null;
};

const entityNameForId = (
  context: RelationStampContext,
  entityId: string | null | undefined,
): string | null => {
  if (!entityId) {
    return null;
  }

  const match = context.entities.find((row) => row.id === entityId);
  return match?.fullName ?? match?.name ?? null;
};

const categoryNamesForAssignment = (
  context: RelationStampContext,
  assignment: { categoryId: string; subcategoryId: string | null },
): { categoryName: string | null; subcategoryName: string | null } => {
  const trees = [context.expenseOptions, context.incomeOptions];

  for (const options of trees) {
    for (const parent of options) {
      if (parent.id === assignment.categoryId) {
        if (assignment.subcategoryId) {
          const child = parent.children?.find(
            (row) => row.id === assignment.subcategoryId,
          );
          return {
            categoryName: parent.name,
            subcategoryName: child?.name ?? null,
          };
        }

        return {
          categoryName: parent.name,
          subcategoryName: null,
        };
      }
    }
  }

  return {
    categoryName: null,
    subcategoryName: null,
  };
};

const namesMatch = (left: string | undefined | null, right: string): boolean =>
  (left ?? "").trim().toLowerCase() === right.trim().toLowerCase();

const transactionReferencesAccount = (
  transaction: IndexTransaction,
  accountId: string,
  previousName?: string,
): boolean => {
  if (
    transaction.accountId === accountId
    || transaction.fromAccountId === accountId
    || transaction.toAccountId === accountId
  ) {
    return true;
  }

  if (!previousName) {
    return false;
  }

  return (
    namesMatch(transaction.fromAccountName, previousName)
    || namesMatch(transaction.toAccountName, previousName)
  );
};

export const loadRelationStampContext = async (
  spaceId: string,
): Promise<RelationStampContext> => {
  const [accounts, accountResolvers, entities, categoryTrees] = await Promise.all([
    listSpaceAccounts(spaceId),
    buildAccountNameResolvers(spaceId),
    loadCachedEntitiesResponse(spaceId).then((rows) => rows ?? []),
    loadCategoryTrees(spaceId),
  ]);

  const expenseOptions = mapApiCategoryTree(
    categoryTrees?.expenseCategories ?? [],
  );
  const incomeOptions = mapApiCategoryTree(
    categoryTrees?.incomeCategories ?? [],
  );

  return {
    accounts,
    accountResolvers,
    entities: entities.map((entity) => ({
      id: entity.id,
      fullName: entity.fullName,
    })),
    expenseOptions,
    incomeOptions,
  };
};

/**
 * Resolve missing relation ids from display names (and prior account names).
 */
export const stampIndexTransactionRelationIds = (
  transaction: IndexTransaction,
  context: RelationStampContext,
): IndexTransaction => {
  const next: IndexTransaction = { ...transaction };

  const fromAccountId =
    next.fromAccountId
    ?? resolveAccountId(context, next.fromAccountName);
  const toAccountId =
    next.toAccountId
    ?? resolveAccountId(context, next.toAccountName);

  if (fromAccountId) {
    next.fromAccountId = fromAccountId;
  }

  if (toAccountId) {
    next.toAccountId = toAccountId;
  }

  if (!next.accountId) {
    if (next.type === CombinedTransactionTypeEnum.INCOME) {
      next.accountId = toAccountId;
    } else if (next.type === CombinedTransactionTypeEnum.EXPENSE) {
      next.accountId = fromAccountId;
    } else {
      next.accountId = fromAccountId ?? toAccountId;
    }
  }

  if (!next.entityId && next.entityName) {
    next.entityId = firstIdMatchingName(context.entities, next.entityName);
  }

  const assignment = resolveTransactionCategoryAssignment(
    {
      categoryId: next.categoryId,
      subcategoryId: next.subcategoryId,
      categoryName: next.categoryName,
      subcategoryName: next.subcategoryName,
    },
    context.expenseOptions,
    context.incomeOptions,
  );

  if (assignment) {
    next.categoryId = assignment.categoryId;
    next.subcategoryId = assignment.subcategoryId;
  }

  return next;
};

/**
 * Refresh display names from resolved relation ids.
 */
export const syncIndexTransactionRelationNames = (
  transaction: IndexTransaction,
  context: RelationStampContext,
): IndexTransaction => {
  const next: IndexTransaction = { ...transaction };

  const fromName = accountNameForId(context, next.fromAccountId);
  if (fromName) {
    next.fromAccountName = fromName;
  }

  const toName = accountNameForId(context, next.toAccountId);
  if (toName) {
    next.toAccountName = toName;
  }

  const entityName = entityNameForId(context, next.entityId);
  if (entityName) {
    next.entityName = entityName;
  }

  if (next.categoryId) {
    const names = categoryNamesForAssignment(context, {
      categoryId: next.categoryId,
      subcategoryId: next.subcategoryId ?? null,
    });

    if (names.categoryName) {
      next.categoryName = names.categoryName;
    }

    if (names.subcategoryName) {
      next.subcategoryName = names.subcategoryName;
    }
  }

  return next;
};

const normalizeStampedTransaction = (
  transaction: IndexTransaction,
  context: RelationStampContext,
): IndexTransaction =>
  syncIndexTransactionRelationNames(
    stampIndexTransactionRelationIds(transaction, context),
    context,
  );

const transactionsEqual = (
  left: IndexTransaction,
  right: IndexTransaction,
): boolean => JSON.stringify(left) === JSON.stringify(right);

/**
 * Backfill relation ids for every transaction in a space IndexedDB table.
 */
export const backfillSpaceTransactionRelationIds = async (
  spaceId: string,
): Promise<number> => {
  if (!spaceId) {
    return 0;
  }

  const [rows, context] = await Promise.all([
    listSpaceTransactions(spaceId),
    loadRelationStampContext(spaceId),
  ]);

  if (rows.length === 0) {
    return 0;
  }

  const nextRows: IndexTransaction[] = [];
  let changedCount = 0;

  for (const row of rows) {
    const next = normalizeStampedTransaction(row, context);
    if (!transactionsEqual(row, next)) {
      changedCount += 1;
    }
    nextRows.push(next);
  }

  if (changedCount > 0) {
    await putSpaceTransactions(spaceId, nextRows);
  }

  await backfillLoanAccountNames(spaceId, context);

  return changedCount;
};

const backfillLoanAccountNames = async (
  spaceId: string,
  context: RelationStampContext,
): Promise<void> => {
  const cached = await loadCachedLoansInfiniteData(spaceId);
  if (!cached?.pages?.length) {
    return;
  }

  let changed = false;
  const pages = cached.pages.map((page) => ({
    ...page,
    loans: (page.loans ?? []).map((loan) => {
      const accountId =
        resolveAccountId(context, loan.accountName)
        ?? fuzzyResolveAccountIdForName(context.accounts, loan.accountName);

      if (!accountId) {
        return loan;
      }

      const accountName = accountNameForId(context, accountId);
      if (!accountName || namesMatch(loan.accountName, accountName)) {
        return loan;
      }

      changed = true;
      return {
        ...loan,
        accountName,
      };
    }),
  }));

  if (changed) {
    await cacheLoansAllPages(spaceId, pages);
  }
};

const patchTransactionForAccountUpdate = (
  transaction: IndexTransaction,
  params: {
    accountId: string;
    previousAccount: Account;
    nextAccount: Account;
    context: RelationStampContext;
  },
): IndexTransaction => {
  const { accountId, previousAccount, nextAccount, context } = params;

  if (
    !transactionReferencesAccount(
      transaction,
      accountId,
      previousAccount.name,
    )
  ) {
    return transaction;
  }

  let next: IndexTransaction = { ...transaction };

  if (
    namesMatch(next.fromAccountName, previousAccount.name)
    || next.fromAccountId === accountId
  ) {
    next.fromAccountId = accountId;
    next.fromAccountName = nextAccount.name;
  }

  if (
    namesMatch(next.toAccountName, previousAccount.name)
    || next.toAccountId === accountId
  ) {
    next.toAccountId = accountId;
    next.toAccountName = nextAccount.name;
  }

  if (
    next.type === CombinedTransactionTypeEnum.EXPENSE
    && (next.fromAccountId === accountId || next.accountId === accountId)
  ) {
    next.accountId = accountId;
  }

  if (
    next.type === CombinedTransactionTypeEnum.INCOME
    && (next.toAccountId === accountId || next.accountId === accountId)
  ) {
    next.accountId = accountId;
  }

  next = normalizeStampedTransaction(next, context);
  return next;
};

const patchLoansForAccountUpdate = async (params: {
  spaceId: string;
  previousAccount: Account;
  nextAccount: Account;
}): Promise<void> => {
  const { spaceId, previousAccount, nextAccount } = params;
  const cached = await loadCachedLoansInfiniteData(spaceId);
  if (!cached?.pages?.length) {
    return;
  }

  let changed = false;
  const pages = cached.pages.map((page) => ({
    ...page,
    loans: (page.loans ?? []).map((loan) => {
      if (!namesMatch(loan.accountName, previousAccount.name)) {
        return loan;
      }

      changed = true;
      return {
        ...loan,
        accountName: nextAccount.name,
      };
    }),
  }));

  if (changed) {
    await cacheLoansAllPages(spaceId, pages);
  }
};

const patchLoanPaymentsForAccountUpdate = async (params: {
  spaceId: string;
  accountId: string;
  previousAccount: Account;
  nextAccount: Account;
}): Promise<void> => {
  const { spaceId, accountId, previousAccount, nextAccount } = params;
  const cachedLoans = await loadCachedLoansInfiniteData(spaceId);
  const loanIds = (cachedLoans?.pages ?? []).flatMap((page) =>
    (page.loans ?? []).map((loan) => loan.id),
  );

  for (const loanId of loanIds) {
    const payments = await loadCachedLoanPayments(spaceId, loanId);
    if (!payments?.length) {
      continue;
    }

    let changed = false;
    const nextPayments = payments.map((payment) => {
      const touches =
        payment.accountId === accountId
        || namesMatch(payment.accountName, previousAccount.name);

      if (!touches) {
        return payment;
      }

      changed = true;
      return {
        ...payment,
        accountId,
        accountName: nextAccount.name,
      };
    });

    if (changed) {
      await syncLoanPaymentsToLocalStores({
        spaceCode: spaceId,
        loanId,
        payments: nextPayments,
      });
    }
  }
};

/**
 * Keep transactions, loans, and loan payments linked after an account rename.
 */
export const patchLinkedDataForAccountUpdate = async (params: {
  spaceId: string;
  accountId: string;
  previousAccount: Account;
  nextAccount: Account;
}): Promise<number> => {
  const { spaceId, accountId, previousAccount, nextAccount } = params;

  if (!spaceId || !accountId) {
    return 0;
  }

  const [rows, context] = await Promise.all([
    listSpaceTransactions(spaceId),
    loadRelationStampContext(spaceId),
  ]);

  const nextRows: IndexTransaction[] = [];
  let changedCount = 0;

  for (const row of rows) {
    const next = patchTransactionForAccountUpdate(row, {
      accountId,
      previousAccount,
      nextAccount,
      context,
    });

    if (!transactionsEqual(row, next)) {
      changedCount += 1;
    }

    nextRows.push(next);
  }

  if (changedCount > 0) {
    await putSpaceTransactions(spaceId, nextRows);
  }

  await patchLoansForAccountUpdate({
    spaceId,
    previousAccount,
    nextAccount,
  });
  await patchLoanPaymentsForAccountUpdate({
    spaceId,
    accountId,
    previousAccount,
    nextAccount,
  });

  return changedCount;
};

const relationBackfillPromises = new Map<string, Promise<number>>();

/** Idempotent per-space backfill (deduped while in flight). */
export const ensureSpaceTransactionRelationIds = async (
  spaceId: string,
): Promise<void> => {
  if (!spaceId) {
    return;
  }

  const inFlight = relationBackfillPromises.get(spaceId);
  if (inFlight) {
    await inFlight;
    return;
  }

  const promise = backfillSpaceTransactionRelationIds(spaceId);
  relationBackfillPromises.set(spaceId, promise);

  try {
    await promise;
  } finally {
    relationBackfillPromises.delete(spaceId);
  }
};

