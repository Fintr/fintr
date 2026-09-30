import type { QueryClient } from "@tanstack/react-query";

import type { BudgetsPage } from "@/types/budgetTypes";

import { budgetDeletionsForMonth } from "./budget-deletions";
import { pageWithoutOmittedBudgets } from "./create-monthly-budget";
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

export const budgetsPageForNetworkCache = (params: {
  fetched: BudgetsPage;
  local: BudgetsPage | undefined;
}): BudgetsPage => {
  if (!params.local) {
    return params.fetched;
  }

  return mergeSavedLocalBudgets(params.fetched, params.local);
};

export const loadBudgetsPage = async (
  spaceCode: string,
  startDate: string,
  endDate: string,
): Promise<BudgetsPage | undefined> =>
  loadCachedBudgetsResponse(spaceCode, startDate, endDate);

let budgetsCacheWrite: Promise<unknown> = Promise.resolve();

const writeBudgetsPageToCaches = async (params: {
  spaceCode: string;
  startDate: string;
  endDate: string;
  page: BudgetsPage;
  queryClient?: QueryClient;
}): Promise<BudgetsPage> => {
  const { spaceCode, startDate, endDate, page, queryClient } = params;
  const omissions = await budgetDeletionsForMonth(spaceCode, startDate);
  const incoming = pageWithoutOmittedBudgets(page, omissions);
  const current = await loadBudgetsPage(spaceCode, startDate, endDate);
  const pageToStore = current
    ? mergeSavedLocalBudgets(
        incoming,
        pageWithoutOmittedBudgets(current, omissions),
        { keepComputedAmount: true },
      )
    : incoming;

  await cacheBudgetsResponse(spaceCode, startDate, endDate, pageToStore);

  if (queryClient) {
    queryClient.setQueryData(
      ["budgets", spaceCode, startDate, endDate],
      pageToStore,
    );
    queryClient.setQueryData(
      ["budgets", "local", spaceCode, startDate, endDate],
      pageToStore,
    );
  }

  return pageToStore;
};

