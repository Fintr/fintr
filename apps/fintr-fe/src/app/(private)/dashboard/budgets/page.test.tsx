import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Tabs } from "@/components/ui/tabs";

vi.mock("@/components/dashboard/tabs/budgets", () => ({
  default: () => <div>Budgets content</div>,
}));

import BudgetsPage from "./page";

describe("budgets page", () => {
  it("renders Budgets even when the shell tab value is still home", () => {
    render(
      <Tabs value="home">
        <BudgetsPage />
      </Tabs>,
    );

    expect(screen.getByText("Budgets content")).toBeVisible();
  });
});
