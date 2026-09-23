import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WeeklySpendingCard } from "./weekly-spending-card";

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
});
