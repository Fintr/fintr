import type { QueryClient } from "@tanstack/react-query";

import {
  cacheTransactionCategoriesResponse,
  loadCachedTransactionCategoriesResponse,
} from "@/services/transactions/categories/local-cache";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import type { TransactionCategory } from "@/types/transactionCategoryTypes";
import { normalizeCategoryTreeNodes } from "@/utils/categoryTreeOptions";

export type CategoryTrees = {
  expenseCategories: TransactionCategory[];
  incomeCategories: TransactionCategory[];
};

const categoryListKey = (
  categoryType: CategoryTypeEnum,
): keyof CategoryTrees =>
  categoryType === CategoryTypeEnum.INCOME
    ? "incomeCategories"
    : "expenseCategories";

export const extractCategoryTrees = (response: unknown): CategoryTrees => {
  if (!response || typeof response !== "object") {
    return { expenseCategories: [], incomeCategories: [] };
  }

  const root = response as Record<string, unknown>;
  const data =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  return {
    expenseCategories: normalizeCategoryTreeNodes(
      data.expenseCategories ?? data.expense_categories,
    ),
    incomeCategories: normalizeCategoryTreeNodes(
      data.incomeCategories ?? data.income_categories,
    ),
  };
};

export const wrapCategoryTrees = (trees: CategoryTrees): { data: CategoryTrees } => ({
  data: trees,
});

const insertCategoryInTree = (
  nodes: TransactionCategory[],
  parentId: string | null | undefined,
  category: TransactionCategory,
): TransactionCategory[] => {
  if (!parentId) {
    return [...nodes, category];
  }

  return nodes.map((node) => {
    if (node.id === parentId) {
      return {
        ...node,
        children: [...(node.children ?? []), category],
      };
    }

    if (node.children?.length) {
      return {
        ...node,
        children: insertCategoryInTree(node.children, parentId, category),
      };
    }

    return node;
  });
};

const updateCategoryInTree = (
  nodes: TransactionCategory[],
  categoryId: string,
  updates: Partial<TransactionCategory>,
): TransactionCategory[] =>
  nodes.map((node) => {
    if (node.id === categoryId) {
      return { ...node, ...updates };
    }

    if (node.children?.length) {
      return {
        ...node,
        children: updateCategoryInTree(node.children, categoryId, updates),
      };
    }

    return node;
  });

const removeCategoryFromTree = (
  nodes: TransactionCategory[],
  categoryId: string,
): TransactionCategory[] =>
  nodes
    .filter((node) => node.id !== categoryId)
    .map((node) => ({
      ...node,
      children: node.children
        ? removeCategoryFromTree(node.children, categoryId)
        : [],
    }));

const replaceCategoryIdInTree = (
  nodes: TransactionCategory[],
  localId: string,
  serverId: string,
): TransactionCategory[] =>
  nodes.map((node) => {
    const nextId = node.id === localId ? serverId : node.id;
    return {
      ...node,
      id: nextId,
      children: node.children
        ? replaceCategoryIdInTree(node.children, localId, serverId)
        : [],
    };
  });

export const addCategoryToTrees = (
  trees: CategoryTrees,
  category: TransactionCategory,
): CategoryTrees => {
  const key = categoryListKey(category.categoryType);

  return {
    ...trees,
    [key]: insertCategoryInTree(trees[key], category.parentId, category),
  };
};

export const updateCategoryInTrees = (
  trees: CategoryTrees,
  categoryId: string,
  updates: Partial<TransactionCategory>,
): CategoryTrees => ({
  expenseCategories: updateCategoryInTree(
    trees.expenseCategories,
    categoryId,
    updates,
  ),
  incomeCategories: updateCategoryInTree(
    trees.incomeCategories,
    categoryId,
    updates,
  ),
});

export const removeCategoryFromTrees = (
  trees: CategoryTrees,
  categoryId: string,
): CategoryTrees => ({
  expenseCategories: removeCategoryFromTree(
    trees.expenseCategories,
    categoryId,
  ),
  incomeCategories: removeCategoryFromTree(
    trees.incomeCategories,
    categoryId,
  ),
});

export const replaceCategoryIdInTrees = (
  trees: CategoryTrees,
  localId: string,
  serverId: string,
): CategoryTrees => ({
  expenseCategories: replaceCategoryIdInTree(
    trees.expenseCategories,
    localId,
    serverId,
  ),
  incomeCategories: replaceCategoryIdInTree(
    trees.incomeCategories,
    localId,
    serverId,
  ),
});

export const moveCategoryInTrees = (
  trees: CategoryTrees,
  categoryId: string,
  newParentId: string | null,
): CategoryTrees => {
  const category = findCategoryInTrees(trees, categoryId);
  if (!category) {
    return trees;
  }

  const without = removeCategoryFromTrees(trees, categoryId);
  return addCategoryToTrees(without, {
    ...category,
    parentId: newParentId,
  });
};

export const findCategoryInTrees = (
  trees: CategoryTrees,
  categoryId: string,
): TransactionCategory | undefined => {
  const walk = (nodes: TransactionCategory[]): TransactionCategory | undefined => {
    for (const node of nodes) {
      if (node.id === categoryId) {
        return node;
      }

      const child = node.children ? walk(node.children) : undefined;
      if (child) {
        return child;
      }
    }

    return undefined;
  };

  return (
    walk(trees.expenseCategories) ?? walk(trees.incomeCategories)
  );
};

export const applyCategoryTreesToCaches = async (params: {
  spaceCode: string;
  trees: CategoryTrees;
  queryClient?: QueryClient;
}): Promise<void> => {
  const { spaceCode, trees, queryClient } = params;
  const payload = wrapCategoryTrees(trees);

  await cacheTransactionCategoriesResponse(spaceCode, payload);

  if (!queryClient) {
    return;
  }

  queryClient.setQueryData(["transactionCategories", spaceCode], payload);
  queryClient.setQueryData(
    ["transactionCategories", "local", spaceCode],
    payload,
  );
};

export const loadCategoryTrees = async (
  spaceCode: string,
): Promise<CategoryTrees> => {
  const cached = await loadCachedTransactionCategoriesResponse(spaceCode);
  return extractCategoryTrees(cached);
};
