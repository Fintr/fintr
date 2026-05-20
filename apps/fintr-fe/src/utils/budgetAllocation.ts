import { parseCategoryPickerValue } from "@/types/categoryTreeTypes";
import { BudgetsPage } from "@/types/budgetTypes";

export type BudgetApiRow = {
  id: string;
  category_id: string;
  subcategory_id?: string | null;
  amount: number;
  date?: string;
  has_explicit_parent_budget?: boolean;
  subcategories?: Array<{
    id: string;
    subcategoryId: string;
    subcategoryName?: string;
    name: string;
    budget: number;
    spent?: number;
  }>;
};

export type BudgetAllocationContext = {
  isSubcategory: boolean;
  parentCap: number;
  allocatedToSubs: number;
  hasExplicitParentBudget: boolean;
  remainingAfterAmount: number;
};

export const firstDayOfMonth = (isoDate: string): string => {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-01`;
};

export const findParentBudgetRow = (
  budgets: BudgetApiRow[] | undefined,
  categoryId: string,
): BudgetApiRow | undefined => {
  if (!budgets?.length) {
    return undefined;
  }

  return budgets.find(
    (row) => row.category_id === categoryId && !row.subcategory_id,
  );
};

export const sumSubcategoryBudgets = (
  parentRow: BudgetApiRow | undefined,
  exclude?: { subcategoryId?: string; budgetId?: string },
): number => {
  if (!parentRow?.subcategories?.length) {
    return 0;
  }

  return parentRow.subcategories
    .filter((sub) => {
      if (exclude?.budgetId && sub.id === exclude.budgetId) {
        return false;
      }

      if (exclude?.subcategoryId && sub.subcategoryId === exclude.subcategoryId) {
        return false;
      }

      return true;
    })
    .reduce((sum, sub) => sum + Number(sub.budget ?? 0), 0);
};

export const buildBudgetAllocationContext = (params: {
  categoryValue: string;
  amount: number;
  budgetsData?: BudgetsPage;
  exclude?: { subcategoryId?: string; budgetId?: string };
}): BudgetAllocationContext | null => {
  const assignment = parseCategoryPickerValue(params.categoryValue);
  if (!assignment) {
    return null;
  }

  const rows = params.budgetsData?.budgets as BudgetApiRow[] | undefined;
  const parentRow = findParentBudgetRow(rows, assignment.categoryId);
  const hasExplicitParentBudget = Boolean(parentRow?.has_explicit_parent_budget);
  const parentCap = Number(parentRow?.amount ?? 0);
  const allocatedToSubs = sumSubcategoryBudgets(parentRow, params.exclude);
  const isSubcategory = Boolean(assignment.subcategoryId);

  const remainingAfterAmount = isSubcategory
    ? parentCap - allocatedToSubs - params.amount
    : params.amount - allocatedToSubs;

  return {
    isSubcategory,
    parentCap,
    allocatedToSubs,
    hasExplicitParentBudget,
    remainingAfterAmount,
  };
};

export const formatBudgetAllocationHint = (
  context: BudgetAllocationContext,
  spaceCurrency: string,
  formatCurrency: (amount: number, currency: string) => string,
): string | null => {
  if (context.isSubcategory) {
    if (!context.hasExplicitParentBudget) {
      return "Create a parent budget for this category before adding a subcategory budget.";
    }

    return `Parent budget ${formatCurrency(context.parentCap, spaceCurrency)} · Subcategories allocated ${formatCurrency(context.allocatedToSubs, spaceCurrency)} · Remaining after this amount ${formatCurrency(context.remainingAfterAmount, spaceCurrency)}`;
  }

  if (context.allocatedToSubs > 0) {
    return `Subcategories already total ${formatCurrency(context.allocatedToSubs, spaceCurrency)}. Parent budget must be at least that amount. Remaining headroom ${formatCurrency(context.remainingAfterAmount, spaceCurrency)}.`;
  }

  return null;
};

export type SubcategoryBudgetLine = {
  subcategoryId: string;
  subcategoryName: string;
  budgetId?: string;
  amount: number;
};

export const mergeSubcategoryBudgetLines = (
  categoryChildren: Array<{ id: string; label: string }>,
  existingSubcategories: Array<{
    id?: string;
    subcategoryId?: string;
    subcategoryName?: string;
    name?: string;
    budget?: number;
  }>,
): SubcategoryBudgetLine[] => {
  const existingBySubId = new Map(
    existingSubcategories
      .filter((sub) => sub.subcategoryId)
      .map((sub) => [String(sub.subcategoryId), sub]),
  );

  return categoryChildren.map((child) => {
    const existing = existingBySubId.get(child.id);

    return {
      subcategoryId: child.id,
      subcategoryName: child.label,
      budgetId: existing?.id || undefined,
      amount: Number(existing?.budget ?? 0),
    };
  });
};

export const sumSubcategoryBudgetLines = (lines: SubcategoryBudgetLine[]): number =>
  lines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0);

export const isSubcategoryTotalOverParent = (
  parentAmount: number,
  subcategoryLines: SubcategoryBudgetLine[],
): boolean => sumSubcategoryBudgetLines(subcategoryLines) > parentAmount;

export const isBudgetOverAllocation = (
  context: BudgetAllocationContext | null,
  amount: number,
): boolean => {
  if (!context) {
    return false;
  }

  if (context.isSubcategory) {
    if (!context.hasExplicitParentBudget) {
      return true;
    }

    return context.allocatedToSubs + amount > context.parentCap;
  }

  return amount < context.allocatedToSubs;
};
