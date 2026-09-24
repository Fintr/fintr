import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useRecurringSeries = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/async/useRecurringSeries", () => ({
  useRecurringSeries: () => useRecurringSeries(),
}));

vi.mock("@/hooks/useAuthApi", () => ({
  useAuthApi: () => ({ api: {} }),
}));

vi.mock("@/hooks/useSpaceContext", () => ({
  useSpaceContext: () => ({ currentSpace: { currency: "PHP" } }),
}));

import RecurringTab from "./index";

describe("RecurringTab", () => {
  it("shows Recurring chrome while the series query is still pending", () => {
    useRecurringSeries.mockReturnValue({
      summaries: [],
      upcoming: [],
      active: [],
      inactive: [],
      isPending: true,
      isError: false,
      error: null,
    });

    render(<RecurringTab />);

    expect(screen.getByRole("heading", { name: "Recurring" })).toBeVisible();
    expect(screen.getByRole("radiogroup", { name: "Recurring view" })).toBeVisible();
    expect(screen.getByText("This month")).toBeVisible();
    expect(screen.queryByText("No recurring transactions yet.")).not.toBeInTheDocument();
  });
});
