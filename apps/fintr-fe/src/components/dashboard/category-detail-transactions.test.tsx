import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CategoryDetailTransactions } from "./category-detail-transactions";

const renderWithClient = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
};

const mockUseInfiniteTransactions = vi.fn();

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({ currentSpace: { currency: "PHP" } }),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-1"],
}));

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
  SEARCH_DEBOUNCE_MS: 300,
}));

vi.mock("@/hooks/async/useDashboardData", () => ({
  useDashboardData: vi.fn(),
}));

vi.mock("jotai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jotai")>();
  return {
    ...actual,
    useAtom: () => ["2026-06-01", "2026-06-30"],
  };
});

vi.mock("@/hooks/async/useInfiniteTransactions", () => ({
  useInfiniteTransactions: (...args: unknown[]) =>
    mockUseInfiniteTransactions(...args),
}));

vi.mock("@/components/dashboard/tabs/transactions/filters", () => ({
  TransactionFiltersSheet: ({
    open,
    showAccountFilter,
    categoryDefaultValues,
    expenseCategoryOptionsOverride,
    incomeCategoryOptionsOverride,
  }: {
    open: boolean;
    showAccountFilter?: boolean;
    categoryDefaultValues?: string[];
    expenseCategoryOptionsOverride?: { id: string; name: string }[];
    incomeCategoryOptionsOverride?: { id: string; name: string }[];
  }) =>
    open ? (
      <div data-testid="transaction-filters-sheet">
        <h2>Transaction Filters</h2>
        {showAccountFilter ? <span>Account</span> : null}
        {categoryDefaultValues?.length ? (
          <span data-testid="category-default">
            {categoryDefaultValues.join(",")}
          </span>
        ) : null}
        {expenseCategoryOptionsOverride?.length ? (
          <span data-testid="scoped-expense-categories">
            {expenseCategoryOptionsOverride[0]?.name}
          </span>
        ) : null}
        {incomeCategoryOptionsOverride?.length ? (
          <span data-testid="scoped-income-categories">
            {incomeCategoryOptionsOverride[0]?.name}
          </span>
        ) : null}
      </div>
    ) : null,
}));

vi.mock("@/components/dashboard/tabs/transactions/list-view", () => ({
  ListView: () => <div data-testid="list-view" />,
}));

vi.mock("@/components/dashboard/tabs/transactions/transaction-totals", () => ({
  TransactionTotalsDisplay: () => <div data-testid="transaction-totals" />,
}));

vi.mock("@/components/dashboard/forms/EditTransactionDialog", () => ({
  default: () => null,
}));

vi.mock("@/components/dashboard/forms/ScopeModal", () => ({
  default: () => null,
}));

describe("CategoryDetailTransactions", () => {
  beforeEach(() => {
    mockUseInfiniteTransactions.mockReturnValue({
      data: { pages: [{ transactions: [], totals: null }] },
      error: null,
      isFetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      isError: false,
      isSuccess: true,
    });
  });

  it("renders transactions heading and filter control", () => {
    renderWithClient(
      <CategoryDetailTransactions
        categoryId="cat-1"
        categoryName="Travel"
        categoryKind="expense"
        spaceCurrency="PHP"
        subcategories={[{ id: "sub-1", name: "Japan 2026" }]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Transactions" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open transaction filters/i }),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search transactions/i)).toBeInTheDocument();
  });

  it("queries transactions for the parent category by default", () => {
    renderWithClient(
      <CategoryDetailTransactions
        categoryId="cat-1"
        categoryName="Travel"
        categoryKind="expense"
        spaceCurrency="PHP"
      />,
    );

    expect(mockUseInfiniteTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedCategories: ["cat-1"],
        appliedAccountNames: [],
        searchQuery: "",
      }),
    );
  });

  it("opens the shared transaction filters sheet with scoped categories and account", async () => {
    const user = userEvent.setup();

    renderWithClient(
      <CategoryDetailTransactions
        categoryId="cat-1"
        categoryName="Travel"
        categoryKind="expense"
        spaceCurrency="PHP"
        subcategories={[
          { id: "sub-1", name: "Japan 2026" },
          { id: "sub-2", name: "Europe 2026" },
        ]}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /open transaction filters/i }),
    );

    expect(screen.getByTestId("transaction-filters-sheet")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Transaction Filters" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.getByTestId("category-default")).toHaveTextContent("cat-1");
    expect(screen.getByTestId("scoped-expense-categories")).toHaveTextContent(
      "Travel",
    );
  });
});
