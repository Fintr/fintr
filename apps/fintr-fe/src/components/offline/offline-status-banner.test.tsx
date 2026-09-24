import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OfflineStatusBanner } from "./offline-status-banner";

describe("OfflineStatusBanner", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: true,
    });
    vi.useRealTimers();
  });

  it("is hidden while online", () => {
    render(<OfflineStatusBanner />);

    expect(
      screen.queryByRole("status", { name: /offline/i }),
    ).not.toBeInTheDocument();
  });

  it("tells the user they can keep working while offline", () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });

    render(<OfflineStatusBanner />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /you're offline/i,
    );
    expect(screen.getByRole("status")).toHaveTextContent(/sync/i);
  });

  it("hides after 3 seconds so it does not compete with the online toast", () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      writable: true,
      value: false,
    });

    render(<OfflineStatusBanner />);

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2999);
    });

    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
