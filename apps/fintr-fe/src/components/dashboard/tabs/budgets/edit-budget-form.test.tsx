import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { EditBudgetForm } from "./edit-budget-form";
import { BudgetCategory } from "@/types/budgetTypes";

const mockUpdateBudgetMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
};

const mockCreateBudgetMutation = {
  mutateAsync: vi.fn(),
  isPending: false,
};

vi.mock("jotai", async () => {
  const actual = await vi.importActual("jotai");
  return {
    ...actual,
    useAtomValue: () => [
      {
        id: "cat-1",
        label: "Travel",
        value: "Travel",
        name: "Travel",
        parentId: null,
        children: [
          {
            id: "sub-1",
            label: "Japan 2026",
            value: "Japan 2026",
            name: "Japan 2026",
            parentId: "cat-1",
          },
        ],
      },
    ],
  };
});

vi.mock("@/hooks/useNumberInput", () => ({
  useNumberInput: ({ initialValue }: { initialValue: number }) => ({
    displayValue: String(initialValue),
    handleInputChange: vi.fn(),
    setDisplayValue: vi.fn(),
    reset: vi.fn(),
  }),
}));

describe("EditBudgetForm", () => {
  const parentBudget: BudgetCategory = {
    id: "budget-1",
    name: "Travel",
    categoryId: "cat-1",
    spent: 0,
    budget: 20_000,
    color: "#000",
    subcategories: [
      {
        id: "sub-budget-1",
        subcategoryId: "sub-1",
        subcategoryName: "Japan 2026",
        name: "Japan 2026",
        spent: 0,
        budget: 10_000,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hides category picker when hideCategory is true", () => {
    render(
      <EditBudgetForm
        budget={parentBudget}
        updateBudgetMutation={mockUpdateBudgetMutation as never}
        createBudgetMutation={mockCreateBudgetMutation as never}
        budgetMonthDate="2026-05-01"
        hideCategory
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText("Category")).not.toBeInTheDocument();
    expect(screen.getByText("Subcategory budgets")).toBeInTheDocument();
    expect(screen.getByText("Japan 2026")).toBeInTheDocument();
    expect(screen.getAllByText("Parent budget").length).toBeGreaterThanOrEqual(1);
  });

  it("shows allocation summary for parent with subcategories", () => {
    render(
      <EditBudgetForm
        budget={parentBudget}
        updateBudgetMutation={mockUpdateBudgetMutation as never}
        createBudgetMutation={mockCreateBudgetMutation as never}
        budgetMonthDate="2026-05-01"
        hideCategory
      />,
    );

    expect(screen.getByText("Subcategories allocated")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
  });
});
