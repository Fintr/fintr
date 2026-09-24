import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const prefetch = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch }),
}));

describe("usePrefetchDashboardNavRoutes", () => {
  beforeEach(() => {
    prefetch.mockReset();
    vi.stubGlobal("navigator", { onLine: true });
  });

  it("prefetches entities and other Menu routes while online", async () => {
    const { usePrefetchDashboardNavRoutes } = await import(
      "./usePrefetchDashboardNavRoutes"
    );

    renderHook(() => usePrefetchDashboardNavRoutes());

    expect(prefetch).toHaveBeenCalledWith("/dashboard/space_settings/entities");
    expect(prefetch).toHaveBeenCalledWith("/dashboard/app_settings");
    expect(prefetch).toHaveBeenCalledWith("/dashboard/loans/detail");
  });
});
