import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import {
  enqueueOutboxRecord,
  getLocalDb,
  OUTBOX_COMMAND_BUDGET_CREATE,
} from "@/lib/local-db";
import { listSpaceTransactionsInDateRange } from "@/lib/local-db/transactions";
import type { BudgetsPage } from "@/types/budgetTypes";
import type { CreateBudgetPayload } from "@/types/budgetTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  applyBudgetsPageToCaches,
  loadBudgetsPage,
  mergeSavedLocalBudgets,
  recalculateBudgetSummary,
  type BudgetRow,
} from "./budget-cache-ops";
import { normalizeBudgetsPage } from "./normalize-budgets-page";
import { budgetDeletionsForMonth } from "./budget-deletions";
import {
  calendarMonthRangeFromStart,
  calendarMonthStartDate,
  createMonthlyBudgetsPage,
  pageWithoutOmittedBudgets,
  previousCalendarMonthRange,
} from "./create-monthly-budget";

export type EnsureMonthlyBudgetsLocalFirstResult = {
  created: boolean;
  page: BudgetsPage;
  pendingSync: boolean;
  syncPromise: Promise<EnsureMonthlyBudgetsLocalFirstResult>;
};

export type EnsureMonthlyBudgetsLocalFirstOptions = {
  queryClient?: QueryClient;
  waitForSync?: boolean;
};

const emptyBudgetsPage = (): BudgetsPage => ({
  budgets: [],
  summary: null,
  nextPage: null,
  totalPages: null,
  totalCount: null,
});

const unchangedResult = (
  page: BudgetsPage,
  created: boolean,
): EnsureMonthlyBudgetsLocalFirstResult => {
  const result: EnsureMonthlyBudgetsLocalFirstResult = {
    created,
    page,
    pendingSync: created,
    syncPromise: Promise.resolve(null as never),
  };
  result.syncPromise = Promise.resolve(result);
  return result;
};

const queuedBudgetCreateLocalIds = async (
  spaceCode: string,
): Promise<Set<string>> => {
  const rows = await getLocalDb()
    .outbox
    .where("spaceId")
    .equals(spaceCode)
    .toArray();

  return new Set(
    rows
      .filter((row) => row.commandType === OUTBOX_COMMAND_BUDGET_CREATE)
      .filter((row) => row.status === "pending" || row.status === "syncing")
      .map((row) => {
        const payload = row.payload as { localId?: string };
        return String(payload.localId ?? "");
      })
      .filter((localId) => localId.length > 0),
  );
};

