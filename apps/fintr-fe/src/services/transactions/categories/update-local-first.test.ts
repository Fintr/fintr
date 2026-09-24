import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  OUTBOX_COMMAND_CATEGORY_UPDATE,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import { cacheTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";

vi.mock("@/services/transactions/categories/mutation", () => ({
  updateTransactionCategory: vi.fn(),
}));

vi.mock("@/services/local-sync/drain-outbox", () => ({
  scheduleOutboxDrain: vi.fn(),
}));

import { updateTransactionCategory } from "@/services/transactions/categories/mutation";
import { updateCategoryLocalFirst } from "./update-local-first";

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

describe("updateCategoryLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("keeps pending outbox when network fails", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());
    vi.mocked(updateTransactionCategory).mockRejectedValue(
      new Error("Failed to update category"),
    );

    const result = await updateCategoryLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        categoryId: "cat-1",
        updateData: {
          name: "Groceries",
        },
      },
      { waitForSync: true },
    );

    expect(result.pendingSync).toBe(true);
    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_CATEGORY_UPDATE);
  });

  it("does not call the API when the browser is offline", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());
    vi.spyOn(globalThis, "navigator", "get").mockReturnValue({
      onLine: false,
    } as Navigator);

    const result = await updateCategoryLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        categoryId: "cat-1",
        updateData: {
          name: "Groceries",
          icon: "car",
        },
      },
      { waitForSync: true },
    );

    expect(result.pendingSync).toBe(true);
    expect(updateTransactionCategory).not.toHaveBeenCalled();
    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox[0]?.status).toBe("pending");
  });
});
