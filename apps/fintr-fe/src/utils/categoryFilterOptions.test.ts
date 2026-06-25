import { describe, expect, it } from "vitest";
import {
  buildCategoryFilterOptions,
  collectSelectedParentCategoryIds,
  EXPENSE_SECTION_VALUE,
  getCategoryFilterDisplayLabel,
  INCOME_SECTION_VALUE,
  isCategoryOptionCoveredByParentSelection,
  removeSubcategoriesForParent,
} from "./categoryFilterOptions";
import {
  CategoryTreeOption,
  formatCategoryPickerValue,
} from "@/types/categoryTreeTypes";

const EXPENSE_PARENT_ID = "11111111-1111-4111-8111-111111111111";
const EXPENSE_SUB_ID = "22222222-2222-4222-8222-222222222222";
const INCOME_PARENT_ID = "33333333-3333-4333-8333-333333333333";

const expenseTrees: CategoryTreeOption[] = [
  {
    id: EXPENSE_PARENT_ID,
    label: "Food",
    value: EXPENSE_PARENT_ID,
    name: "Food",
    parentId: null,
    children: [
      {
        id: EXPENSE_SUB_ID,
        label: "Groceries",
        value: EXPENSE_SUB_ID,
        name: "Groceries",
        parentId: EXPENSE_PARENT_ID,
      },
    ],
  },
];

const incomeTrees: CategoryTreeOption[] = [
  {
    id: INCOME_PARENT_ID,
    label: "Salary",
    value: INCOME_PARENT_ID,
    name: "Salary",
    parentId: null,
    children: [],
  },
];

describe("buildCategoryFilterOptions", () => {
  it("groups expense and income with section headers and subcategories indented", () => {
    const options = buildCategoryFilterOptions(expenseTrees, incomeTrees);

    expect(options[0]).toMatchObject({
      label: "Expense",
      value: EXPENSE_SECTION_VALUE,
      disabled: true,
    });
    expect(options[1]).toMatchObject({
      label: "Food",
      value: EXPENSE_PARENT_ID,
    });
    expect(options[2]).toMatchObject({
      label: "Groceries",
      value: formatCategoryPickerValue({
        categoryId: EXPENSE_PARENT_ID,
        subcategoryId: EXPENSE_SUB_ID,
      }),
      indentLevel: 1,
    });
    expect(options[3]).toMatchObject({
      label: "Income",
      value: INCOME_SECTION_VALUE,
      disabled: true,
    });
    expect(options[4]).toMatchObject({
      label: "Salary",
      value: INCOME_PARENT_ID,
    });
  });
});

describe("getCategoryFilterDisplayLabel", () => {
  it("returns parent › sub for subcategory selection", () => {
    expect(
      getCategoryFilterDisplayLabel(
        formatCategoryPickerValue({
          categoryId: EXPENSE_PARENT_ID,
          subcategoryId: EXPENSE_SUB_ID,
        }),
        expenseTrees,
        incomeTrees,
      ),
    ).toBe("Food › Groceries");
  });

  it("returns parent label for category-only selection", () => {
    expect(
      getCategoryFilterDisplayLabel(
        INCOME_PARENT_ID,
        expenseTrees,
        incomeTrees,
      ),
    ).toBe("Salary");
  });
});

describe("parent category selection helpers", () => {
  const groceriesValue = formatCategoryPickerValue({
    categoryId: EXPENSE_PARENT_ID,
    subcategoryId: EXPENSE_SUB_ID,
  });

  it("collects selected parent category ids", () => {
    expect(
      collectSelectedParentCategoryIds([
        EXPENSE_PARENT_ID,
        groceriesValue,
        INCOME_PARENT_ID,
      ]),
    ).toEqual(new Set([EXPENSE_PARENT_ID, INCOME_PARENT_ID]));
  });

  it("detects subcategories covered by a selected parent", () => {
    const selectedParents = collectSelectedParentCategoryIds([EXPENSE_PARENT_ID]);

    expect(
      isCategoryOptionCoveredByParentSelection(
        groceriesValue,
        selectedParents,
      ),
    ).toBe(true);
    expect(
      isCategoryOptionCoveredByParentSelection(
        INCOME_PARENT_ID,
        selectedParents,
      ),
    ).toBe(false);
  });

  it("removes subcategories when a parent category is selected", () => {
    expect(
      removeSubcategoriesForParent(
        [groceriesValue, INCOME_PARENT_ID],
        EXPENSE_PARENT_ID,
      ),
    ).toEqual([INCOME_PARENT_ID]);
  });
});
