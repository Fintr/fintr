import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LoanSummaryStats } from "@/components/dashboard/loan-summary-stats";
import type { Loan } from "@/services/loans/queries";

const createLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: "loan-1",
  date: "2026-06-19",
  description: "Home loan",
  loanType: "borrowed",
  loanTermMonths: 120,
  maturityDate: "2036-06-19",
  status: "active",
  paidOffDate: null,
  interestRate: 10,
  entityName: "Bank",
  accountName: "Cash",
  principalAmount: 1_000_000,
  principalAmountCurrency: "PHP",
  outstandingBalance: 995_214.71,
  outstandingBalanceCurrency: "PHP",
  value: -1_000_000,
  income: 0,
  expense: 0,
  totalValue: 1_584_973.68,
  files: [],
  loanPayments: [],
  ...overrides,
});

describe("LoanSummaryStats", () => {
  it("labels principal plus interest as payable when the loan is borrowed", () => {
    render(
      <LoanSummaryStats
        loan={createLoan({ loanType: "borrowed" })}
        isBorrowed
        textColorClass="text-red-900"
      />,
    );

    expect(screen.getByText("Payable")).toBeInTheDocument();
    expect(screen.queryByText("Net cost")).not.toBeInTheDocument();
  });

  it("labels principal plus interest as receivable when the loan is lent", () => {
    render(
      <LoanSummaryStats
        loan={createLoan({ loanType: "lent", value: 1_000_000 })}
        isBorrowed={false}
        textColorClass="text-teal-600"
      />,
    );

    expect(screen.getByText("Receivable")).toBeInTheDocument();
    expect(screen.queryByText("Net gain")).not.toBeInTheDocument();
  });
});
