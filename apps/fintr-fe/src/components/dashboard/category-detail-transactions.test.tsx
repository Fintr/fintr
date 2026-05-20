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

vi.mock("@/hooks/async/useInfiniteTransactions", () => ({
  useInfiniteTransactions: (...args: unknown[]) =>
    mockUseInfiniteTransactions(...args),
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
      <CategoryDetailTransactions categoryId="cat-1" spaceCurrency="PHP" />,
    );

    expect(mockUseInfiniteTransactions).toHaveBeenCalledWith(
      expect.objectContaining({
        appliedCategory: "cat-1",
        searchQuery: "",
      }),
    );
  });

  it("opens filters sheet with date range and subcategory fields", async () => {
    const user = userEvent.setup();

    renderWithClient(
      <CategoryDetailTransactions
        categoryId="cat-1"
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

    expect(screen.getByRole("heading", { name: "Filters" })).toBeInTheDocument();
    expect(screen.getByText("Date range")).toBeInTheDocument();
    expect(screen.getByText("Subcategory")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset filters" })).toBeInTheDocument();
  });
});
