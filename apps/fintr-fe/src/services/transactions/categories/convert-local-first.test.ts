import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLocalDb,
  OUTBOX_COMMAND_CATEGORY_CONVERT,
  resetLocalDbForTests,
} from "@/lib/local-db";
import { cacheBudgetsResponse } from "@/services/budgets/local-cache";
import { cacheTransactionCategoriesResponse } from "@/services/transactions/categories/local-cache";
import { loadCategoryTrees } from "@/services/transactions/categories/category-cache-ops";
import {
  buildTransactionsFilterKey,
  cacheTransactionsPage,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

vi.mock("@/services/transactions/categories/mutation", () => ({
  convertCategoryHierarchy: vi.fn(),
}));

import { convertCategoryHierarchy } from "@/services/transactions/categories/mutation";
import {
  convertCategoryLocalFirst,
  previewCategoryConversionLocal,
} from "./convert-local-first";

const baseTrees = () => ({
  data: {
    expenseCategories: [
      {
        id: "cat-food",
        name: "Food",
        categoryType: CategoryTypeEnum.EXPENSE,
        parentId: null,
        icon: "utensils",
        color: "#000000",
        children: [],
      },
      {
        id: "cat-transport",
        name: "Transport",
        categoryType: CategoryTypeEnum.EXPENSE,
        parentId: null,
        icon: "car",
        color: "#111111",
        children: [
          {
            id: "cat-taxi",
            name: "Taxi",
            categoryType: CategoryTypeEnum.EXPENSE,
            parentId: "cat-transport",
            icon: "car",
            color: "#222222",
            children: [],
          },
        ],
      },
    ],
    incomeCategories: [],
  },
});

describe("convertCategoryLocalFirst", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("makes a parent a subcategory locally while offline and enqueues outbox", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());
    await upsertLocalIndexTransaction("space-a", {
      id: "tx-1",
      date: "2026-08-01",
      description: "Groceries",
      amount: 100,
      amountCurrency: "PHP",
      categoryName: "Food",
      categoryId: "cat-food",
      subcategoryId: null,
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
    await cacheBudgetsResponse("space-a", "2026-08-01", "2026-08-31", {
      budgets: [
        {
          id: "budget-food",
          date: "2026-08-01",
          category_name: "Food",
          category_id: "cat-food",
          total_spent: 100,
          amount_currency: "PHP",
          amount: 500,
        },
      ],
      summary: null,
      nextPage: null,
      totalPages: null,
      totalCount: null,
    });
    vi.spyOn(globalThis, "navigator", "get").mockReturnValue({
      onLine: false,
    } as Navigator);

    const result = await convertCategoryLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        categoryId: "cat-food",
        conversionType: "to_subcategory",
        newParentId: "cat-transport",
      },
      { waitForSync: true },
    );

    expect(result.pendingSync).toBe(true);
    expect(result.redirectParentId).toBe("cat-transport");
    expect(convertCategoryHierarchy).not.toHaveBeenCalled();

    const trees = await loadCategoryTrees("space-a");
    const transport = trees.expenseCategories.find(
      (category) => category.id === "cat-transport",
    );
    expect(transport?.children?.map((child) => child.id)).toContain("cat-food");
    expect(
      trees.expenseCategories.find((category) => category.id === "cat-food"),
    ).toBeUndefined();

    const tx = await getLocalDb().transactions.get("space-a:tx-1");
    expect(tx?.payload.categoryId).toBe("cat-transport");
    expect(tx?.payload.subcategoryId).toBe("cat-food");

    const outbox = await getLocalDb().outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.commandType).toBe(OUTBOX_COMMAND_CATEGORY_CONVERT);
    expect(outbox[0]?.status).toBe("pending");
    expect(outbox[0]?.payload).toEqual({
      categoryId: "cat-food",
      conversionType: "to_subcategory",
      newParentId: "cat-transport",
    });
  });

  it("makes a subcategory a top-level category locally while offline", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());
    await upsertLocalIndexTransaction("space-a", {
      id: "tx-2",
      date: "2026-08-02",
      description: "Airport taxi",
      amount: 40,
      amountCurrency: "PHP",
      categoryName: "Transport",
      categoryId: "cat-transport",
      subcategoryName: "Taxi",
      subcategoryId: "cat-taxi",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
    vi.spyOn(globalThis, "navigator", "get").mockReturnValue({
      onLine: false,
    } as Navigator);

    const result = await convertCategoryLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        categoryId: "cat-taxi",
        conversionType: "to_parent",
      },
      { waitForSync: false },
    );

    expect(result.pendingSync).toBe(true);
    expect(result.redirectParentId).toBe("cat-taxi");
    expect(convertCategoryHierarchy).not.toHaveBeenCalled();

    const trees = await loadCategoryTrees("space-a");
    expect(trees.expenseCategories.map((category) => category.id)).toContain(
      "cat-taxi",
    );
    const transport = trees.expenseCategories.find(
      (category) => category.id === "cat-transport",
    );
    expect(transport?.children ?? []).toHaveLength(0);

    const tx = await getLocalDb().transactions.get("space-a:tx-2");
    expect(tx?.payload.categoryId).toBe("cat-taxi");
    expect(tx?.payload.subcategoryId).toBeNull();
  });

  it("promotes transactions still tagged with the subcategory as a parent category", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());
    await upsertLocalIndexTransaction("space-a", {
      id: "tx-orphan",
      date: "2026-08-02",
      description: "Airport taxi",
      amount: 250_000,
      amountCurrency: "PHP",
      categoryName: "Taxi",
      categoryId: "cat-taxi",
      subcategoryId: null,
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
    vi.spyOn(globalThis, "navigator", "get").mockReturnValue({
      onLine: false,
    } as Navigator);

    const preview = await previewCategoryConversionLocal({
      spaceCode: "space-a",
      categoryId: "cat-taxi",
      conversionType: "to_parent",
    });
    expect(preview.transactionCount).toBe(1);
    expect(preview.expenseTotal).toBe(250_000);

    await convertCategoryLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        categoryId: "cat-taxi",
        conversionType: "to_parent",
      },
      { waitForSync: false },
    );

    const tx = await getLocalDb().transactions.get("space-a:tx-orphan");
    expect(tx?.payload.categoryId).toBe("cat-taxi");
    expect(tx?.payload.subcategoryId).toBeNull();
  });

  it("reassigns transactions that only exist in list snapshots", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());
    const filterKey = buildTransactionsFilterKey({
      categoriesSerialized: JSON.stringify(["cat-food"]),
      startDate: "2026-08-01",
      endDate: "2026-08-31",
      minAmount: "",
      maxAmount: "",
      searchQuery: "",
      accountNamesSerialized: "[]",
      tagIdsSerialized: "[]",
    });
    await cacheTransactionsPage("space-a", filterKey, {
      transactions: [
        {
          id: "tx-snap",
          date: "2026-08-01",
          description: "SSS contribution",
          amount: 250_000,
          amountCurrency: "PHP",
          categoryName: "Food",
          categoryId: "cat-food",
          subcategoryId: null,
          fromAccountName: "Cash",
          toAccountName: "",
          type: CombinedTransactionTypeEnum.EXPENSE,
          inSeries: false,
          hasImage: false,
        },
      ],
      nextPage: null,
      totalPages: 1,
      totalCount: 1,
      totals: null,
    });
    vi.spyOn(globalThis, "navigator", "get").mockReturnValue({
      onLine: false,
    } as Navigator);

    await convertCategoryLocalFirst(
      {} as never,
      {
        spaceCode: "space-a",
        categoryId: "cat-food",
        conversionType: "to_subcategory",
        newParentId: "cat-transport",
      },
      { waitForSync: false },
    );

    const tx = await getLocalDb().transactions.get("space-a:tx-snap");
    expect(tx?.payload.categoryId).toBe("cat-transport");
    expect(tx?.payload.subcategoryId).toBe("cat-food");
  });

  it("rejects converting a parent that still has subcategories", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());

    await expect(
      convertCategoryLocalFirst(
        {} as never,
        {
          spaceCode: "space-a",
          categoryId: "cat-transport",
          conversionType: "to_subcategory",
          newParentId: "cat-food",
        },
        { waitForSync: false },
      ),
    ).rejects.toMatchObject({
      error: {
        details: {
          category: "has subcategories; remove or move them first",
        },
      },
    });

    expect(await getLocalDb().outbox.count()).toBe(0);
  });
});

