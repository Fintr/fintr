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

const PARENT_ID = "11111111-1111-4111-8111-111111111111";
const SUB_ID = "22222222-2222-4222-8222-222222222222";

describe("categoryTreeTypes", () => {
  const tree = [
    {
      id: PARENT_ID,
      label: "Food",
      value: PARENT_ID,
      name: "Food",
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
  ];

  it("formats and parses parent-only values", () => {
    const encoded = formatCategoryPickerValue({
      categoryId: PARENT_ID,
      subcategoryId: null,
    });

    expect(encoded).toBe(PARENT_ID);
    expect(parseCategoryPickerValue(encoded)).toEqual({
      categoryId: PARENT_ID,
      subcategoryId: null,
    });
  });

  it("formats and parses parent + sub values", () => {
    const encoded = formatCategoryPickerValue({
      categoryId: PARENT_ID,
      subcategoryId: SUB_ID,
    });

    expect(encoded).toBe(`${PARENT_ID}:${SUB_ID}`);
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
