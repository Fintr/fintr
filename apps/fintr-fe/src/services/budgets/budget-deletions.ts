import { getLocalDb } from "@/lib/local-db";

import {
  calendarMonthStartDate,
  type OmittedBudgetCopy,
} from "./create-monthly-budget";

export type BudgetDeletion = OmittedBudgetCopy & {
  monthStart: string;
  budgetId: string;
};

const deletionsKey = (spaceCode: string): string =>
  `budgetDeletions:${spaceCode}`;

const asDeletions = (value: unknown): BudgetDeletion[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const row = entry as Partial<BudgetDeletion>;
    const categoryId = String(row.categoryId ?? "").trim();
    const budgetId = String(row.budgetId ?? "").trim();
    const monthStart = String(row.monthStart ?? "").trim();
    if (!categoryId || !budgetId || !monthStart) {
      return [];
    }

    return [
      {
        monthStart,
        categoryId,
        subcategoryId: row.subcategoryId ? String(row.subcategoryId) : null,
        budgetId,
      },
    ];
  });
};

export const loadBudgetDeletions = async (
  spaceCode: string,
): Promise<BudgetDeletion[]> => {
  if (!spaceCode) {
    return [];
  }

  const row = await getLocalDb().meta.get(deletionsKey(spaceCode));
  return asDeletions(row?.value);
};

export const budgetDeletionsForMonth = async (
  spaceCode: string,
  startDate: string,
): Promise<BudgetDeletion[]> => {
  const monthStart = calendarMonthStartDate(startDate);
  const deletions = await loadBudgetDeletions(spaceCode);

  return deletions.filter((deletion) => deletion.monthStart === monthStart);
};

export const rememberBudgetDeletion = async (params: {
  spaceCode: string;
  monthStart: string;
  categoryId: string;
  subcategoryId?: string | null;
  budgetId: string;
}): Promise<void> => {
  const categoryId = params.categoryId.trim();
  const budgetId = params.budgetId.trim();
  if (!params.spaceCode || !categoryId || !budgetId) {
    return;
  }

  const next: BudgetDeletion = {
    monthStart: calendarMonthStartDate(params.monthStart),
    categoryId,
    subcategoryId: params.subcategoryId ? params.subcategoryId : null,
    budgetId,
  };
  const existing = await loadBudgetDeletions(params.spaceCode);
  const withoutSame = existing.filter(
    (row) =>
      !(
        row.monthStart === next.monthStart
        && row.categoryId === next.categoryId
        && (row.subcategoryId ?? null) === next.subcategoryId
        && row.budgetId === next.budgetId
      ),
  );

  await getLocalDb().meta.put({
    key: deletionsKey(params.spaceCode),
    value: [...withoutSame, next],
  });
};

export const forgetBudgetDeletion = async (params: {
  spaceCode: string;
  monthStart: string;
  categoryId: string;
  subcategoryId?: string | null;
}): Promise<void> => {
  if (!params.spaceCode || !params.categoryId) {
    return;
  }

  const monthStart = calendarMonthStartDate(params.monthStart);
  const subcategoryId = params.subcategoryId ? params.subcategoryId : null;
  const existing = await loadBudgetDeletions(params.spaceCode);

  await getLocalDb().meta.put({
    key: deletionsKey(params.spaceCode),
    value: existing.filter(
      (row) =>
        !(
          row.monthStart === monthStart
          && row.categoryId === params.categoryId
          && (row.subcategoryId ?? null) === subcategoryId
        ),
    ),
  });
};
