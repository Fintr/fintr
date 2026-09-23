import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Tabs } from "@/components/ui/tabs";

vi.mock("@/components/dashboard/tabs/recurring", () => ({
  default: () => <div>Recurring content</div>,
}));

import RecurringPage from "./page";

describe("recurring page", () => {
  it("renders Recurring even when the shell tab value is still home", () => {
    render(
      <Tabs value="home">
        <RecurringPage />
      </Tabs>,
    );

    expect(screen.getByText("Recurring content")).toBeVisible();
  });
});
