import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ProTrialBadge } from "./pro-trial-badge";

const proAccess = vi.hoisted(() => ({
  pro: true,
  source: "trial" as "trial" | "none" | "revenuecat" | "subscription" | "admin",
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => ({
    data: {
      pro: proAccess.pro,
      source: proAccess.source,
      trialDaysRemaining: proAccess.source === "trial" ? 4 : 0,
    },
    isPending: false,
  }),
}));

describe("ProTrialBadge", () => {
  beforeEach(() => {
    proAccess.pro = true;
    proAccess.source = "trial";
  });

  it("marks a feature as Pro while the user is on trial", () => {
    render(<ProTrialBadge />);

    const badge = screen.getByText("Pro");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("pt-[0.3em]");
  });

  it("stays hidden once the trial is over", () => {
    proAccess.pro = false;
    proAccess.source = "none";

    render(<ProTrialBadge />);

    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
  });

  it("stays hidden for a paid Pro subscription", () => {
    proAccess.source = "revenuecat";

    render(<ProTrialBadge />);

    expect(screen.queryByText("Pro")).not.toBeInTheDocument();
  });
});
