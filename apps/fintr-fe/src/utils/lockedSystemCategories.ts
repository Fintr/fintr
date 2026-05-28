import {
  CategoryTreeOption,
  normalizeCategoryMatchKey,
} from "@/types/categoryTreeTypes";

export const TRANSFER_FEE_CATEGORY_NAME = "Transfer Fee";
export const EXPENSE_ADJUSTMENT_CATEGORY_NAME = "Expense Adjustment";
export const INCOME_ADJUSTMENT_CATEGORY_NAME = "Income Adjustment";

const LOCKED_EXPENSE_CATEGORY_NAMES = [
  TRANSFER_FEE_CATEGORY_NAME,
  EXPENSE_ADJUSTMENT_CATEGORY_NAME,
] as const;

const LOCKED_INCOME_CATEGORY_NAMES = [INCOME_ADJUSTMENT_CATEGORY_NAME] as const;

const matchesLockedName = (
  name: string | undefined | null,
  lockedNames: readonly string[],
): boolean => {
  if (!name?.trim()) {
    return false;
  }

  const key = normalizeCategoryMatchKey(name);

  return lockedNames.some(
    (locked) => normalizeCategoryMatchKey(locked) === key,
  );
};

export const isLockedExpenseCategoryName = (
  name: string | undefined | null,
): boolean => matchesLockedName(name, LOCKED_EXPENSE_CATEGORY_NAMES);

export const isLockedIncomeCategoryName = (
  name: string | undefined | null,
): boolean => matchesLockedName(name, LOCKED_INCOME_CATEGORY_NAMES);

export type LockedCategoryRef = {
  id: string;
  name: string;
};

/** Ensures excluded system categories appear in the picker tree when editing their transactions. */
export const ensureLockedCategoryInTreeOptions = (
  options: CategoryTreeOption[],
  locked: LockedCategoryRef | null,
): CategoryTreeOption[] => {
  if (!locked?.id?.trim() || !locked.name?.trim()) {
    return options;
  }

  if (options.some((option) => option.id === locked.id)) {
    return options;
  }

  return [
    {
      id: locked.id,
      label: locked.name,
      value: locked.id,
      name: locked.name,
      parentId: null,
      children: [],
    },
    ...options,
  ];
};

export const lockedCategoryRefForExpenseEdit = (
  isEditMode: boolean,
  categoryName: string | undefined,
  categoryId: string | undefined,
): LockedCategoryRef | null => {
  if (!isEditMode || !isLockedExpenseCategoryName(categoryName)) {
    return null;
  }

  const id = categoryId?.trim();
  const name = categoryName?.trim();

  if (!id || !name) {
    return null;
  }

  return { id, name };
};

export const lockedCategoryRefForIncomeEdit = (
  isEditMode: boolean,
  categoryName: string | undefined,
  categoryId: string | undefined,
): LockedCategoryRef | null => {
  if (!isEditMode || !isLockedIncomeCategoryName(categoryName)) {
    return null;
  }

  const id = categoryId?.trim();
  const name = categoryName?.trim();

  if (!id || !name) {
    return null;
  }

  return { id, name };
};
