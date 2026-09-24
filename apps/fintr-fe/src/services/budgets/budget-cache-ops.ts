import type { QueryClient } from "@tanstack/react-query";

import type { BudgetsPage } from "@/types/budgetTypes";

import {
  cacheBudgetsResponse,
  loadCachedBudgetsResponse,
} from "./local-cache";
import {
  type BudgetRow,
  normalizeBudgetsPage,
  recalculateBudgetSummary,
} from "./normalize-budgets-page";

export type { BudgetRow };
export { normalizeBudgetsPage, recalculateBudgetSummary };

export type BudgetLocation =
  | {
      kind: "parent";
      index: number;
      row: BudgetRow;
    }
  | {
      kind: "subcategory";
      parentIndex: number;
      subIndex: number;
      row: BudgetRow;
      parent: BudgetRow;
    };

const getBudgetRows = (page: BudgetsPage): BudgetRow[] =>
  page.budgets as BudgetRow[];

export const loadBudgetsPage = async (
  spaceCode: string,
  startDate: string,
  endDate: string,
): Promise<BudgetsPage | undefined> =>
  loadCachedBudgetsResponse(spaceCode, startDate, endDate);

export const applyBudgetsPageToCaches = async (params: {
  spaceCode: string;
  startDate: string;
  endDate: string;
  page: BudgetsPage;
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceCode, startDate, endDate, page, queryClient } = params;

  await cacheBudgetsResponse(spaceCode, startDate, endDate, page);

  if (!queryClient) {
    return;
  }

  queryClient.setQueryData(["budgets", spaceCode, startDate, endDate], page);
  queryClient.setQueryData(
    ["budgets", "local", spaceCode, startDate, endDate],
    page,
  );
};

export const findBudgetLocation = (
  page: BudgetsPage,
  budgetId: string,
): BudgetLocation | undefined => {
  const budgets = getBudgetRows(page);

  for (let index = 0; index < budgets.length; index += 1) {
    const row = budgets[index];

    if (String(row.id) === budgetId) {
      return { kind: "parent", index, row };
    }

    const subcategories = Array.isArray(row.subcategories)
      ? row.subcategories
      : [];

    for (let subIndex = 0; subIndex < subcategories.length; subIndex += 1) {
      const sub = subcategories[subIndex] as BudgetRow;

      if (String(sub.id) === budgetId) {
        return {
          kind: "subcategory",
          parentIndex: index,
          subIndex,
          row: sub,
          parent: row,
        };
      }
    }
  }

  return undefined;
};

export const addParentBudgetRowToPage = (
  page: BudgetsPage,
  row: BudgetRow,
): BudgetsPage =>
  recalculateBudgetSummary({
    ...page,
    budgets: [...getBudgetRows(page), row],
  });

export const updateBudgetRowInPage = (
  page: BudgetsPage,
  budgetId: string,
  updates: Partial<BudgetRow>,
): BudgetsPage => {
  const location = findBudgetLocation(page, budgetId);

  if (!location) {
    return page;
  }

  const budgets = [...getBudgetRows(page)];

  if (location.kind === "parent") {
    budgets[location.index] = {
      ...location.row,
      ...updates,
    };
  } else {
    const parent = { ...budgets[location.parentIndex] };
    const subcategories = Array.isArray(parent.subcategories)
      ? [...parent.subcategories]
      : [];
    const sub = { ...location.row, ...updates } as BudgetRow;

    if (updates.amount != null) {
      sub.budget = updates.amount;
    }

    subcategories[location.subIndex] = sub;
    parent.subcategories = subcategories;
    budgets[location.parentIndex] = parent;
  }

  return recalculateBudgetSummary({
    ...page,
    budgets,
  });
};

export const removeBudgetRowFromPage = (
  page: BudgetsPage,
  budgetId: string,
): BudgetsPage => {
  const location = findBudgetLocation(page, budgetId);

  if (!location) {
    return page;
  }

  const budgets = [...getBudgetRows(page)];

  if (location.kind === "parent") {
    return recalculateBudgetSummary({
      ...page,
      budgets: budgets.filter((row) => String(row.id) !== budgetId),
    });
  }

  const parent = { ...budgets[location.parentIndex] };
  const subcategories = Array.isArray(parent.subcategories)
    ? [...parent.subcategories]
    : [];
  parent.subcategories = subcategories.filter(
    (sub) => String((sub as BudgetRow).id) !== budgetId,
  );
  budgets[location.parentIndex] = parent;

  return recalculateBudgetSummary({
    ...page,
    budgets,
  });
};

export const replaceBudgetIdInPage = (
  page: BudgetsPage,
  localId: string,
  serverId: string,
): BudgetsPage => {
  const location = findBudgetLocation(page, localId);

  if (!location) {
    return page;
  }

  return updateBudgetRowInPage(page, localId, { id: serverId });
};

export const upsertSubcategoryBudgetInPage = (
  page: BudgetsPage,
  params: {
    categoryId: string;
    subcategoryId: string;
    budgetId: string;
    amount: number;
    date: string;
    subcategoryName?: string;
    amountCurrency?: string;
  },
): BudgetsPage => {
  const {
    categoryId,
    subcategoryId,
    budgetId,
    amount,
    date,
    subcategoryName,
    amountCurrency = "PHP",
  } = params;

  const budgets = [...getBudgetRows(page)];
  const parentIndex = budgets.findIndex(
    (row) => String(row.category_id ?? row.categoryId ?? "") === categoryId,
  );

  const subcategoryEntry: BudgetRow = {
    id: budgetId,
    subcategoryId,
    subcategory_id: subcategoryId,
    subcategoryName: subcategoryName ?? "",
    subcategory_name: subcategoryName ?? "",
    name: subcategoryName ?? "",
    spent: 0,
    budget: amount,
    amount,
  };

  if (parentIndex >= 0) {
    const parent = { ...budgets[parentIndex] };
    const subcategories = Array.isArray(parent.subcategories)
      ? [...parent.subcategories]
      : [];
    const existingIndex = subcategories.findIndex(
      (sub) =>
        String((sub as BudgetRow).subcategoryId ?? (sub as BudgetRow).subcategory_id ?? "")
        === subcategoryId,
    );

    if (existingIndex >= 0) {
      subcategories[existingIndex] = {
        ...(subcategories[existingIndex] as BudgetRow),
        ...subcategoryEntry,
      };
    } else {
      subcategories.push(subcategoryEntry);
    }

    parent.subcategories = subcategories;
    budgets[parentIndex] = parent;
  } else {
    budgets.push({
      id: `parent:${categoryId}`,
      date,
      category_id: categoryId,
      categoryId,
      category_name: "",
      total_spent: 0,
      amount_currency: amountCurrency,
      amount: 0,
      has_explicit_parent_budget: false,
      parent_only_spent: 0,
      subcategories: [subcategoryEntry],
    });
  }

  return recalculateBudgetSummary({
    ...page,
    budgets,
  });
};
