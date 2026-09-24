import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WeeklySpendingCard } from "./weekly-spending-card";

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

const weekWithSpending = [
  { day: "Mon", amount: 1200 },
  { day: "Tue", amount: 800 },
  { day: "Wed", amount: 1500 },
  { day: "Thu", amount: 950 },
  { day: "Fri", amount: 2200 },
  { day: "Sat", amount: 1800 },
  { day: "Sun", amount: 1100 },
];

describe("WeeklySpendingCard", () => {
  beforeEach(() => {
    proAccess.pro = true;
    proAccess.source = "subscription";
  });

  it("keeps the bar chart in a compact fixed-height frame", () => {
    render(
      <WeeklySpendingCard
        data={weekWithSpending}
        formatAmount={(amount) => String(amount)}
      />,
    );

    expect(screen.getByText("Weekly Spending")).toBeInTheDocument();

    const chart = document.querySelector("[data-slot='chart']");
    expect(chart).not.toBeNull();
    expect(chart).toHaveClass("h-48");
    expect(chart).toHaveClass("overflow-hidden");
    expect(chart).toHaveClass("aspect-auto");
    expect(chart?.className).not.toMatch(/aspect-\[5\/3\]/);
    expect(chart?.className).not.toMatch(/max-h-\[260px\]/);
  });

  it("does not render a chart when the week has no spending", () => {
    render(
      <WeeklySpendingCard
        data={weekWithSpending.map((entry) => ({
          ...entry,
          amount: 0,
        }))}
        formatAmount={(amount) => String(amount)}
      />,
    );

    expect(
      screen.getByText("No spending recorded this week yet."),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-slot='chart']")).toBeNull();
  });

  it("badges Weekly Spending during a trial", () => {
    proAccess.source = "trial";

    render(
      <WeeklySpendingCard
        data={weekWithSpending}
        formatAmount={(amount) => String(amount)}
      />,
    );

    expect(screen.getByText("Weekly Spending")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(document.querySelector("[data-slot='chart']")).not.toBeNull();
  });

  it("locks the chart when Fintr Pro is required", () => {
    proAccess.pro = false;
    proAccess.source = "none";

    render(
      <WeeklySpendingCard
        data={weekWithSpending}
        formatAmount={(amount) => String(amount)}
      />,
    );

    expect(screen.getByText("Weekly Spending")).toBeInTheDocument();
    expect(
      screen.getByText("Fintr Pro is required for Weekly Spending"),
    ).toBeInTheDocument();
    expect(document.querySelector("[data-slot='chart']")).toBeNull();
  });
});
