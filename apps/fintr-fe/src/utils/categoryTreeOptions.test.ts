import { describe, expect, it } from "vitest";
import {
  formatCategoryPickerValue,
  getCategoryDisplayLabel,
  parseCategoryPickerValue,
} from "@/types/categoryTreeTypes";
import {
  isCategoryTree,
  normalizeCategoryTreeNodes,
} from "./categoryTreeOptions";
import { CategoryTreeOption } from "@/types/categoryTreeTypes";

describe("categoryTreeTypes", () => {
  const tree = [
    {
      id: "parent-1",
      label: "Food",
      value: "parent-1",
      name: "Food",
      parentId: null,
      children: [
        {
          id: "sub-1",
          label: "Groceries",
          value: "sub-1",
          name: "Groceries",
          parentId: "parent-1",
        },
      ],
    },
  ];

  it("formats and parses parent-only values", () => {
    const encoded = formatCategoryPickerValue({
      categoryId: "parent-1",
      subcategoryId: null,
    });

    expect(encoded).toBe("parent-1");
    expect(parseCategoryPickerValue(encoded)).toEqual({
      categoryId: "parent-1",
      subcategoryId: null,
    });
  });

  it("formats and parses parent + sub values", () => {
    const encoded = formatCategoryPickerValue({
      categoryId: "parent-1",
      subcategoryId: "sub-1",
    });

    expect(encoded).toBe("parent-1:sub-1");
    expect(getCategoryDisplayLabel(encoded, tree)).toBe("Food › Groceries");
  });
});

describe("normalizeCategoryTreeNodes", () => {
  it("returns empty array for null, undefined, and empty object", () => {
    expect(normalizeCategoryTreeNodes(null)).toEqual([]);
    expect(normalizeCategoryTreeNodes(undefined)).toEqual([]);
    expect(normalizeCategoryTreeNodes({})).toEqual([]);
  });

  it("wraps a single category object", () => {
    const result = normalizeCategoryTreeNodes({
      id: "p1",
      name: "Food",
      categoryType: "expense",
      children: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Food");
  });

  it("passes through arrays", () => {
    const result = normalizeCategoryTreeNodes([
      { id: "p1", name: "Food", categoryType: "expense", children: [] },
    ]);

    expect(result).toHaveLength(1);
  });

  it("detects category tree options with empty children arrays", () => {
    const options: CategoryTreeOption[] = [
      {
        id: "p1",
        label: "Food",
        value: "p1",
        name: "Food",
        parentId: null,
        children: [],
      },
    ];

    expect(isCategoryTree(options)).toBe(true);
  });

  it("unwraps Dry monad JSON shape { value: [...] }", () => {
    const result = normalizeCategoryTreeNodes({
      value: [
        { id: "p1", name: "Food", categoryType: "expense", children: [] },
        { id: "p2", name: "Transport", categoryType: "expense", children: [] },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Food");
    expect(result[1].name).toBe("Transport");
  });
});
