import { describe, expect, it } from "vitest";
import {
  buildCategoryFilterOptions,
  EXPENSE_SECTION_VALUE,
  getCategoryFilterDisplayLabel,
  INCOME_SECTION_VALUE,
} from "./categoryFilterOptions";
import { CategoryTreeOption } from "@/types/categoryTreeTypes";

const expenseTrees: CategoryTreeOption[] = [
  {
    id: "exp-parent",
    label: "Food",
    value: "exp-parent",
    name: "Food",
    parentId: null,
    children: [
      {
        id: "exp-sub",
        label: "Groceries",
        value: "exp-sub",
        name: "Groceries",
        parentId: "exp-parent",
      },
    ],
  },
];

const incomeTrees: CategoryTreeOption[] = [
  {
    id: "inc-parent",
    label: "Salary",
    value: "inc-parent",
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
      value: "exp-parent",
    });
    expect(options[2]).toMatchObject({
      label: "Groceries",
      value: "exp-parent:exp-sub",
      indentLevel: 1,
    });
    expect(options[3]).toMatchObject({
      label: "Income",
      value: INCOME_SECTION_VALUE,
      disabled: true,
    });
    expect(options[4]).toMatchObject({
      label: "Salary",
      value: "inc-parent",
    });
  });
});

describe("getCategoryFilterDisplayLabel", () => {
  it("returns parent › sub for subcategory selection", () => {
    expect(
      getCategoryFilterDisplayLabel(
        "exp-parent:exp-sub",
        expenseTrees,
        incomeTrees,
      ),
    ).toBe("Food › Groceries");
  });

  it("returns parent label for category-only selection", () => {
    expect(
      getCategoryFilterDisplayLabel("inc-parent", expenseTrees, incomeTrees),
    ).toBe("Salary");
  });
});
