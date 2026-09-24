import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { HomeRecentTransactions } from "./home-recent-transactions";

const { loadCachedTransactionsInRange, loadRecentCachedTransactions } =
  vi.hoisted(() => ({
    loadCachedTransactionsInRange: vi.fn(),
    loadRecentCachedTransactions: vi.fn(),
  }));

vi.mock("@/hooks/useAuthApi", () => {
  const useAuthApi = () => ({
    api: {},
    isAuthenticated: true,
  });

  return {
    useAuthApi,
    default: useAuthApi,
  };
});

vi.mock(
  "@/components/dashboard/tabs/transactions/transaction-row-type-icon",
  () => ({
    TransactionRowTypeIcon: () => null,
  }),
);

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-1", vi.fn()],
}));

vi.mock("@/hooks/useOfflineReadMode", () => ({
  usePreferLocalTransactionReads: () => true,
}));

vi.mock("@/services/transactions/local-cache", async () => {
  const actual = await vi.importActual<
    typeof import("@/services/transactions/local-cache")
  >("@/services/transactions/local-cache");

  return {
    ...actual,
    loadCachedTransactionsInRange,
    loadRecentCachedTransactions,
  };
});

const recentRow = {
  id: "tx-coffee",
  date: "2026-09-22",
  description: "Coffee",
  amount: 150,
  amountCurrency: "PHP",
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
};

const renderRecent = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return render(
    <HomeRecentTransactions spaceCurrency="PHP" />,
    { wrapper },
  );
};

describe("HomeRecentTransactions", () => {
  beforeEach(() => {
    loadCachedTransactionsInRange.mockReset();
    loadRecentCachedTransactions.mockReset();
    loadRecentCachedTransactions.mockResolvedValue([recentRow]);
  });

  it("reads a capped local window instead of the full transaction history", async () => {
    renderRecent();

    expect(await screen.findByText("Coffee")).toBeInTheDocument();

    expect(loadCachedTransactionsInRange).not.toHaveBeenCalled();
    expect(loadRecentCachedTransactions).toHaveBeenCalledTimes(1);

    const [spaceId, onOrBefore, limit] =
      loadRecentCachedTransactions.mock.calls[0] ?? [];

    expect(spaceId).toBe("space-1");
    expect(onOrBefore).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(onOrBefore).not.toBe("2099-12-31");
    expect(limit).toBeGreaterThanOrEqual(5);
    expect(limit).toBeLessThanOrEqual(200);

    await waitFor(() => {
      expect(loadRecentCachedTransactions).toHaveBeenCalledTimes(1);
    });
  });
});