const newClientMutationId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `cid-budget-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const asBudgetRow = (value: unknown): BudgetRow =>
  (value ?? {}) as BudgetRow;

const isExpense = (tx: IndexTransaction): boolean => {
  const type = String(tx.type ?? "").trim().toLowerCase();
  if (!type) {
    return true;
  }

  return (
    type === CombinedTransactionTypeEnum.EXPENSE
    || type === "transactions::expense"
    || type.endsWith("::expense")
    || type === "expense"
  );
};

const transactionAmount = (tx: IndexTransaction): number => {
  const spaceAmount = tx.amountInSpaceCurrency?.amount;
  if (typeof spaceAmount === "number" && Number.isFinite(spaceAmount)) {
    return Math.abs(spaceAmount);
  }

  const amount = Number(tx.amount);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
};

export const applyBudgetSpendingToPage = (
  page: BudgetsPage,
  transactions: IndexTransaction[],
): BudgetsPage => {
  const expenses = transactions.filter(
    (tx) =>
      isExpense(tx)
      && tx.calculated !== false
      && Boolean(tx.categoryId)
      && tx.categoryName !== "Initial Balance",
  );

  const nextRows = page.budgets.map((raw) => {
    const row = asBudgetRow(raw);
    const categoryId = String(row.category_id ?? row.categoryId ?? "");
    const categoryExpenses = expenses.filter(
      (tx) => String(tx.categoryId ?? "") === categoryId,
    );
    const totalSpent = categoryExpenses.length > 0
      ? categoryExpenses.reduce(
          (sum, tx) => sum + transactionAmount(tx),
          0,
        )
      : Number(row.total_spent ?? row.totalSpent ?? 0);
    const parentOnlySpent = categoryExpenses.length > 0
      ? categoryExpenses
        .filter((tx) => !tx.subcategoryId)
        .reduce((sum, tx) => sum + transactionAmount(tx), 0)
      : Number(row.parent_only_spent ?? row.parentOnlySpent ?? 0);
    const subcategories = Array.isArray(row.subcategories)
      ? row.subcategories.map((subRaw) => {
          const sub = asBudgetRow(subRaw);
          const subcategoryId = String(
            sub.subcategory_id ?? sub.subcategoryId ?? "",
          );
          const spent = subcategoryId
            && categoryExpenses.some(
              (tx) => String(tx.subcategoryId ?? "") === subcategoryId,
            )
            ? categoryExpenses
              .filter((tx) => String(tx.subcategoryId ?? "") === subcategoryId)
              .reduce((sum, tx) => sum + transactionAmount(tx), 0)
            : Number(sub.spent ?? sub.total_spent ?? 0);

          return {
            ...sub,
            spent,
          };
        })
      : [];

    return {
      ...row,
      total_spent: totalSpent,
      parent_only_spent: parentOnlySpent,
      subcategories,
    };
  });

  const budgetedCategoryIds = new Set(
    nextRows
      .map((row) => String(row.category_id ?? row.categoryId ?? ""))
      .filter(Boolean),
  );

  for (const [categoryId, bucket] of unbudgetedExpenseBuckets(
    expenses,
    budgetedCategoryIds,
  )) {
    const subcategories = [...bucket.subcategories.entries()].map(
      ([subcategoryId, sub]) => ({
        id: "",
        category_id: categoryId,
        subcategory_id: subcategoryId,
        subcategory_name: sub.name,
        amount: 0,
        budget: 0,
        spent: sub.spent,
      }),
    );

    nextRows.push({
      id: "",
      category_id: categoryId,
      categoryId,
      category_name: bucket.name,
      amount: 0,
      budget: 0,
      total_spent: bucket.total,
      has_explicit_parent_budget: false,
      parent_only_spent: subcategories.length > 0 ? bucket.parentOnly : 0,
      subcategories,
    });
  }

  return recalculateBudgetSummary({
    ...page,
    budgets: nextRows as BudgetsPage["budgets"],
  });
};

type UnbudgetedExpenseBucket = {
  name: string;
  total: number;
  parentOnly: number;
  subcategories: Map<string, { name: string; spent: number }>;
};

const unbudgetedExpenseBuckets = (
  expenses: IndexTransaction[],
  budgetedCategoryIds: Set<string>,
): Map<string, UnbudgetedExpenseBucket> => {
  const buckets = new Map<string, UnbudgetedExpenseBucket>();

  for (const tx of expenses) {
    const categoryId = String(tx.categoryId ?? "");
    if (!categoryId || budgetedCategoryIds.has(categoryId)) {
      continue;
    }

    let bucket = buckets.get(categoryId);
    if (!bucket) {
      bucket = {
        name: tx.categoryName || "Category",
        total: 0,
        parentOnly: 0,
        subcategories: new Map(),
      };
      buckets.set(categoryId, bucket);
    }

    const amount = transactionAmount(tx);
    bucket.total += amount;
    const subcategoryId = String(tx.subcategoryId ?? "");
    if (!subcategoryId) {
      bucket.parentOnly += amount;
      continue;
    }

    const existing = bucket.subcategories.get(subcategoryId);
    if (existing) {
      existing.spent += amount;
      continue;
    }

    bucket.subcategories.set(subcategoryId, {
      name: tx.subcategoryName || "Subcategory",
      spent: amount,
    });
  }

  return buckets;
};

const collectLocalCreates = (params: {
  page: BudgetsPage;
  startDate: string;
  endDate: string;
}): Array<CreateBudgetPayload & { localId: string; startDate: string; endDate: string }> => {
  const { page, startDate, endDate } = params;
  const date = calendarMonthStartDate(startDate);
  const creates: Array<
    CreateBudgetPayload & { localId: string; startDate: string; endDate: string }
  > = [];

  for (const raw of page.budgets) {
    const row = asBudgetRow(raw);
    const categoryId = String(row.category_id ?? row.categoryId ?? "");
    const categoryName = String(row.category_name ?? row.categoryName ?? "");

    if (
      String(row.id).startsWith("local:")
      && Boolean(row.has_explicit_parent_budget ?? row.hasExplicitParentBudget)
    ) {
      creates.push({
        localId: String(row.id),
        startDate,
        endDate,
        amount: Number(row.amount ?? 0),
        date,
        categoryId,
        categoryName,
        subcategoryId: null,
      });
    }

    const subcategories = Array.isArray(row.subcategories)
      ? row.subcategories.map(asBudgetRow)
      : [];

    for (const sub of subcategories) {
      if (!String(sub.id).startsWith("local:")) {
        continue;
      }

      creates.push({
        localId: String(sub.id),
        startDate,
        endDate,
        amount: Number(sub.amount ?? sub.budget ?? 0),
        date,
        categoryId,
        categoryName: String(
          sub.subcategory_name ?? sub.subcategoryName ?? sub.name ?? categoryName,
        ),
        subcategoryId: String(sub.subcategory_id ?? sub.subcategoryId ?? "") || null,
      });
    }
  }

  return creates;
};

const MAX_ENSURE_LOOKBACK_MONTHS = 12;

/**
 * Copy last month's budget rows into this month in IndexedDB, then enqueue
 * `budget.create` commands so Rails receives the new rows from local.
 *
 * Walks back up to a year of calendar months so opening the app after it was
 * off over a month boundary still copies last month's rows forward.
 */
export const ensureMonthlyBudgetsLocalFirst = async (
  _api: AxiosInstance,
  params: {
    spaceCode: string;
    startDate: string;
    endDate: string;
  },
  options: EnsureMonthlyBudgetsLocalFirstOptions = {},
): Promise<EnsureMonthlyBudgetsLocalFirstResult> => {
  return ensureMonthlyBudgetsForRange(_api, params, options, 0);
};

const ensureMonthlyBudgetsForRange = async (
  _api: AxiosInstance,
  params: {
    spaceCode: string;
    startDate: string;
    endDate: string;
  },
  options: EnsureMonthlyBudgetsLocalFirstOptions,
  lookbackDepth: number,
): Promise<EnsureMonthlyBudgetsLocalFirstResult> => {
  const { spaceCode, startDate, endDate } = params;
  const { queryClient } = options;
  const targetRange = calendarMonthRangeFromStart(startDate) ?? {
    startDate,
    endDate,
  };

  if (!spaceCode) {
    const existingPage = normalizeBudgetsPage(
      (await loadBudgetsPage(spaceCode, startDate, endDate))
      ?? emptyBudgetsPage(),
    );
    return unchangedResult(existingPage, false);
  }

  const previousRange = previousCalendarMonthRange(startDate);
  if (previousRange && lookbackDepth < MAX_ENSURE_LOOKBACK_MONTHS) {
    await ensureMonthlyBudgetsForRange(
      _api,
      {
        spaceCode,
        startDate: previousRange.startDate,
        endDate: previousRange.endDate,
      },
      options,
      lookbackDepth + 1,
    );
  }

  const existingPage = normalizeBudgetsPage(
    (await loadBudgetsPage(spaceCode, startDate, endDate))
    ?? (await loadBudgetsPage(
      spaceCode,
      targetRange.startDate,
      targetRange.endDate,
    ))
    ?? emptyBudgetsPage(),
  );

  const previousPage = previousRange
    ? normalizeBudgetsPage(
        (await loadBudgetsPage(
          spaceCode,
          previousRange.startDate,
          previousRange.endDate,
        )) ?? emptyBudgetsPage(),
      )
    : emptyBudgetsPage();
  const omittedBudgets = await budgetDeletionsForMonth(
    spaceCode,
    targetRange.startDate,
  );
  const existingWithoutDeleted = pageWithoutOmittedBudgets(
    existingPage,
    omittedBudgets,
  );

  const mergedPage = createMonthlyBudgetsPage({
    previousPage,
    existingPage: existingWithoutDeleted,
    targetStartDate: targetRange.startDate,
    omittedBudgets,
  });

  const transactions = await listSpaceTransactionsInDateRange(
    spaceCode,
    startDate,
    endDate,
  );
  const nextPage = applyBudgetSpendingToPage(mergedPage, transactions);
  const latestOmissions = await budgetDeletionsForMonth(
    spaceCode,
    targetRange.startDate,
  );
  const latestPage = normalizeBudgetsPage(
    (await loadBudgetsPage(spaceCode, startDate, endDate))
    ?? emptyBudgetsPage(),
  );
  const pageToSave = mergeSavedLocalBudgets(
    pageWithoutOmittedBudgets(nextPage, latestOmissions),
    pageWithoutOmittedBudgets(latestPage, latestOmissions),
  );
  const creates = collectLocalCreates({
    page: pageToSave,
    startDate,
    endDate,
  });

  const storedPage = await applyBudgetsPageToCaches({
    spaceCode,
    startDate,
    endDate,
    page: pageToSave,
    queryClient,
  });

  const queuedLocalIds = await queuedBudgetCreateLocalIds(spaceCode);
  const pendingCreates = creates.filter(
    (create) => !queuedLocalIds.has(create.localId),
  );

  if (pendingCreates.length === 0) {
    return unchangedResult(storedPage, false);
  }

  for (const create of pendingCreates) {
    const clientMutationId = newClientMutationId();
    await enqueueOutboxRecord({
      spaceId: spaceCode,
      commandType: OUTBOX_COMMAND_BUDGET_CREATE,
      payload: create,
      clientMutationId,
    });
  }

  return unchangedResult(storedPage, true);
};

export const catchUpMonthlyBudgetsLocalFirst = async (
  api: AxiosInstance,
  params: {
    spaceCode: string;
    asOfStartDate?: string;
  },
  options: EnsureMonthlyBudgetsLocalFirstOptions = {},
): Promise<EnsureMonthlyBudgetsLocalFirstResult> => {
  const now = new Date();
  const asOfStartDate = params.asOfStartDate
    ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const range = calendarMonthRangeFromStart(asOfStartDate) ?? {
    startDate: asOfStartDate,
    endDate: asOfStartDate,
  };

  return ensureMonthlyBudgetsLocalFirst(
    api,
    {
      spaceCode: params.spaceCode,
      startDate: range.startDate,
      endDate: range.endDate,
    },
    options,
  );
};
