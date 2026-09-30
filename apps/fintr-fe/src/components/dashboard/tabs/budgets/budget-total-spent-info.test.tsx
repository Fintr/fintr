import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { BudgetTotalSpentInfo } from "./budget-total-spent-info";

describe("BudgetTotalSpentInfo", () => {
  it("explains that total spent is all expenses for the period", async () => {
    const user = userEvent.setup();
    render(<BudgetTotalSpentInfo />);

    await user.click(
      screen.getByRole("button", { name: "About total spent" }),
    );

    expect(
      screen.getByText(
        "This total is all expenses for this period.",
      ),
    ).toBeInTheDocument();
  });
});