describe("previewCategoryConversionLocal", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("summarizes local transactions and budgets without calling the API", async () => {
    await cacheTransactionCategoriesResponse("space-a", baseTrees());
    await upsertLocalIndexTransaction("space-a", {
      id: "tx-1",
      date: "2026-08-01",
      description: "Groceries",
      amount: 100,
      amountCurrency: "PHP",
      categoryName: "Food",
      categoryId: "cat-food",
      fromAccountName: "Cash",
      toAccountName: "",
      type: CombinedTransactionTypeEnum.EXPENSE,
      inSeries: false,
      hasImage: false,
    });
    await cacheBudgetsResponse("space-a", "2026-08-01", "2026-08-31", {
      budgets: [
        {
          id: "budget-food",
          date: "2026-08-01",
          category_name: "Food",
          category_id: "cat-food",
          total_spent: 100,
          amount_currency: "PHP",
          amount: 500,
        },
      ],
      summary: null,
      nextPage: null,
      totalPages: null,
      totalCount: null,
    });

    const preview = await previewCategoryConversionLocal({
      spaceCode: "space-a",
      categoryId: "cat-food",
      conversionType: "to_subcategory",
      newParentId: "cat-transport",
    });

    expect(preview.transactionCount).toBe(1);
    expect(preview.expenseCount).toBe(1);
    expect(preview.expenseTotal).toBe(100);
    expect(preview.budgetCount).toBe(1);
    expect(preview.newParentName).toBe("Transport");
  });
});
