import { describe, expect, it, vi } from "vitest";
import { CategoryTypeEnum } from "@/types/categoryTypes";
import {
  buildCategoryDetailHref,
  categoryEnumToKind,
  categoryKindToEnum,
  findCategoryInTree,
  findRootCategory,
  gridPickerSubcategoryCountLabel,
  openCreatedRootCategoryPage,
  subcategoryCountLabel,
} from "./categoryManagement";
import { TransactionCategory } from "@/types/transactionCategoryTypes";

const sampleTree: TransactionCategory[] = [
  {
    id: "parent-1",
    name: "Food",
    categoryType: CategoryTypeEnum.EXPENSE,
    parentId: null,
    children: [
      {
        id: "sub-1",
        name: "Groceries",
        categoryType: CategoryTypeEnum.EXPENSE,
        parentId: "parent-1",
        children: [],
      },
    ],
  },
  {
    id: "parent-2",
    name: "Transport",
    categoryType: CategoryTypeEnum.EXPENSE,
    parentId: null,
    children: [],
  },
];

describe("categoryManagement", () => {
  it("builds detail href with encoded params", () => {
    expect(buildCategoryDetailHref("abc/id", "expense")).toBe(
      "/dashboard/space_settings/categories/detail?categoryId=abc%2Fid&kind=expense",
    );
  });

  it("maps kind and enum", () => {
    expect(categoryKindToEnum("income")).toBe(CategoryTypeEnum.INCOME);
    expect(categoryEnumToKind(CategoryTypeEnum.EXPENSE)).toBe("expense");
  });

  it("finds root categories", () => {
    expect(findRootCategory(sampleTree, "parent-1")?.name).toBe("Food");
    expect(findRootCategory(sampleTree, "sub-1")).toBeNull();
  });

  it("finds root and subcategory nodes", () => {
    expect(findCategoryInTree(sampleTree, "parent-1")).toMatchObject({
      isSubcategory: false,
      category: { name: "Food" },
    });
    expect(findCategoryInTree(sampleTree, "sub-1")).toMatchObject({
      isSubcategory: true,
      category: { name: "Groceries" },
      root: { id: "parent-1" },
    });
    expect(findCategoryInTree(sampleTree, "missing")).toBeNull();
  });

  it("formats subcategory count labels", () => {
    expect(subcategoryCountLabel(0)).toBe("No subcategories");
    expect(subcategoryCountLabel(1)).toBe("1 subcategory");
    expect(subcategoryCountLabel(3)).toBe("3 subcategories");
  });

  it("formats short grid picker subcategory count labels", () => {
    expect(gridPickerSubcategoryCountLabel(0)).toBeNull();
    expect(gridPickerSubcategoryCountLabel(1)).toBe("1 sub");
    expect(gridPickerSubcategoryCountLabel(2)).toBe("2 subs");
  });

  it("opens the created root category page and replaces the href after id remap", async () => {
    const push = vi.fn();
    const replace = vi.fn();
    let resolveSync!: (value: { data: { id: string } }) => void;
    const syncPromise = new Promise<{ data: { id: string } }>((resolve) => {
      resolveSync = resolve;
    });

    openCreatedRootCategoryPage({
      categoryType: CategoryTypeEnum.EXPENSE,
      categoryId: "local:cat-1",
      syncPromise,
      push,
      replace,
    });

    expect(push).toHaveBeenCalledWith(
      "/dashboard/space_settings/categories/detail?categoryId=local%3Acat-1&kind=expense",
    );

    resolveSync({ data: { id: "server-cat" } });
    await syncPromise;

    expect(replace).toHaveBeenCalledWith(
      "/dashboard/space_settings/categories/detail?categoryId=server-cat&kind=expense",
    );
  });

  it("does not navigate when creating a subcategory", () => {
    const push = vi.fn();
    const replace = vi.fn();

    openCreatedRootCategoryPage({
      parentId: "parent-1",
      categoryType: CategoryTypeEnum.EXPENSE,
      categoryId: "local:sub-1",
      push,
      replace,
    });

    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
