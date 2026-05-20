import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import CategoryDetailContent from "./category-detail-content";
import { CategoryTypeEnum } from "@/types/categoryTypes";

const mockUseTransactionCategories = vi.fn();

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => mockUseTransactionCategories(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({ currentSpace: { currency: "PHP" } }),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

vi.mock("@/components/dashboard/category-budget-section", () => ({
  CategoryBudgetSection: () => <div data-testid="category-budget-section" />,
}));

vi.mock("@/components/dashboard/category-detail-transactions", () => ({
  CategoryDetailTransactions: () => (
    <div data-testid="category-detail-transactions" />
  ),
}));

describe("CategoryDetailContent", () => {
  beforeEach(() => {
    mockUseTransactionCategories.mockReturnValue({
      expenseCategories: [
        {
          id: "p1",
          name: "Food",
          categoryType: CategoryTypeEnum.EXPENSE,
          children: [
            {
              id: "s1",
              name: "Groceries",
              categoryType: CategoryTypeEnum.EXPENSE,
              parentId: "p1",
            },
          ],
        },
      ],
      incomeCategories: [],
      isLoading: false,
      isError: false,
      createCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
      updateCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
      deleteCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
    });
  });

  it("renders sections in order: subcategories, budget, then transactions", () => {
    render(<CategoryDetailContent categoryId="p1" kind="expense" />);

    expect(screen.getByRole("heading", { name: "Food" })).toBeInTheDocument();
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /actions for groceries/i }),
    ).toBeInTheDocument();

    const subcategoriesHeading = screen.getByText("Subcategories");
    const budgetSection = screen.getByTestId("category-budget-section");
    const transactionsSection = screen.getByTestId("category-detail-transactions");

    expect(
      subcategoriesHeading.compareDocumentPosition(budgetSection),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(
      budgetSection.compareDocumentPosition(transactionsSection),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("does not render budget section for income categories", () => {
    mockUseTransactionCategories.mockReturnValue({
      expenseCategories: [],
      incomeCategories: [
        {
          id: "i1",
          name: "Salary",
          categoryType: CategoryTypeEnum.INCOME,
          children: [],
        },
      ],
      isLoading: false,
      isError: false,
      createCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
      updateCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
      deleteCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
    });

    render(<CategoryDetailContent categoryId="i1" kind="income" />);

    expect(screen.queryByTestId("category-budget-section")).not.toBeInTheDocument();
    expect(screen.getByTestId("category-detail-transactions")).toBeInTheDocument();
  });

  it("shows not found when category id is missing from tree", () => {
    render(<CategoryDetailContent categoryId="missing" kind="expense" />);

    expect(screen.getByText(/category not found/i)).toBeInTheDocument();
  });
});
