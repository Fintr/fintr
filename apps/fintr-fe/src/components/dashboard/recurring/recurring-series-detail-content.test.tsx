import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import { DeleteScopeEnum } from "@/constants/transactionConstants";
import { RecurringSeriesDetailContent } from "./recurring-series-detail-content";

const mockPush = vi.fn();
const mockRefetch = vi.fn(async () => ({ data: [] }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({ currentSpace: { currency: "PHP" } }),
}));

vi.mock("@/hooks/async/useRecurringSeries", () => ({
  useRecurringSeries: () => ({
    summaries: [
      {
        rootParentId: "series-1",
        scheduleType: "installment",
        installmentPeriod: 6,
        installmentTotal: 600,
        amount: 100,
        amountCurrency: "PHP",
        repeatInterval: "monthly",
        nextOccurrenceDate: "2026-09-01",
        representative: {
          id: "series-1",
          description: "Phone installment",
          categoryName: "Gadgets",
          amount: 100,
          amountCurrency: "PHP",
          type: CombinedTransactionTypeEnum.EXPENSE,
        },
        occurrences: [],
      },
    ],
    isPending: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
  }),
}));

vi.mock("@/services/transactions/queries", () => ({
  materializeTransactionSeries: vi.fn(),
}));

vi.mock("@/services/transactions/materialize-series-local", () => ({
  persistMaterializedSeriesTransactions: vi.fn(),
}));

vi.mock("@/components/dashboard/forms/EditTransactionDialog", () => ({
  default: ({
    onSuccess,
  }: {
    onSuccess: (options?: {
      deleted?: boolean;
      deleteScope?: DeleteScopeEnum;
      skipTransactionsInvalidate?: boolean;
    }) => void;
  }) => (
    <>
      <button
        type="button"
        onClick={() =>
          onSuccess({
            skipTransactionsInvalidate: true,
          })
        }
      >
        Trigger update success
      </button>
      <button
        type="button"
        onClick={() =>
          onSuccess({
            deleted: true,
            deleteScope: DeleteScopeEnum.ALL_IN_SERIES,
          })
        }
      >
        Trigger delete success
      </button>
    </>
  ),
}));

vi.mock("@/components/dashboard/tabs/transactions/transaction-row-type-icon", () => ({
  TransactionRowTypeIcon: () => <span data-testid="type-icon" />,
}));

describe("RecurringSeriesDetailContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockReset();
    mockRefetch.mockClear();
    mockRefetch.mockResolvedValue({ data: [] });
  });

  it("refetches the installment series immediately after a payment update", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecurringSeriesDetailContent seriesId="series-1" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Phone installment")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /trigger update success/i }));

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("navigates back to recurring after deleting the installment series", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RecurringSeriesDetailContent seriesId="series-1" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText("Phone installment")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /trigger delete success/i }));

    expect(mockPush).toHaveBeenCalledWith("/dashboard/recurring");
  });
});
