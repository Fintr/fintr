import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoanUpcomingSections } from "./loan-upcoming-sections";
import type { Loan } from "@/services/loans/queries";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

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
  ...overrides,
});

describe("LoanUpcomingSections", () => {
  it("shows what the loan is for, not only who it is with", () => {
    render(<LoanUpcomingSections loans={[createLoan()]} />);

    expect(screen.getByText("Car loan")).toBeInTheDocument();
    expect(screen.getByText("Jerry Oquendo")).toBeInTheDocument();
  });
});