export const applyBudgetsPageToCaches = (
  params: {
    spaceCode: string;
    startDate: string;
    endDate: string;
    page: BudgetsPage;
    queryClient?: QueryClient;
  },
): Promise<BudgetsPage> => {
  const write = budgetsCacheWrite.then(() => writeBudgetsPageToCaches(params));
  budgetsCacheWrite = write.then(
    () => undefined,
    () => undefined,
  );

  return write;
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

const categoryIdOfRow = (row: BudgetRow): string =>
  String(row.category_id ?? row.categoryId ?? "");

const isPlaceholderBudgetId = (id: unknown): boolean => {
  const value = String(id ?? "").trim();
  return value.length === 0 || value.startsWith("parent:");
};

const placeholderIndexForCategory = (
  rows: BudgetRow[],
  categoryId: string,
): number => {
  if (!categoryId) {
    return -1;
  }

  return rows.findIndex((row) => {
    if (categoryIdOfRow(row) !== categoryId) {
      return false;
    }

    return isPlaceholderBudgetId(row.id);
  });
};

export const addParentBudgetRowToPage = (
  page: BudgetsPage,
  row: BudgetRow,
): BudgetsPage => {
  const budgets = [...getBudgetRows(page)];
  const categoryId = categoryIdOfRow(row);
  const placeholderIndex = placeholderIndexForCategory(budgets, categoryId);
  const nextRow: BudgetRow = {
    ...row,
    has_explicit_parent_budget: true,
  };

  if (placeholderIndex >= 0) {
    const existing = budgets[placeholderIndex];
    budgets[placeholderIndex] = {
      ...existing,
      ...nextRow,
      total_spent: existing.total_spent ?? nextRow.total_spent,
      parent_only_spent: existing.parent_only_spent ?? nextRow.parent_only_spent,
      subcategories: existing.subcategories ?? nextRow.subcategories ?? [],
    };
  } else {
    budgets.push(nextRow);
  }

  return recalculateBudgetSummary({
    ...page,
    budgets,
  });
};

export const mergeSavedLocalBudgets = (
  computed: BudgetsPage,
  latest: BudgetsPage,
  options?: { keepComputedAmount?: boolean },
): BudgetsPage => {
  const computedRows = [...getBudgetRows(computed)];
  let changed = false;

  for (const latestRow of getBudgetRows(latest)) {
    const latestId = String(latestRow.id ?? "");
    if (isPlaceholderBudgetId(latestId)) {
      continue;
    }

    const sameIdIndex = computedRows.findIndex(
      (row) => String(row.id ?? "") === latestId,
    );
    if (sameIdIndex >= 0) {
      if (options?.keepComputedAmount) {
        continue;
      }

      const current = computedRows[sameIdIndex];
      const latestAmount = Number(latestRow.amount ?? latestRow.budget ?? 0);
      if (Number(current.amount ?? current.budget ?? 0) === latestAmount) {
        continue;
      }

      computedRows[sameIdIndex] = {
        ...current,
        amount: latestAmount,
        budget: latestAmount,
        has_explicit_parent_budget:
          latestRow.has_explicit_parent_budget
          ?? current.has_explicit_parent_budget,
      };
      changed = true;
      continue;
    }

    const categoryId = categoryIdOfRow(latestRow);
    const placeholderIndex = placeholderIndexForCategory(
      computedRows,
      categoryId,
    );

    if (placeholderIndex >= 0) {
      const placeholder = computedRows[placeholderIndex];
      computedRows[placeholderIndex] = {
        ...placeholder,
        ...latestRow,
        total_spent: placeholder.total_spent ?? latestRow.total_spent,
        parent_only_spent:
          placeholder.parent_only_spent ?? latestRow.parent_only_spent,
        subcategories:
          Array.isArray(latestRow.subcategories)
          && latestRow.subcategories.length > 0
            ? latestRow.subcategories
            : placeholder.subcategories,
        has_explicit_parent_budget: true,
      };
      changed = true;
      continue;
    }

    const alreadyBudgeted = computedRows.some((row) => {
      if (categoryIdOfRow(row) !== categoryId) {
        return false;
      }

      return !isPlaceholderBudgetId(row.id);
    });
    if (alreadyBudgeted || !categoryId) {
      continue;
    }

    computedRows.push(latestRow);
    changed = true;
  }

  if (!changed) {
    return computed;
  }

  return recalculateBudgetSummary({
    ...computed,
    budgets: computedRows,
  });
};

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

export const commitCreatedBudgetToPage = (params: {
  page: BudgetsPage;
  localId: string;
  serverId: string;
  row: BudgetRow;
}): BudgetsPage => {
  const amount = Number(params.row.amount ?? params.row.budget ?? 0);
  const serverId = params.serverId || params.localId;
  let page = params.page;
  const hasLocal = Boolean(findBudgetLocation(page, params.localId));
  const hasServer = serverId !== params.localId
    && Boolean(findBudgetLocation(page, serverId));

  if (!hasLocal && !hasServer) {
    const subcategoryId = String(
      params.row.subcategory_id ?? params.row.subcategoryId ?? "",
    );
    const categoryId = categoryIdOfRow(params.row);

    if (subcategoryId && categoryId) {
      page = upsertSubcategoryBudgetInPage(page, {
        categoryId,
        subcategoryId,
        budgetId: params.localId,
        amount,
        date: String(params.row.date ?? ""),
        subcategoryName: String(
          params.row.subcategory_name ?? params.row.name ?? "",
        ),
        amountCurrency: String(params.row.amount_currency ?? "PHP"),
      });
    } else {
      page = addParentBudgetRowToPage(page, {
        ...params.row,
        id: params.localId,
        amount,
        budget: amount,
        has_explicit_parent_budget: true,
      });
    }
  } else if (hasLocal) {
    page = updateBudgetRowInPage(page, params.localId, {
      amount,
      budget: amount,
      has_explicit_parent_budget: true,
    });
  }

  if (
    serverId !== params.localId
    && findBudgetLocation(page, params.localId)
  ) {
    return replaceBudgetIdInPage(page, params.localId, serverId);
  }

  if (hasServer) {
    return updateBudgetRowInPage(page, serverId, {
      amount,
      budget: amount,
      has_explicit_parent_budget: true,
    });
  }

  return page;
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
