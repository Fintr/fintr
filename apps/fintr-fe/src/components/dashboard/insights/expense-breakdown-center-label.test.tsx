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
          amountLabel="₱140,567.74"
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
    expect(tspans[1]?.getAttribute("y")).toBe("92");
  });

  it("renders nothing when cx or cy is missing", () => {
    const { container } = render(
      <svg>
        <ExpenseBreakdownCenterLabel amountLabel="₱0" />
      </svg>,
    );

    expect(container.querySelector("[data-testid='expense-breakdown-center']")).toBeNull();
  });

  it("resolves center from cartesian viewBox used by Recharts position=center", () => {
    const { container } = render(
      <svg>
        <ExpenseBreakdownCenterLabel
          viewBox={{ x: 20, y: 40, width: 200, height: 160 }}
          amountLabel="₱1,234.56"
        />
      </svg>,
    );

    expect(screen.getByTestId("expense-breakdown-center")).toBeInTheDocument();
    expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    expect(screen.getByText("₱1,234.56")).toBeInTheDocument();

    const tspans = container.querySelectorAll("tspan");
    expect(tspans[0]?.getAttribute("x")).toBe("120");
    expect(tspans[0]?.getAttribute("y")).toBe("110");
    expect(tspans[1]?.getAttribute("x")).toBe("120");
    expect(tspans[1]?.getAttribute("y")).toBe("132");
  });
});
