import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider } from "jotai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Loan } from "@/services/loans/queries";
import type { LoanPayment } from "@/services/loans/payments";

const { mockPayments } = vi.hoisted(() => ({
  mockPayments: { current: [] as LoanPayment[] },
}));

vi.mock("@/hooks/async/useLoanPayments", () => ({
  useLoanPayments: () => ({
    createPayment: vi.fn(),
    isCreating: false,
    payments: mockPayments.current,
    isLoading: false,
    updatePayment: vi.fn(),
    deletePayment: vi.fn(),
    isUpdating: false,
    isDeleting: false,
  }),
}));

vi.mock("@/hooks/useNumberInput", () => ({
  useNumberInput: () => ({
    displayValue: "",
    handleInputChange: vi.fn(),
    handleBlur: vi.fn(),
    setDisplayValue: vi.fn(),
  }),
}));

import { LoanDetailPanel } from "@/components/dashboard/loan-detail-panel";

const createLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "loan-1",
  date: "2026-01-01",
  description: "Car loan",
  loanType: "borrowed",
  loanTermMonths: 12,
  maturityDate: "2027-01-01",
  status: "active",
  paidOffDate: null,
  interestRate: 12,
  entityName: "Jerry Oquendo",
  accountName: "Cash",
  principalAmount: 200_000,
  principalAmountCurrency: "PHP",
  outstandingBalance: 118_070.7,
  outstandingBalanceCurrency: "PHP",
  value: -200_000,
  income: 0,
  expense: 0,
  totalValue: 201_394.25,
  files: [],
  loanPayments: [],
  ...overrides,
});

const renderPanel = (loan: Loan = createLoan()) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <JotaiProvider>
      <QueryClientProvider client={queryClient}>
        <LoanDetailPanel
          loan={loan}
          isBorrowed
          textColorClass="text-red-600"
        />
      </QueryClientProvider>
    </JotaiProvider>,
  );
};

describe("LoanDetailPanel", () => {
  beforeEach(() => {
    mockPayments.current = [];
  });

  it("renders the payment schedule without accessing payments before they exist", () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    expect(() =>
      render(
        <JotaiProvider>
          <QueryClientProvider client={queryClient}>
            <LoanDetailPanel
              loan={createLoan()}
              isBorrowed
              textColorClass="text-red-600"
            />
          </QueryClientProvider>
        </JotaiProvider>,
      ),
    ).not.toThrow();

    expect(screen.getByText("Payments made")).toBeInTheDocument();
  });

  it("shows the cash date on paid schedule rows", async () => {
    const user = userEvent.setup();
    mockPayments.current = [
      {
        id: "payment-1",
        loanId: "loan-1",
        accountId: "account-1",
        accountName: "Cash - Ella",
        date: "2026-08-17",
        principalPayment: 1_000,
        interestPayment: 0,
        totalPayment: 1_000,
        currency: "PHP",
      },
    ];

    renderPanel(
      createLoan({
        date: "2026-07-08",
        maturityDate: "2027-07-08",
        interestRate: 0,
        principalAmount: 12_000,
        outstandingBalance: 11_000,
        totalValue: 12_000,
        value: -12_000,
      }),
    );

    await user.click(screen.getByRole("button", { name: /payment schedule/i }));

    expect(screen.getByText("Paid on Aug 17, 2026")).toBeInTheDocument();
  });
});
