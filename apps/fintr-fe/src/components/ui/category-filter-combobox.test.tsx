import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CategoryFilterComboBox } from "./category-filter-combobox";
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

const foodValue = formatCategoryPickerValue({
  categoryId: EXPENSE_PARENT_ID,
  subcategoryId: null,
});

const groceriesValue = formatCategoryPickerValue({
  categoryId: EXPENSE_PARENT_ID,
  subcategoryId: EXPENSE_SUB_ID,
});

describe("CategoryFilterComboBox single-select", () => {
  beforeAll(() => {
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 40,
        right: 320,
        width: 320,
        height: 40,
        toJSON: () => ({}),
      }) as DOMRect;
  });

  afterEach(() => {
    cleanup();
  });

  it("shows All categories on a picker button, not a text field", () => {
    render(
      <CategoryFilterComboBox
        expenseOptions={expenseTrees}
        incomeOptions={incomeTrees}
        placeholder="All categories"
      />,
    );

    expect(
      screen.getByRole("button", { name: /all categories/i }),
    ).toBeVisible();
    expect(screen.queryByPlaceholderText(/search categories/i)).toBeNull();
  });

  it("opens search inside the list and closes when the trigger is clicked again", async () => {
    const user = userEvent.setup();

    render(
      <CategoryFilterComboBox
        expenseOptions={expenseTrees}
        incomeOptions={incomeTrees}
        placeholder="All categories"
      />,
    );

    await user.click(screen.getByRole("button", { name: /all categories/i }));

    expect(screen.getByPlaceholderText(/search categories/i)).toBeVisible();
    expect(screen.getByRole("option", { name: "Food" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /all categories/i }));

    expect(
      screen.getByRole("button", { name: /all categories/i }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("option", { name: "Food" })).toBeNull();
  });

  it("commits only when an option is chosen, not while typing", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CategoryFilterComboBox
        expenseOptions={expenseTrees}
        incomeOptions={incomeTrees}
        placeholder="All categories"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /all categories/i }));
    await user.type(
      screen.getByPlaceholderText(/search categories/i),
      "Food",
    );

    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole("option", { name: "Food" }));

    expect(onChange).toHaveBeenCalledWith(foodValue);
    expect(screen.queryByPlaceholderText(/search categories/i)).toBeNull();
  });

  it("clears the selected category from the trigger", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CategoryFilterComboBox
        expenseOptions={expenseTrees}
        incomeOptions={incomeTrees}
        placeholder="All categories"
        value={groceriesValue}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /clear category/i }));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("keeps clear and chevron in a right-aligned cluster on the trigger", () => {
    render(
      <CategoryFilterComboBox
        expenseOptions={expenseTrees}
        incomeOptions={incomeTrees}
        placeholder="All categories"
        value={groceriesValue}
      />,
    );

    const trailing = screen.getByTestId("filter-picker-trailing");
    const clear = screen.getByRole("button", { name: /clear category/i });

    expect(trailing).toHaveClass("right-0");
    expect(trailing.firstElementChild).toBe(clear);
    expect(trailing.lastElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps search above the list so options cannot overflow the top", async () => {
    const user = userEvent.setup();

    render(
      <CategoryFilterComboBox
        expenseOptions={expenseTrees}
        incomeOptions={incomeTrees}
        placeholder="All categories"
      />,
    );

    await user.click(screen.getByRole("button", { name: /all categories/i }));

    const search = screen.getByPlaceholderText(/search categories/i);
    const list = screen.getByTestId("filter-picker-list");
    const option = screen.getByRole("option", { name: "Food" });

    expect(list).toContainElement(option);
    expect(list.contains(search)).toBe(false);
    expect(
      search.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows the full list when reopening a selected category", async () => {
    const user = userEvent.setup();

    render(
      <CategoryFilterComboBox
        expenseOptions={expenseTrees}
        incomeOptions={incomeTrees}
        placeholder="All categories"
        value={groceriesValue}
      />,
    );

    await user.click(screen.getByRole("button", { name: /groceries/i }));

    expect(screen.getByRole("option", { name: "Salary" })).toBeVisible();
    expect(screen.getByRole("option", { name: "All categories" })).toBeVisible();
  });

  it("does not treat Expense or Income as selectable options", async () => {
    const user = userEvent.setup();

    render(
      <CategoryFilterComboBox
        expenseOptions={expenseTrees}
        incomeOptions={incomeTrees}
        placeholder="All categories"
      />,
    );

    await user.click(screen.getByRole("button", { name: /all categories/i }));

    expect(screen.getByText("Expense")).toBeVisible();
    expect(screen.queryByRole("option", { name: "Expense" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Income" })).toBeNull();
  });
});
