import type { QueryClient } from "@tanstack/react-query";

import { CategoryTypeEnum } from "@/types/categoryTypes";
import type { TransactionCategory } from "@/types/transactionCategoryTypes";
import type { CategoryChangePayload, SpaceChange, SyncCategory } from "@/types/syncTypes";
import { resolveCategoryAppearance } from "@/utils/categoryAppearance";

import {
  addCategoryToTrees,
  applyCategoryTreesToCaches,
  loadCategoryTrees,
  removeCategoryFromTrees,
  updateCategoryInTrees,
} from "@/services/transactions/categories/category-cache-ops";

const asString = (value: unknown): string =>
  value == null ? "" : String(value);

const readField = (
  record: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
): unknown => record[camelKey] ?? record[snakeKey];

const normalizeSyncCategory = (raw: SyncCategory): TransactionCategory | null => {
  const id = asString(raw.id);
  if (!id) {
    return null;
  }

  const record = raw as Record<string, unknown>;
  const categoryTypeRaw = asString(
    readField(record, "categoryType", "category_type"),
  );
  const name = asString(record.name);
  const appearance = resolveCategoryAppearance({
    name,
    categoryType:
      categoryTypeRaw === CategoryTypeEnum.INCOME
        ? CategoryTypeEnum.INCOME
        : CategoryTypeEnum.EXPENSE,
    icon: readField(record, "icon", "icon") as string | null | undefined,
    color: readField(record, "color", "color") as string | null | undefined,
  });

  const parentIdRaw = readField(record, "parentId", "parent_id");

  return {
    id,
    name,
    categoryType:
      categoryTypeRaw === CategoryTypeEnum.INCOME
        ? CategoryTypeEnum.INCOME
        : CategoryTypeEnum.EXPENSE,
    parentId:
      parentIdRaw == null || parentIdRaw === ""
        ? null
        : asString(parentIdRaw),
    icon: appearance.icon,
    color: appearance.color,
    children: [],
  };
};

const readCategoryFromPayload = (
  payload: CategoryChangePayload,
): TransactionCategory | null => {
  if (!("category" in payload) || !payload.category) {
    return null;
  }

  return normalizeSyncCategory(payload.category);
};

const readCategoryIdFromPayload = (payload: CategoryChangePayload): string => {
  if ("categoryId" in payload) {
    return asString(payload.categoryId);
  }

  if ("category" in payload && payload.category) {
    return asString(payload.category.id);
  }

  return "";
};

export const applyCategoryCreated = async (params: {
  spaceId: string;
  change: SpaceChange;
  queryClient: QueryClient;
}): Promise<void> => {
  const category = readCategoryFromPayload(
    params.change.payload as CategoryChangePayload,
  );
  if (!category) {
    return;
  }

  const trees = await loadCategoryTrees(params.spaceId);
  const nextTrees = addCategoryToTrees(trees, category);
  await applyCategoryTreesToCaches({
    spaceCode: params.spaceId,
    trees: nextTrees,
    queryClient: params.queryClient,
  });
};

export const applyCategoryUpdated = async (params: {
  spaceId: string;
  change: SpaceChange;
  queryClient: QueryClient;
}): Promise<void> => {
  const category = readCategoryFromPayload(
    params.change.payload as CategoryChangePayload,
  );
  if (!category) {
    return;
  }

  const trees = await loadCategoryTrees(params.spaceId);
  const nextTrees = updateCategoryInTrees(trees, category.id, {
    name: category.name,
    icon: category.icon,
    color: category.color,
    categoryType: category.categoryType,
    parentId: category.parentId,
  });
  await applyCategoryTreesToCaches({
    spaceCode: params.spaceId,
    trees: nextTrees,
    queryClient: params.queryClient,
  });
};

export const applyCategoryDeleted = async (params: {
  spaceId: string;
  change: SpaceChange;
  queryClient: QueryClient;
}): Promise<void> => {
  const categoryId = readCategoryIdFromPayload(
    params.change.payload as CategoryChangePayload,
  );
  if (!categoryId) {
    return;
  }

  const trees = await loadCategoryTrees(params.spaceId);
  const nextTrees = removeCategoryFromTrees(trees, categoryId);
  await applyCategoryTreesToCaches({
    spaceCode: params.spaceId,
    trees: nextTrees,
    queryClient: params.queryClient,
  });
};
