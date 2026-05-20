import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BudgetAllocationSummary } from "./budget-allocation-summary";

describe("BudgetAllocationSummary", () => {
  it("renders parent, allocated, and remaining on separate lines with aligned amounts", () => {
    render(
      <BudgetAllocationSummary
        parentAmount={20_000}
        allocatedToSubs={10_000}
        spaceCurrency="PHP"
        isOverAllocation={false}
      />,
    );

    expect(screen.getByText("Parent budget")).toBeInTheDocument();
    expect(screen.getByText("Subcategories allocated")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByText("₱20,000.00")).toBeInTheDocument();
    expect(screen.getAllByText("₱10,000.00")).toHaveLength(2);
  });

  it("highlights remaining in red when over allocation", () => {
    render(
      <BudgetAllocationSummary
        parentAmount={10_000}
        allocatedToSubs={15_000}
        spaceCurrency="PHP"
        isOverAllocation
      />,
    );

    const remaining = screen.getByText("Remaining").closest("div")?.parentElement;
    const remainingAmount = screen.getByText("-₱5,000.00");
    expect(remainingAmount).toHaveClass("text-red-600");
  });
});
