import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ExpenseBreakdownCard } from "./expense-breakdown-card";

const proAccess = vi.hoisted(() => ({
  pro: true,
  source: "subscription" as "trial" | "none" | "subscription",
}));

vi.mock("@/hooks/async/useProAccess", () => ({
  useProAccess: () => ({
    data: {
      pro: proAccess.pro,
      source: proAccess.source,
      trialDaysRemaining: proAccess.source === "trial" ? 4 : 0,
    },
    isPending: false,
    isPaused: false,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("gsap", () => ({
  default: {
    registerPlugin: vi.fn(),
    to: vi.fn(),
  },
}));

vi.mock("gsap/ScrollTrigger", () => ({
  ScrollTrigger: {},
}));

vi.mock("@gsap/react", () => ({
  useGSAP: vi.fn(),
}));

const foodSlice = [
  {
    name: "Food",
    value: 100,
    color: "#0A3D62",
    percentage: "100%",
  },
];

describe("ExpenseBreakdownCard", () => {
  beforeEach(() => {
    proAccess.pro = true;
    proAccess.source = "subscription";
  });

  it("badges Expense Breakdown during a trial", () => {
    proAccess.source = "trial";

    render(
      <ExpenseBreakdownCard
        items={foodSlice}
        formatAmount={(amount) => String(amount)}
      />,
    );

    expect(screen.getByText("Expense Breakdown")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
  });

  it("locks the breakdown when Fintr Pro is required", () => {
    proAccess.pro = false;
    proAccess.source = "none";

    render(
      <ExpenseBreakdownCard
        items={foodSlice}
        formatAmount={(amount) => String(amount)}
        title="Merchant Expense Breakdown"
      />,
    );

    expect(screen.getByText("Merchant Expense Breakdown")).toBeInTheDocument();
    expect(
      screen.getByText("Fintr Pro is required for Expense Breakdown"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Food")).not.toBeInTheDocument();
  });
});
