import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

import type { Loan } from "@/services/loans/queries";

const mockLoan: Loan = {
  id: "loan-1",
  date: "2026-01-01",
  description: "Car loan subcategory",
  loanType: "borrowed",
  loanTermMonths: 12,
  maturityDate: "2027-01-01",
  status: "active",
  paidOffDate: null,
  interestRate: 12,
  entityName: "Jerry Oquendo",
  accountName: "Cash",
  principalAmount: 933,
  principalAmountCurrency: "PLN",
  outstandingBalance: 876.64,
  outstandingBalanceCurrency: "PLN",
  value: -933,
  income: 0,
  expense: 0,
  totalValue: 949.62,
  files: [],
  loanPayments: [],
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useLocalStorage", () => ({
  useLocalStorage: () => ["space-1"],
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

let loanForTest: Loan = mockLoan;

vi.mock("@/hooks/async/useLoan", () => ({
  LOAN_DETAIL_KEY: "loanDetail",
  useLoan: () => ({
    data: loanForTest,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/hooks/async/useLoanPayments", () => ({
  useLoanPayments: () => ({
    payments: [],
  }),
}));

vi.mock("@/components/dashboard/loan-detail-panel", () => ({
  LoanDetailPanel: () => <div data-testid="loan-detail-panel" />,
}));

vi.mock("@/components/dashboard/loan-summary-stats", () => ({
  LoanSummaryStats: () => <div data-testid="loan-summary-stats" />,
}));

vi.mock("@/components/dashboard/loan-paydown-progress", () => ({
  LoanPaydownProgress: () => <div data-testid="loan-paydown-progress" />,
}));

vi.mock("@/components/dashboard/forms/EditLoanModal", () => ({
  default: () => (
    <button type="button" aria-label="Edit loan with Jerry Oquendo">
      Edit
    </button>
  ),
}));

vi.mock("@/components/dashboard/forms/RetireLoanModal", () => ({
  default: () => <button type="button">Retire</button>,
}));

import LoanDetailContent from "./loan-detail-content";

describe("LoanDetailContent", () => {
  beforeEach(() => {
    loanForTest = mockLoan;
  });

  it("places edit, retire, and delete actions on the same row as status pills, below the title", () => {
    render(<LoanDetailContent loanId="loan-1" />);

    const title = screen.getByRole("heading", {
      name: "Car loan subcategory",
    });
    const statusRow = screen.getByTestId("loan-detail-status-row");

    expect(statusRow).not.toContainElement(title);
    expect(
      title.compareDocumentPosition(statusRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(within(statusRow).getByText("Active")).toBeInTheDocument();
    expect(within(statusRow).getByText("Borrowed")).toBeInTheDocument();
    expect(
      within(statusRow).getByRole("button", {
        name: "Edit loan with Jerry Oquendo",
      }),
    ).toBeInTheDocument();
    expect(
      within(statusRow).getByRole("button", { name: "Retire" }),
    ).toBeInTheDocument();
    expect(
      within(statusRow).getByRole("button", {
        name: "Delete loan with Jerry Oquendo",
      }),
    ).toBeInTheDocument();
  });

  it("keeps the toolbar delete button red for lent loans", () => {
    loanForTest = {
      ...mockLoan,
      loanType: "lent",
    };

    render(<LoanDetailContent loanId="loan-1" />);

    const deleteButton = screen.getByRole("button", {
      name: "Delete loan with Jerry Oquendo",
    });

    expect(deleteButton.className).toContain("text-red-900");
    expect(deleteButton.className).not.toContain("text-teal-600");
  });
});
