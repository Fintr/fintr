import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TransactionTotalsDisplay } from "./transaction-totals";
import { formatCurrency } from "@/lib/utils";

const totals = {
  income: 5000,
  expense: 3200,
  transfer: 1800,
};

describe("TransactionTotalsDisplay", () => {
  it("pairs income and expenses with transfers on desktop in the default variant", () => {
    render(
      <TransactionTotalsDisplay
        totals={totals}
        spaceCurrency="PHP"
      />,
    );

    const incomeChip = screen.getByText(
      `Income: ${formatCurrency(totals.income, "PHP")}`,
    ).closest("div");
    const expenseChip = screen.getByText(
      `Expenses: ${formatCurrency(Math.abs(totals.expense), "PHP")}`,
    ).closest("div");
    const transferChip = screen.getByText(
      `Transfers: ${formatCurrency(Math.abs(totals.transfer), "PHP")}`,
    ).closest("div");

    expect(incomeChip).toHaveClass("hidden", "md:flex");
    expect(expenseChip).toHaveClass("hidden", "md:flex");
    expect(transferChip).not.toHaveClass("hidden");
  });

  it("still shows desktop income and expense chips when there are no transfers", () => {
    render(
      <TransactionTotalsDisplay
        totals={{
          income: 5000,
          expense: 3200,
          transfer: 0,
        }}
        spaceCurrency="PHP"
      />,
    );

    expect(
      screen.getByText(`Income: ${formatCurrency(5000, "PHP")}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Expenses: ${formatCurrency(3200, "PHP")}`),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Transfers:/)).not.toBeInTheDocument();
  });

  it("hides the default variant when every total is zero", () => {
    const { container } = render(
      <TransactionTotalsDisplay
        totals={{
          income: 0,
          expense: 0,
          transfer: 0,
        }}
        spaceCurrency="PHP"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders labeled income, expenses, and transfers boxes in the summary variant", () => {
    render(
      <TransactionTotalsDisplay
        totals={totals}
        spaceCurrency="PHP"
        variant="summary"
      />,
    );

    expect(screen.getByText("Income")).toBeInTheDocument();
    expect(screen.getByText("Expenses")).toBeInTheDocument();
    expect(screen.getByText("Transfers")).toBeInTheDocument();
  });
});
