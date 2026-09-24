import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Tabs } from "@/components/ui/tabs";

vi.mock("@/components/dashboard/tabs/loans", () => ({
  default: () => <div>Loans content</div>,
}));

import LoansPage from "./page";

describe("loans page", () => {
  it("renders Loans even when the shell tab value is still home", () => {
    render(
      <Tabs value="home">
        <LoansPage />
      </Tabs>,
    );

    expect(screen.getByText("Loans content")).toBeVisible();
  });
});
