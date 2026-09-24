import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Tabs } from "@/components/ui/tabs";

vi.mock("@/components/dashboard/tabs/insights-tab", () => ({
  default: () => <div>Insights content</div>,
}));

import InsightsPage from "./page";

describe("insights page", () => {
  it("renders Dashboard even when the shell tab value is still home", () => {
    render(
      <Tabs value="home">
        <InsightsPage />
      </Tabs>,
    );

    expect(screen.getByText("Insights content")).toBeVisible();
  });
});
