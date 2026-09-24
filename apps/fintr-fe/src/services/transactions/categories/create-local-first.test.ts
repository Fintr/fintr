import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  OUTBOX_COMMAND_CATEGORY_CREATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { cacheTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";
import { loadCategoryTrees } from "@/services/transactions/categories/category-cache-ops";
import { CategoryTypeEnum } from "@/types/categoryTypes";

vi.mock("@/services/transactions/categories/mutation", () => ({
  createTransactionCategory: vi.fn(),
}));

import { createTransactionCategory } from "@/services/transactions/categories/mutation";
import { createCategoryLocalFirst } from "./create-local-first";

const baseTrees = () => ({
  data: {
    expenseCategories: [
      {
        id: "cat-1",
        name: "Food",
        categoryType: CategoryTypeEnum.EXPENSE,
        parentId: null,
        icon: "utensils",
        color: "#000000",
        children: [],
      },
    ],
    incomeCategories: [],
  },
});

describe("createCategoryLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("adds the category to local trees immediately without waiting for Rails", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());
    vi.mocked(createTransactionCategory).mockImplementation(
      () => new Promise(() => {}),
    );

    const result = await createCategoryLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        data: {
          name: "Church",
          categoryType: CategoryTypeEnum.EXPENSE,
          parentId: null,
          icon: "church",
          color: "#112233",
        },
      },
      { waitForSync: false },
    );

    expect(result.data.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.pendingSync).toBe(true);

    const trees = await loadCategoryTrees("space-a");
    expect(trees.expenseCategories.map((category) => category.name)).toEqual([
      "Food",
      "Church",
    ]);

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_CATEGORY_CREATE);
  });

  it("replaces the local id without wiping the optimistic name when Rails returns only an id", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());
    vi.mocked(createTransactionCategory).mockResolvedValue({
      success: true,
      data: { id: "server-cat" },
    });

    const result = await createCategoryLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        data: {
          name: "Church",
          categoryType: CategoryTypeEnum.EXPENSE,
          parentId: null,
        },
      },
      { waitForSync: true },
    );

    expect(result.data.id).toBe("server-cat");
    expect(createTransactionCategory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        id: expect.any(String),
        name: "Church",
        categoryType: CategoryTypeEnum.EXPENSE,
      }),
    );

    const trees = await loadCategoryTrees("space-a");
    const created = trees.expenseCategories.find(
      (category) => category.id === "server-cat",
    );
    expect(created?.name).toBe("Church");
  });
});
