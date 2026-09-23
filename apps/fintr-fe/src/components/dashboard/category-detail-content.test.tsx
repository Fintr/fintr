import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CategoryDetailContent from "./category-detail-content";
import { CategoryTypeEnum } from "@/types/categoryTypes";

const mockUseTransactionCategories = vi.fn();
const mockRouterPush = vi.fn();

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => mockUseTransactionCategories(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
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
  CategoryDetailTransactions: ({
    selectedSubcategoryId,
  }: {
    selectedSubcategoryId?: string | null;
  }) => (
    <div data-testid="category-detail-transactions">
      {selectedSubcategoryId ?? "all"}
    </div>
  ),
}));

describe("CategoryDetailContent", () => {
  beforeEach(() => {
    mockRouterPush.mockReset();
    mockUseTransactionCategories.mockReset();
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
      convertCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
    });
  });

  it("renders chips then budget then transactions, without subcategory kebabs on the page", () => {
    render(<CategoryDetailContent categoryId="p1" kind="expense" />);

    expect(screen.getByRole("heading", { name: "Food" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Groceries" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /actions for groceries/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Subcategories" })).not.toBeInTheDocument();

    const allChip = screen.getByRole("button", { name: "All" });
    const budgetSection = screen.getByTestId("category-budget-section");
    const transactionsSection = screen.getByTestId("category-detail-transactions");

    expect(allChip.compareDocumentPosition(budgetSection)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(budgetSection.compareDocumentPosition(transactionsSection)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("filters transactions when a subcategory chip is selected", async () => {
    const user = userEvent.setup();
    render(<CategoryDetailContent categoryId="p1" kind="expense" />);

    expect(screen.getByTestId("category-detail-transactions")).toHaveTextContent(
      "all",
    );

    await user.click(screen.getByRole("button", { name: "Groceries" }));

    expect(screen.getByRole("button", { name: "Groceries" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("category-detail-transactions")).toHaveTextContent(
      "s1",
    );
  });

  it("opens manage subcategories from the parent menu for name and icon edits", async () => {
    const user = userEvent.setup();
    render(<CategoryDetailContent categoryId="p1" kind="expense" />);

    await user.click(screen.getByRole("button", { name: /actions for food/i }));
    await user.click(
      screen.getByRole("menuitem", { name: /manage subcategories/i }),
    );

    expect(
      screen.getByRole("heading", { name: /manage subcategories/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /actions for groceries/i }),
    ).toBeInTheDocument();
  });

  it("keeps category controls clickable after saving an edit", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({});
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
      updateCategoryMutation: { mutateAsync, isPending: false },
      deleteCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
      convertCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
    });

    render(<CategoryDetailContent categoryId="p1" kind="expense" />);

    await user.click(screen.getByRole("button", { name: /actions for food/i }));
    await user.click(screen.getByRole("menuitem", { name: /^edit$/i }));

    const nameInput = screen.getByLabelText(/^name$/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Groceries & dining");
    await user.click(screen.getByRole("button", { name: /^update$/i }));

    expect(mutateAsync).toHaveBeenCalled();
    expect(document.body.style.pointerEvents).not.toBe("none");
    expect(
      document.querySelector('[data-slot="dialog-overlay"]'),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Groceries" }));

    expect(screen.getByRole("button", { name: "Groceries" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
      convertCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
    });

    render(<CategoryDetailContent categoryId="i1" kind="income" />);

    expect(screen.queryByTestId("category-budget-section")).not.toBeInTheDocument();
    expect(screen.getByTestId("category-detail-transactions")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "All" })).not.toBeInTheDocument();
  });

  it("shows not found when category id is missing from tree", () => {
    render(<CategoryDetailContent categoryId="missing" kind="expense" />);

    expect(screen.getByText(/category not found/i)).toBeInTheDocument();
  });

  it("opens the parent category when given a subcategory id", () => {
    render(<CategoryDetailContent categoryId="s1" kind="expense" />);

    expect(screen.getByRole("heading", { name: "Food" })).toBeInTheDocument();
    expect(screen.getByTestId("category-detail-transactions")).toBeInTheDocument();
  });

  it("redirects to the categories list after deleting the parent category", async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue({ success: true });
    mockUseTransactionCategories.mockReturnValue({
      expenseCategories: [
        {
          id: "p1",
          name: "Food",
          categoryType: CategoryTypeEnum.EXPENSE,
          children: [],
        },
      ],
      incomeCategories: [],
      isLoading: false,
      isError: false,
      createCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
      updateCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
      deleteCategoryMutation: { mutateAsync, isPending: false },
      convertCategoryMutation: { mutateAsync: vi.fn(), isPending: false },
    });

    render(<CategoryDetailContent categoryId="p1" kind="expense" />);

    await user.click(screen.getByRole("button", { name: /actions for food/i }));
    await user.click(screen.getByRole("menuitem", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /^delete category$/i }));

    expect(mutateAsync).toHaveBeenCalledWith("p1");
    expect(window.location.pathname).toBe("/dashboard/space_settings/categories");
  });
});
