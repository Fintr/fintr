import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ExpenseBreakdownCenterLabel } from "./expense-breakdown-center-label";

describe("ExpenseBreakdownCenterLabel", () => {
  it("renders total label at the pie center coordinates", () => {
    const { container } = render(
      <svg>
        <ExpenseBreakdownCenterLabel
          cx={120}
          cy={80}
          totalLabel="₱140,567.74"
        />
      </svg>,
    );

    expect(screen.getByTestId("expense-breakdown-center")).toBeInTheDocument();
    expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    expect(screen.getByText("₱140,567.74")).toBeInTheDocument();

    const tspans = container.querySelectorAll("tspan");
    expect(tspans[0]?.getAttribute("x")).toBe("120");
    expect(tspans[0]?.getAttribute("y")).toBe("70");
    expect(tspans[1]?.getAttribute("x")).toBe("120");
    expect(tspans[1]?.getAttribute("y")).toBe("94");
  });

  it("renders nothing when cx or cy is missing", () => {
    const { container } = render(
      <svg>
        <ExpenseBreakdownCenterLabel totalLabel="₱0" />
      </svg>,
    );

    expect(container.querySelector("[data-testid='expense-breakdown-center']")).toBeNull();
  });
});
