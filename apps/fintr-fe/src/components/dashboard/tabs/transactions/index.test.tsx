import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategoryOptions: [],
    incomeCategoryOptions: [],
  }),
}));

vi.mock("@/hooks/async/useDashboardData", () => ({
  useDashboardData: () => ({ data: undefined }),
}));

vi.mock("@/hooks/async/useInfiniteTransactions", () => ({
  useInfiniteTransactions: () => ({
    data: undefined,
    error: null,
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isError: false,
    isSuccess: false,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/usePrefetchDetailHrefs", () => ({
  usePrefetchDetailHrefs: vi.fn(),
}));

vi.mock("@/hooks/useAuthApi", () => {
  const useAuthApi = () => ({ api: {} });

  return {
    useAuthApi,
    default: useAuthApi,
  };
});

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({ currentSpace: { currency: "PHP" } }),
}));

vi.mock("./list-view", () => ({
  ListView: () => null,
}));

import TransactionsTab from "./index";

describe("TransactionsTab mobile summary", () => {
  it("pads the period summary so the card is fully visible on mobile", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <TransactionsTab />
      </QueryClientProvider>,
    );

    const openDashboard = screen.getByRole("link", {
      name: "Open dashboard for this period",
    });
    const summary = openDashboard.closest(".space-y-4");

    expect(summary).toHaveClass("pt-4");
    expect(summary).toHaveClass("px-2");
    expect(summary).toHaveClass("md:hidden");
  });
});
