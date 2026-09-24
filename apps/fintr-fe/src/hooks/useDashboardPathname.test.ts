import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  commitDashboardClientNavigation,
  resetDashboardCommittedPathname,
} from "@/lib/dashboard-nav-routes";

const mockUsePathname = vi.fn(() => "/dashboard/settings");

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
}));

describe("useDashboardPathname", () => {
  beforeEach(() => {
    resetDashboardCommittedPathname();
    mockUsePathname.mockReturnValue("/dashboard/settings");
    window.history.replaceState({}, "", "/dashboard/settings");
  });

  it("follows checkout as soon as the URL is committed", async () => {
    const { useDashboardPathname } = await import("./useDashboardPathname");
    const { result, rerender } = renderHook(() => useDashboardPathname());

    expect(result.current).toBe("/dashboard/settings");

    act(() => {
      commitDashboardClientNavigation("/dashboard/subscriptions/create");
    });
    rerender();

    expect(result.current).toBe("/dashboard/subscriptions/create");
    expect(mockUsePathname()).toBe("/dashboard/settings");
  });
});
