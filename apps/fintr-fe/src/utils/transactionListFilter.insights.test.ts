import { describe, expect, it } from "vitest";

import type { CategoryTreeOption } from "@/types/categoryTreeTypes";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import {
  filterTransactionsByInsightsCategory,
  transactionMatchesInsightsCategoryFilter,
} from "./transactionListFilter";

const PARENT_ID = "11111111-1111-4111-8111-111111111111";
const SUB_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_PARENT_ID = "33333333-3333-4333-8333-333333333333";

const categoryTree: CategoryTreeOption[] = [
  {
    id: PARENT_ID,
    label: "Food & Groceries",
    value: PARENT_ID,
    name: "Food & Groceries",
    parentId: null,
    children: [
      {
        id: SUB_ID,
        label: "Groceries",
        value: SUB_ID,
        name: "Groceries",
        parentId: PARENT_ID,
      },
    ],
  },
  {
    id: OTHER_PARENT_ID,
    label: "Home",
    value: OTHER_PARENT_ID,
    name: "Home",
    parentId: null,
    children: [],
  },
];

const categoryOptions = {
  expense: categoryTree,
  income: [],
};

const tx = (
  overrides: Partial<IndexTransaction & { categoryId?: string; subcategoryId?: string }>,
) => ({
  id: "1",
  date: "2026-08-01",
  description: "",
  amount: 100,
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  ...overrides,
});

describe("transactionMatchesInsightsCategoryFilter", () => {
  it("matches by categoryName without categoryId on cached rows", () => {
    const groceries = tx({
      id: "groceries",
      categoryName: "Food & Groceries",
      amount: 250,
    });
    const home = tx({
      id: "home",
      categoryName: "Home",
      amount: 1000,
    });

    const filtered = filterTransactionsByInsightsCategory(
      [groceries, home],
      {
        categoryName: "Food & Groceries",
        categoryId: PARENT_ID,
      },
    );

    expect(filtered.map((row) => row.id)).toEqual(["groceries"]);
  });

  it("matches via category tree when filter categoryName is still a picker id", () => {
    const groceries = tx({
      id: "groceries",
      categoryName: "Food & Groceries",
      amount: 250,
    });

    expect(
      transactionMatchesInsightsCategoryFilter(groceries, {
        categoryName: PARENT_ID,
        categoryId: PARENT_ID,
        categoryOptions,
      }),
    ).toBe(true);
  });

  it("resolves cached name-only rows through the category tree", () => {
    const parentOnly = tx({
      id: "parent-only",
      categoryName: "Food & Groceries",
      amount: 100,
    });
    const subcategory = tx({
      id: "subcategory",
      categoryName: "Food & Groceries",
      subcategoryName: "Groceries",
      amount: 50,
    });

    const filtered = filterTransactionsByInsightsCategory(
      [parentOnly, subcategory],
      {
        categoryId: PARENT_ID,
        categoryOptions,
      },
    );

    expect(filtered.map((row) => row.id)).toEqual(["parent-only", "subcategory"]);
  });

  it("matches subcategory rows when filtering by parent via the category tree", () => {
    const groceries = tx({
      id: "groceries",
      categoryName: "Food & Groceries",
      subcategoryName: "Groceries",
      categoryId: SUB_ID,
      amount: 250,
    });

    expect(
      transactionMatchesInsightsCategoryFilter(groceries, {
        categoryId: PARENT_ID,
        categoryOptions,
      }),
    ).toBe(true);
  });

  it("matches when categoryName on the row is a subcategory label", () => {
    const diningOut = tx({
      id: "dining-out",
      categoryName: "Groceries",
      amount: 180,
    });

    expect(
      transactionMatchesInsightsCategoryFilter(diningOut, {
        categoryId: PARENT_ID,
        categoryName: "Food & Groceries",
        categoryOptions,
      }),
    ).toBe(true);
  });

  it("matches subcategoryId when provided", () => {
    const groceries = tx({
      categoryId: PARENT_ID,
      subcategoryId: SUB_ID,
      categoryName: "Food & Groceries",
      subcategoryName: "Groceries",
    });
    const dining = tx({
      categoryId: PARENT_ID,
      categoryName: "Food & Groceries",
      subcategoryName: "Dining",
    });

    const filtered = filterTransactionsByInsightsCategory(
      [groceries, dining],
      {
        categoryId: PARENT_ID,
        subcategoryId: SUB_ID,
      },
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.subcategoryName).toBe("Groceries");
  });

  it("falls back to category name when categoryId is missing on cached rows", () => {
    const home = tx({
      categoryName: "Home",
      amount: 200,
    });

    expect(
      transactionMatchesInsightsCategoryFilter(home, {
        categoryId: OTHER_PARENT_ID,
        categoryName: "Home",
        categoryOptions,
      }),
    ).toBe(true);
  });

  it("returns all transactions when no category filter is active", () => {
    const rows = [tx({ id: "a" }), tx({ id: "b" })];

    expect(
      filterTransactionsByInsightsCategory(rows, {}),
    ).toHaveLength(2);
  });

  it("does not throw when cached rows have null category names", () => {
    const uncategorized = tx({
      id: "uncategorized",
      categoryName: null as unknown as string,
      amount: 120,
    });
    const dining = tx({
      id: "dining",
      categoryName: "Dine Out & Entertainment",
      amount: 450,
    });

    const filtered = filterTransactionsByInsightsCategory(
      [uncategorized, dining],
      {
        categoryName: "Dine Out & Entertainment",
        categoryId: PARENT_ID,
      },
    );

    expect(filtered.map((row) => row.id)).toEqual(["dining"]);
  });

  it("matches child categoryName when filter only has parent categoryId + options", () => {
    const groceries = tx({
      id: "name-only-child",
      categoryName: "Groceries",
      amount: 90,
    });

    expect(
      transactionMatchesInsightsCategoryFilter(groceries, {
        categoryId: PARENT_ID,
        categoryOptions,
      }),
    ).toBe(true);
  });
});
