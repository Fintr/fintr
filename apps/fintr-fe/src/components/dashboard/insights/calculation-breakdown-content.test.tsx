import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CalculationBreakdownContent } from "./calculation-breakdown-content";

describe("CalculationBreakdownContent", () => {
  it("shows labeled formula, numeric formula, inputs, and notes", () => {
    render(
      <CalculationBreakdownContent
        title="Savings rate"
        calculation={{
          labeledFormula: "(Net savings ÷ Total income) × 100",
          formula: "₱80,236.81 ÷ ₱220,804.55 × 100 = 36.34%",
          inputs: [
            { label: "Total income", value: "₱220,804.55" },
            { label: "Savings rate", value: "36.34%" },
          ],
          notes: ["Uses transactions in your selected date range."],
        }}
      />,
    );

    expect(screen.getByText("Savings rate", { selector: "p.font-semibold" })).toBeInTheDocument();
    expect(
      screen.getByText("(Net savings ÷ Total income) × 100"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("₱80,236.81 ÷ ₱220,804.55 × 100 = 36.34%"),
    ).toBeInTheDocument();
    expect(screen.getByText("Total income")).toBeInTheDocument();
    expect(screen.getByText("₱220,804.55")).toBeInTheDocument();
    expect(
      screen.getByText("Uses transactions in your selected date range."),
    ).toBeInTheDocument();
  });

  it("falls back to static formula copy when API calculation is missing", () => {
    render(
      <CalculationBreakdownContent
        title="Savings rate"
        fallbackLabeledFormula="(Net savings ÷ Total income) × 100"
        fallbackNotes={["Net savings is total income minus total expenses."]}
      />,
    );

    expect(
      screen.getByText("(Net savings ÷ Total income) × 100"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Net savings is total income minus total expenses."),
    ).toBeInTheDocument();
  });
});
