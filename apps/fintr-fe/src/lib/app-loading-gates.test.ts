import { afterEach, describe, expect, it } from "vitest";

import {
  isWorkspaceContextBlocking,
  shouldShowAuthLoadingScreen,
  shouldShowDashboardShellLoadingScreen,
  shouldShowOfflineSyncScreen,
  shouldShowPrivateContextLoadingScreen,
} from "./app-loading-gates";
import { clearAppShellReadyForTests } from "./app-shell-state";

describe("shouldShowAuthLoadingScreen", () => {
  afterEach(() => {
    clearAppShellReadyForTests();
  });

  it("does not block public routes", () => {
    expect(
      shouldShowAuthLoadingScreen({
        isPublicRoute: true,
        isAuthContextLoading: true,
        isAuthenticated: false,
        hasStoredSession: false,
      }),
    ).toBe(false);
  });
});

describe("shouldShowPrivateContextLoadingScreen", () => {
  afterEach(() => {
    clearAppShellReadyForTests();
  });

  it("does not block when a workspace is already persisted", () => {
    expect(
      shouldShowPrivateContextLoadingScreen({
        isOnOnboardingPage: false,
        isOnAdminPage: false,
        isResolvingWorkspaceContext: true,
        hasPersistedSpaceCode: true,
      }),
    ).toBe(false);
  });
});

describe("shouldShowDashboardShellLoadingScreen", () => {
  it("always returns false", () => {
    expect(
      shouldShowDashboardShellLoadingScreen({
        hasSpaceCode: false,
        isOnline: true,
        isWaitingForDashboardData: true,
      }),
    ).toBe(false);
  });
});

describe("shouldShowOfflineSyncScreen", () => {
  it("shows the import screen until offline sync completes", () => {
    expect(
      shouldShowOfflineSyncScreen({
        requiresOfflineReimport: true,
        offlineSyncStatus: "checking",
      }),
    ).toBe(true);

    expect(
      shouldShowOfflineSyncScreen({
        requiresOfflineReimport: true,
        offlineSyncStatus: "syncing",
      }),
    ).toBe(true);

    expect(
      shouldShowOfflineSyncScreen({
        requiresOfflineReimport: true,
        offlineSyncStatus: "error",
      }),
    ).toBe(true);

    expect(
      shouldShowOfflineSyncScreen({
        requiresOfflineReimport: true,
        offlineSyncStatus: "complete",
      }),
    ).toBe(false);
  });

  it("does not block when local data is already complete", () => {
    expect(
      shouldShowOfflineSyncScreen({
        requiresOfflineReimport: false,
        offlineSyncStatus: "idle",
      }),
    ).toBe(false);
  });
});

describe("isWorkspaceContextBlocking", () => {
  it("does not treat a returning workspace as loading", () => {
    expect(
      isWorkspaceContextBlocking({
        queryEnabled: true,
        isUserContextResolved: false,
        hasPersistedSpaceCode: true,
        queriesBusy: true,
      }),
    ).toBe(false);
  });

  it("blocks only while workspace context is still resolving", () => {
    expect(
      isWorkspaceContextBlocking({
        queryEnabled: true,
        isUserContextResolved: false,
        hasPersistedSpaceCode: false,
        queriesBusy: true,
      }),
    ).toBe(true);
  });
});
