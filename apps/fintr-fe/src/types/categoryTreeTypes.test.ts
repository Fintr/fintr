import { describe, expect, it } from "vitest";
import {
  categoryPickerValueFromTransaction,
  formatCategoryPickerValue,
  getCategoryDisplayLabel,
  getCategoryTriggerDisplay,
  parseCategoryPickerValue,
} from "./categoryTreeTypes";

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

  it("builds picker value from transaction category ids", () => {
    expect(
      categoryPickerValueFromTransaction({
        categoryId: "parent-1",
        subcategoryId: "sub-1",
        categoryName: "Food",
      }),
    ).toBe("parent-1:sub-1");
  });

  it("returns two-line trigger labels for subcategory selection", () => {
    expect(
      getCategoryTriggerDisplay("parent-1:sub-1", tree),
    ).toEqual({
      primary: "Food",
      secondary: "Groceries",
    });
  });
});
