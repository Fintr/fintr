import { act, renderHook } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetDashboardCommittedPathname } from "@/lib/dashboard-nav-routes";

const mockUsePathname = vi.fn(() => "/dashboard/home");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("usePendingDashboardBottomTab", () => {
  beforeEach(() => {
    resetDashboardCommittedPathname();
    mockUsePathname.mockReturnValue("/dashboard/home");
  });

  it("shows the pending tab before the route updates, then follows the pathname", async () => {
    const { usePendingDashboardBottomTab } = await import(
      "./usePendingDashboardBottomTab"
    );
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(JotaiProvider, { store }, children);

    const { result, rerender } = renderHook(
      () => usePendingDashboardBottomTab(),
      { wrapper },
    );

    expect(result.current.visibleTab).toBe("home");

    act(() => {
      result.current.setPendingTab("menu");
    });

    expect(result.current.visibleTab).toBe("menu");

    mockUsePathname.mockReturnValue("/dashboard/app_settings");
    rerender();

    expect(result.current.visibleTab).toBe("menu");
    expect(result.current.pendingTab).toBeNull();
  });

  it("shows the Recurring cached tab once the route catches up", async () => {
    mockUsePathname.mockReturnValue("/dashboard/");
    const { usePendingDashboardBottomTab } = await import(
      "./usePendingDashboardBottomTab"
    );
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(JotaiProvider, { store }, children);

    const { result, rerender } = renderHook(
      () => usePendingDashboardBottomTab(),
      { wrapper },
    );

    act(() => {
      result.current.setPendingTab("transactions");
    });

    mockUsePathname.mockReturnValue("/dashboard/recurring");
    rerender();

    expect(result.current.visibleTab).toBe("recurring");
  });

  it("clears a leftover pending tab on nested detail routes", async () => {
    mockUsePathname.mockReturnValue("/dashboard/loans");
    const { usePendingDashboardBottomTab } = await import(
      "./usePendingDashboardBottomTab"
    );
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(JotaiProvider, { store }, children);

    const { result, rerender } = renderHook(
      () => usePendingDashboardBottomTab(),
      { wrapper },
    );

    act(() => {
      result.current.setPendingTab("loans");
    });

    mockUsePathname.mockReturnValue("/dashboard/loans/detail");
    rerender();

    expect(result.current.visibleTab).toBeNull();
  });
});
