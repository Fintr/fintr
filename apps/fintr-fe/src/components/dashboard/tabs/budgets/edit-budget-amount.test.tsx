import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EditBudgetForm } from "./edit-budget-form";
import type { BudgetCategory } from "@/types/budgetTypes";

vi.mock("@/hooks/async/useTransactionCategories", () => ({
  useTransactionCategories: () => ({
    expenseCategoryOptions: [],
    incomeCategoryOptions: [],
  }),
}));

const homeWithoutBudget = (): BudgetCategory => ({
  id: "",
  name: "Home",
  categoryId: "cat-home",
  spent: 18_800,
  budget: 0,
  color: "#000",
  subcategories: [],
});

describe("EditBudgetForm amount", () => {
  it("keeps a typed amount after the field blurs and the row refreshes", async () => {
    const user = userEvent.setup();
    const props = {
      updateBudgetMutation: { mutateAsync: vi.fn(), isPending: false } as never,
      createBudgetMutation: { mutateAsync: vi.fn(), isPending: false } as never,
      budgetMonthDate: "2026-09-01",
      hideCategory: true,
    };
    const { rerender } = render(
      <EditBudgetForm
        budget={homeWithoutBudget()}
        {...props}
      />,
    );

    const input = screen.getByPlaceholderText("0.00");
    await user.click(input);
    await user.type(input, "30000");
    await user.tab();

    rerender(
      <EditBudgetForm
        budget={{
          ...homeWithoutBudget(),
          subcategories: [],
        }}
        {...props}
      />,
    );

    expect(input).toHaveValue("30,000");
  });
});
