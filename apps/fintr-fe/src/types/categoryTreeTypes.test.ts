import { describe, expect, it } from "vitest";
import {
  buildTransactionCategoryFields,
  categoryPickerValueFromName,
  categoryPickerValueFromReceiptOrTransaction,
  categoryPickerValueFromTransaction,
  formatCategoryPickerValue,
  getCategoryDisplayLabel,
  getCategoryNameForApi,
  getCategoryTriggerDisplay,
  isCategoryPickerId,
  parseCategoryPickerValue,
} from "./categoryTreeTypes";

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
    {
      id: "33333333-3333-4333-8333-333333333333",
      label: "Dine Out & Entertainment",
      value: "33333333-3333-4333-8333-333333333333",
      name: "Dine Out & Entertainment",
      parentId: null,
      children: [],
    },
  ];

  it("recognizes UUID-shaped picker ids", () => {
    expect(isCategoryPickerId(PARENT_ID)).toBe(true);
    expect(isCategoryPickerId("Dine Out & Entertainment")).toBe(false);
  });

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

  it("rejects plain category names as picker values", () => {
    expect(parseCategoryPickerValue("Dine Out & Entertainment")).toBeNull();
    expect(parseCategoryPickerValue("Transfer Fee")).toBeNull();
  });

  it("formats and parses parent + sub values", () => {
    const encoded = formatCategoryPickerValue({
      categoryId: PARENT_ID,
      subcategoryId: SUB_ID,
    });

    expect(encoded).toBe(`${PARENT_ID}:${SUB_ID}`);
    expect(getCategoryDisplayLabel(encoded, tree)).toBe("Food › Groceries");
  });

  it("builds picker value from transaction category ids", () => {
    expect(
      categoryPickerValueFromTransaction({
        categoryId: PARENT_ID,
        subcategoryId: SUB_ID,
        categoryName: "Food",
      }),
    ).toBe(`${PARENT_ID}:${SUB_ID}`);
  });

  it("resolves receipt category name to picker value", () => {
    expect(
      categoryPickerValueFromName("Dine Out & Entertainment", tree),
    ).toBe("33333333-3333-4333-8333-333333333333");

    expect(categoryPickerValueFromName("Groceries", tree)).toBe(
      `${PARENT_ID}:${SUB_ID}`,
    );
  });

  it("prefers ids over name when resolving receipt or transaction input", () => {
    expect(
      categoryPickerValueFromReceiptOrTransaction(
        {
          categoryId: PARENT_ID,
          subcategoryId: SUB_ID,
          categoryName: "Wrong Name",
        },
        tree,
      ),
    ).toBe(`${PARENT_ID}:${SUB_ID}`);
  });

  it("returns two-line trigger labels for subcategory selection", () => {
    expect(
      getCategoryTriggerDisplay(`${PARENT_ID}:${SUB_ID}`, tree),
    ).toEqual({
      primary: "Food",
      secondary: "Groceries",
    });
  });

  it("returns parent name for API from parent-only picker value", () => {
    expect(getCategoryNameForApi(PARENT_ID, tree)).toBe("Food");
  });

  it("returns subcategory name for API from parent + sub picker value", () => {
    expect(getCategoryNameForApi(`${PARENT_ID}:${SUB_ID}`, tree)).toBe(
      "Groceries",
    );
  });

  it("returns plain name when value is not a picker id", () => {
    expect(getCategoryNameForApi("Transfer Fee", tree)).toBe("Transfer Fee");
  });

  it("builds API fields with ids when picker value is resolved", () => {
    expect(
      buildTransactionCategoryFields(
        "33333333-3333-4333-8333-333333333333",
        tree,
      ),
    ).toEqual({
      categoryName: "Dine Out & Entertainment",
      categoryId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("builds API fields with name only when picker value is unresolved", () => {
    expect(
      buildTransactionCategoryFields("Unknown Category", tree),
    ).toEqual({
      categoryName: "Unknown Category",
    });
  });
});
