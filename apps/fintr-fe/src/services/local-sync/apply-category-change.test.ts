import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { CategoryTypeEnum } from "@/types/categoryTypes";
import { cacheTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";
import { loadCachedTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";
import { resetLocalDbForTests } from "@/lib/local-db";
import { applyCategoryUpdated } from "./apply-category-change";

const baseTrees = () => ({
  data: {
    expenseCategories: [
      {
        id: "cat-transport",
        name: "Transportation",
        categoryType: CategoryTypeEnum.EXPENSE,
        parentId: null,
        icon: "tag",
        color: "#000000",
        children: [],
      },
    ],
    incomeCategories: [],
  },
});

describe("applyCategoryUpdated", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
    queryClient.clear();
  });

  it("patches the cached category tree from a sync payload", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());

    await applyCategoryUpdated({
      spaceId: "space-a",
      queryClient,
      change: {
        seq: 1,
        op: "category.updated",
        occurredAt: new Date().toISOString(),
        payload: {
          category: {
            id: "cat-transport",
            name: "Transportation",
            category_type: "expense",
            icon: "car",
            color: "#ff0000",
          },
        },
      },
    });

    const cached = await loadCachedTransactionCategoriesResponse("space-a");
    const expense = cached?.data?.expenseCategories?.[0];
    expect(expense?.icon).toBe("car");
    expect(expense?.name).toBe("Transportation");
  });
});
