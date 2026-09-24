import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryBudgetSection } from "./category-budget-section";

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategoryOptions: [],
    incomeCategoryOptions: [],
  }),
}));

vi.mock("@/hooks/async/useBudgetsData", () => ({
  useBudgetsData: () => ({
    data: {
      budgets: [
        {
          id: "b1",
          date: "2026-08-01",
          category_name: "Food",
          category_id: "p1",
          subcategory_id: null,
          amount: 8000,
          total_spent: 4280,
          amount_currency: "PHP",
        },
      ],
      summary: null,
    },
    isLoading: false,
    isError: false,
    updateBudgetMutation: { mutateAsync: vi.fn(), isPending: false },
    createBudgetMutation: { mutateAsync: vi.fn(), isPending: false },
  }),
}));

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtomValue: () => [],
  };
});

vi.mock("@/components/dashboard/tabs/budgets/edit-budget-form", () => ({
  EditBudgetForm: () => <div data-testid="edit-budget-form" />,
}));

describe("CategoryBudgetSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a compact spent versus budget row instead of the allocation form", () => {
    render(
      <CategoryBudgetSection
        categoryId="p1"
        categoryName="Food"
        subcategoryOptions={[]}
        spaceCurrency="PHP"
      />,
    );

    expect(screen.getByText(/august/i)).toBeInTheDocument();
    expect(screen.queryByTestId("edit-budget-form")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /august budget/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Set budget")).not.toBeInTheDocument();
    expect(screen.getByText(/8,000/)).toBeInTheDocument();
  });

  it("opens allocation in a dialog from the compact row", async () => {
    const user = userEvent.setup();

    render(
      <CategoryBudgetSection
        categoryId="p1"
        categoryName="Food"
        subcategoryOptions={[]}
        spaceCurrency="PHP"
      />,
    );

    await user.click(screen.getByRole("button", { name: /august budget/i }));

    expect(screen.getByRole("heading", { name: /edit budget/i })).toBeInTheDocument();
    expect(screen.getByTestId("edit-budget-form")).toBeInTheDocument();
  });
});
