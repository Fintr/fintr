import { CategoryTypeEnum } from "@/types/categoryTypes";
import { TransactionCategory } from "@/types/transactionCategoryTypes";

export type CategoryKind = "expense" | "income";

export const categoryKindToEnum = (kind: CategoryKind): CategoryTypeEnum =>
  kind === "income" ? CategoryTypeEnum.INCOME : CategoryTypeEnum.EXPENSE;

export const categoryEnumToKind = (
  categoryType: CategoryTypeEnum,
): CategoryKind =>
  categoryType === CategoryTypeEnum.INCOME ? "income" : "expense";

export const buildCategoryDetailHref = (
  categoryId: string,
  kind: CategoryKind,
): string =>
  `/dashboard/space_settings/categories/detail?categoryId=${encodeURIComponent(categoryId)}&kind=${kind}`;

export const findRootCategory = (
  trees: TransactionCategory[],
  categoryId: string,
): TransactionCategory | null => {
  for (const root of trees) {
    if (root.id === categoryId) {
      return root;
    }
  }

  return null;
};

export const findCategoryInTree = (
  trees: TransactionCategory[],
  categoryId: string,
): { root: TransactionCategory; category: TransactionCategory; isSubcategory: boolean } | null => {
  for (const root of trees) {
    if (root.id === categoryId) {
      return { root, category: root, isSubcategory: false };
    }

    for (const child of root.children ?? []) {
      if (child.id === categoryId) {
        return { root, category: child, isSubcategory: true };
      }
    }
  }

  return null;
};

export const subcategoryCountLabel = (count: number): string => {
  if (count === 0) {
    return "No subcategories";
  }

  if (count === 1) {
    return "1 subcategory";
  }

  return `${count} subcategories`;
};

/** Short count for GridPicker category tiles (e.g. "1 sub", "2 subs"). */
export const gridPickerSubcategoryCountLabel = (
  count: number,
): string | null => {
  if (count <= 0) {
    return null;
  }

  if (count === 1) {
    return "1 sub";
  }

  return `${count} subs`;
};
