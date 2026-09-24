import type { BudgetsPage } from "@/types/budgetTypes";

export type BudgetRow = Record<string, unknown> & {
  id: string;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};

const pickNumber = (
  row: Record<string, unknown>,
  ...keys: string[]
): number => {
  for (const key of keys) {
    if (row[key] != null && row[key] !== "") {
      const value = Number(row[key]);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }

  return 0;
};

const pickString = (
  row: Record<string, unknown>,
  ...keys: string[]
): string => {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return "";
};

const normalizeSubcategoryRow = (value: unknown): BudgetRow => {
  const row = asRecord(value);
  const amount = pickNumber(row, "budget", "amount");

  return {
    ...row,
    id: pickString(row, "id"),
    subcategoryId: pickString(row, "subcategoryId", "subcategory_id"),
    subcategory_id: pickString(row, "subcategoryId", "subcategory_id"),
    subcategoryName: pickString(
      row,
      "subcategoryName",
      "subcategory_name",
      "name",
    ),
    subcategory_name: pickString(
      row,
      "subcategoryName",
      "subcategory_name",
      "name",
    ),
    name: pickString(row, "subcategoryName", "subcategory_name", "name"),
    spent: pickNumber(row, "spent", "total_spent", "totalSpent"),
    budget: amount,
    amount,
  };
};

const normalizeParentBudgetRow = (value: unknown): BudgetRow => {
  const row = asRecord(value);
  const subcategories = Array.isArray(row.subcategories)
    ? row.subcategories.map(normalizeSubcategoryRow)
    : [];

  return {
    ...row,
    id: pickString(row, "id"),
    date: pickString(row, "date"),
    category_name: pickString(row, "category_name", "categoryName"),
    category_id: pickString(row, "category_id", "categoryId"),
    categoryId: pickString(row, "category_id", "categoryId"),
    subcategory_id: row.subcategoryId ?? row.subcategory_id ?? null,
    total_spent: pickNumber(row, "total_spent", "totalSpent"),
    amount_currency: pickString(
      row,
      "amount_currency",
      "amountCurrency",
    ) || "PHP",
    amount: pickNumber(row, "amount", "budget"),
    has_explicit_parent_budget: Boolean(
      row.has_explicit_parent_budget ?? row.hasExplicitParentBudget,
    ),
    parent_only_spent: pickNumber(
      row,
      "parent_only_spent",
      "parentOnlySpent",
    ),
    subcategories,
  };
};

export const recalculateBudgetSummary = (page: BudgetsPage): BudgetsPage => {
  const rows = (page.budgets ?? []) as BudgetRow[];
  let total_budget = 0;
  let total_spent = 0;

  for (const row of rows) {
    total_budget += pickNumber(row, "amount", "budget");
    total_spent += pickNumber(row, "total_spent", "totalSpent");
  }

  const remaining = total_budget - total_spent;
  const total_spent_percentage =
    total_budget > 0 ? (total_spent / total_budget) * 100 : null;

  return {
    ...page,
    summary: {
      total_budget,
      total_spent,
      total_spent_percentage,
      remaining,
    },
  };
};

export const normalizeBudgetsPage = (page: unknown): BudgetsPage => {
  const root = asRecord(page);
  const budgets = Array.isArray(root.budgets) ? root.budgets : [];

  return recalculateBudgetSummary({
    budgets: budgets.map(normalizeParentBudgetRow) as BudgetsPage["budgets"],
    summary: null,
    nextPage: (root.nextPage as number | null) ?? null,
    totalPages: (root.totalPages as number | null) ?? null,
    totalCount: (root.totalCount as number | null) ?? null,
  });
};
