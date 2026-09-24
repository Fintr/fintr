import { recalculateBudgetSummary, type BudgetRow } from "./budget-cache-ops";
import { getMonthDateRange } from "@/utils/dateUtils";
import type { BudgetsPage } from "@/types/budgetTypes";

const YEAR_MONTH = /^(\d{4})-(\d{2})/;

const defaultCreateId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `local:${crypto.randomUUID()}`;
  }

  return `local:budget-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isPersistedBudgetId = (id: unknown): boolean => {
  const value = String(id ?? "").trim();
  return value.length > 0 && !value.startsWith("parent:");
};

const asBudgetRow = (value: unknown): BudgetRow =>
  (value ?? {}) as BudgetRow;

const categoryIdOf = (row: BudgetRow): string =>
  String(row.category_id ?? row.categoryId ?? "").trim();

const subcategoryIdOf = (row: BudgetRow): string =>
  String(row.subcategory_id ?? row.subcategoryId ?? "").trim();

const hasExplicitParentBudget = (row: BudgetRow): boolean =>
  Boolean(row.has_explicit_parent_budget ?? row.hasExplicitParentBudget);

export const previousCalendarMonthRange = (
  startDate: string,
): { startDate: string; endDate: string } | null => {
  const match = YEAR_MONTH.exec(startDate);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month === 1) {
    return getMonthDateRange(year - 1, 12);
  }

  return getMonthDateRange(year, month - 1);
};

export const calendarMonthStartDate = (startDate: string): string => {
  const match = YEAR_MONTH.exec(startDate);
  if (!match) {
    return startDate;
  }

  return `${match[1]}-${match[2]}-01`;
};

export const calendarMonthRangeFromStart = (
  startDate: string,
): { startDate: string; endDate: string } | null => {
  const match = YEAR_MONTH.exec(startDate);
  if (!match) {
    return null;
  }

  return getMonthDateRange(Number(match[1]), Number(match[2]));
};

export const monthHasPersistedBudgets = (
  page: BudgetsPage | null | undefined,
): boolean => {
  if (!page?.budgets?.length) {
    return false;
  }

  return page.budgets.some((row) => {
    const parent = asBudgetRow(row);
    if (isPersistedBudgetId(parent.id) && !String(parent.id).startsWith("parent:")) {
      return true;
    }

    const subcategories = Array.isArray(parent.subcategories)
      ? parent.subcategories
      : [];

    return subcategories.some((sub) =>
      isPersistedBudgetId(asBudgetRow(sub).id),
    );
  });
};

const emptyBudgetsPage = (): BudgetsPage => ({
  budgets: [],
  summary: null,
  nextPage: null,
  totalPages: null,
  totalCount: null,
});

const copySubcategoryRow = (
  sub: BudgetRow,
  targetStartDate: string,
  createId: () => string,
): BudgetRow | null => {
  if (!isPersistedBudgetId(sub.id)) {
    return null;
  }

  return {
    ...sub,
    id: createId(),
    date: targetStartDate,
    spent: 0,
    total_spent: 0,
  };
};

const existingSubcategoryIds = (row: BudgetRow): Set<string> => {
  const subcategories = Array.isArray(row.subcategories)
    ? row.subcategories.map(asBudgetRow)
    : [];

  return new Set(
    subcategories
      .map((sub) => subcategoryIdOf(sub))
      .filter(Boolean),
  );
};

const mergeParentFromPrevious = (params: {
  previous: BudgetRow;
  existing: BudgetRow | undefined;
  targetStartDate: string;
  createId: () => string;
}): BudgetRow => {
  const { previous, existing, targetStartDate, createId } = params;
  const previousSubs = Array.isArray(previous.subcategories)
    ? previous.subcategories.map(asBudgetRow)
    : [];
  const categoryId = categoryIdOf(previous) || categoryIdOf(existing ?? previous);

  if (existing) {
    const presentSubIds = existingSubcategoryIds(existing);
    const existingSubs = Array.isArray(existing.subcategories)
      ? existing.subcategories.map(asBudgetRow)
      : [];
    const copiedSubs = previousSubs
      .filter((sub) => {
        const subId = subcategoryIdOf(sub);
        return isPersistedBudgetId(sub.id) && subId && !presentSubIds.has(subId);
      })
      .map((sub) => copySubcategoryRow(sub, targetStartDate, createId))
      .filter((sub): sub is BudgetRow => sub != null);

    return {
      ...existing,
      subcategories: [...existingSubs, ...copiedSubs],
    };
  }

  const parentId = hasExplicitParentBudget(previous)
    ? createId()
    : `parent:${categoryId || String(previous.id)}`;

  const copiedSubs = previousSubs
    .map((sub) => copySubcategoryRow(sub, targetStartDate, createId))
    .filter((sub): sub is BudgetRow => sub != null);

  return {
    ...previous,
    id: parentId,
    date: targetStartDate,
    total_spent: 0,
    parent_only_spent: 0,
    subcategories: copiedSubs,
  };
};

export const createMonthlyBudgetsPage = (params: {
  previousPage: BudgetsPage;
  existingPage?: BudgetsPage;
  targetStartDate: string;
  createId?: () => string;
}): BudgetsPage => {
  const createId = params.createId ?? defaultCreateId;
  const targetStartDate = calendarMonthStartDate(params.targetStartDate);
  const existingRows = (params.existingPage?.budgets ?? []).map(asBudgetRow);
  const existingByCategory = new Map(
    existingRows
      .map((row) => [categoryIdOf(row), row] as const)
      .filter(([categoryId]) => categoryId.length > 0),
  );
  const seenCategories = new Set<string>();
  const copied: BudgetRow[] = [];

  for (const raw of params.previousPage.budgets) {
    const previous = asBudgetRow(raw);
    const categoryId = categoryIdOf(previous);
    const existing = categoryId
      ? existingByCategory.get(categoryId)
      : undefined;
    const merged = mergeParentFromPrevious({
      previous,
      existing,
      targetStartDate,
      createId,
    });
    const mergedSubs = Array.isArray(merged.subcategories)
      ? merged.subcategories.map(asBudgetRow)
      : [];
    const hasCopiedParent = hasExplicitParentBudget(previous)
      && String(merged.id).startsWith("local:");
    const hasCopiedSub = mergedSubs.some((sub) =>
      String(sub.id).startsWith("local:"),
    );

    if (!existing && !hasCopiedParent && mergedSubs.length === 0 && !hasCopiedSub) {
      continue;
    }

    copied.push(merged);
    if (categoryId) {
      seenCategories.add(categoryId);
    }
  }

  for (const existing of existingRows) {
    const categoryId = categoryIdOf(existing);
    if (categoryId && seenCategories.has(categoryId)) {
      continue;
    }

    copied.push(existing);
  }

  if (copied.length === 0) {
    return emptyBudgetsPage();
  }

  return recalculateBudgetSummary({
    budgets: copied as BudgetsPage["budgets"],
    summary: null,
    nextPage: params.existingPage?.nextPage ?? params.previousPage.nextPage ?? null,
    totalPages: params.existingPage?.totalPages ?? params.previousPage.totalPages ?? null,
    totalCount: params.existingPage?.totalCount ?? params.previousPage.totalCount ?? null,
  });
};
