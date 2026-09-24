import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Tabs } from "@/components/ui/tabs";

vi.mock("@/components/dashboard/tabs/space-settings-tab", () => ({
  default: () => <div>Space settings content</div>,
}));

import SpaceSettingsPage from "./page";

describe("space settings page", () => {
  it("renders settings content even when the shell tab value is still home", () => {
    render(
      <Tabs value="home">
        <SpaceSettingsPage />
      </Tabs>,
    );

    expect(screen.getByText("Space settings content")).toBeVisible();
  });
});
