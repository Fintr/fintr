import { beforeEach, describe, expect, it, vi } from "vitest";

import { offlineBootstrapDateRange } from "@/lib/local-sync/offline-bootstrap-dates";
import { getCurrentMonthDates } from "@/utils/dateUtils";

import {
  cacheWorkspaceSetupInIndexedDb,
  setupStepPersistsSpaceData,
} from "./cache-workspace-setup";

const syncLocalDataFromBackend = vi.fn();
const seedReactQueryFromLocalCache = vi.fn();

vi.mock("@/services/local-sync/bootstrap-local-data", () => ({
  syncLocalDataFromBackend: (...args: unknown[]) =>
    syncLocalDataFromBackend(...args),
  seedReactQueryFromLocalCache: (...args: unknown[]) =>
    seedReactQueryFromLocalCache(...args),
}));

describe("setupStepPersistsSpaceData", () => {
  it("imports IndexedDB only for steps that create workspace rows", () => {
    expect(setupStepPersistsSpaceData("currency")).toBe(true);
    expect(setupStepPersistsSpaceData("accounts")).toBe(true);
    expect(setupStepPersistsSpaceData("skip")).toBe(true);
    expect(setupStepPersistsSpaceData("income")).toBe(false);
    expect(setupStepPersistsSpaceData("budgets")).toBe(false);
  });
});

describe("cacheWorkspaceSetupInIndexedDb", () => {
  const api = { get: vi.fn() };
  const queryClient = { setQueryData: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    syncLocalDataFromBackend.mockResolvedValue({ errors: [] });
    seedReactQueryFromLocalCache.mockResolvedValue(true);
  });

  it("bootstraps the server workspace into IndexedDB", async () => {
    await cacheWorkspaceSetupInIndexedDb({
      api: api as never,
      queryClient: queryClient as never,
      spaceCode: " setup-space ",
    });

    const range = offlineBootstrapDateRange();
    const { firstDay, lastDay } = getCurrentMonthDates();

    expect(syncLocalDataFromBackend).toHaveBeenCalledWith(
      api,
      queryClient,
      {
        spaceCode: "setup-space",
        startDate: range.startDate,
        endDate: range.endDate,
      },
      { deferExchangeRates: true },
    );
    expect(seedReactQueryFromLocalCache).toHaveBeenCalledWith(queryClient, {
      spaceCode: "setup-space",
      startDate: firstDay,
      endDate: lastDay,
    });
  });

  it("does nothing when the space code is missing", async () => {
    await cacheWorkspaceSetupInIndexedDb({
      api: api as never,
      queryClient: queryClient as never,
      spaceCode: "  ",
    });

    expect(syncLocalDataFromBackend).not.toHaveBeenCalled();
  });

  it("keeps setup successful when the local import fails", async () => {
    syncLocalDataFromBackend.mockRejectedValue(new Error("bootstrap down"));

    await expect(
      cacheWorkspaceSetupInIndexedDb({
        api: api as never,
        queryClient: queryClient as never,
        spaceCode: "setup-space",
      }),
    ).resolves.toBeUndefined();
  });
});
