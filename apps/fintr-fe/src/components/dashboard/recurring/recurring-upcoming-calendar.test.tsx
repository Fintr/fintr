import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RecurringUpcomingCalendar } from "./recurring-upcoming-calendar";

describe("RecurringUpcomingCalendar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders weekday headers without duplicate React keys", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<RecurringUpcomingCalendar days={[]} monthAnchor="2026-09-01" />);

    expect(screen.getAllByText("S")).toHaveLength(2);
    expect(screen.getAllByText("T")).toHaveLength(2);
    expect(screen.getByText("M")).toBeInTheDocument();

    const keyWarnings = errorSpy.mock.calls.filter((call) =>
      call.some(
        (arg) =>
          typeof arg === "string"
          && arg.includes("Encountered two children with the same key"),
      ),
    );

    expect(keyWarnings).toEqual([]);
  });
});
