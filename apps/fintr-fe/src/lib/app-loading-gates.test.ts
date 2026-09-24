import { afterEach, describe, expect, it } from "vitest";

import {
  isWorkspaceContextBlocking,
  shouldRunOfflineSync,
  shouldShowAuthLoadingScreen,
  shouldShowDashboardShellLoadingScreen,
  shouldShowOfflineSyncScreen,
  shouldShowPrivateContextLoadingScreen,
} from "./app-loading-gates";
import {
  clearAppShellReadyForTests,
  markAppShellReady,
} from "./app-shell-state";

describe("shouldShowAuthLoadingScreen", () => {
  afterEach(() => {
    clearAppShellReadyForTests();
  });

  it("does not block public routes", () => {
    expect(
      shouldShowAuthLoadingScreen({
        appShellReady: false,
        isPublicRoute: true,
        isAuthContextLoading: true,
        isAuthenticated: false,
        hasStoredSession: false,
      }),
    ).toBe(false);
  });

  it("keeps the splash on the server/hydration snapshot even if the shell is already latched", () => {
    markAppShellReady();

    expect(
      shouldShowAuthLoadingScreen({
        appShellReady: false,
        isPublicRoute: false,
        isAuthContextLoading: true,
        isAuthenticated: false,
        hasStoredSession: false,
      }),
    ).toBe(true);
  });
});

describe("shouldShowPrivateContextLoadingScreen", () => {
  afterEach(() => {
    clearAppShellReadyForTests();
  });

  it("does not block when a workspace is already persisted", () => {
    expect(
      shouldShowPrivateContextLoadingScreen({
        appShellReady: false,
        isOnOnboardingPage: false,
        isOnAdminPage: false,
        isResolvingWorkspaceContext: true,
        hasPersistedSpaceCode: true,
      }),
    ).toBe(false);
  });

  it("uses the provided appShellReady flag instead of sessionStorage", () => {
    markAppShellReady();

    expect(
      shouldShowPrivateContextLoadingScreen({
        appShellReady: false,
        isOnOnboardingPage: false,
        isOnAdminPage: false,
        isResolvingWorkspaceContext: true,
        hasPersistedSpaceCode: false,
      }),
    ).toBe(true);
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

  it("does not block workspace setup while offline sync is not allowed to run", () => {
    expect(
      shouldShowOfflineSyncScreen({
        requiresOfflineReimport: true,
        offlineSyncStatus: "idle",
        canRunOfflineSync: false,
      }),
    ).toBe(false);
  });
});

describe("shouldRunOfflineSync", () => {
  const ready = {
    isAuthenticated: true,
    isAuthLoading: false,
    isOnOnboardingPage: false,
    isOnAdminPage: false,
    onboardingStep: "completed" as const,
  };

  it("waits until setup has finished so an empty workspace is not cached", () => {
    expect(
      shouldRunOfflineSync({
        ...ready,
        onboardingStep: null,
      }),
    ).toBe(false);

    expect(
      shouldRunOfflineSync({
        ...ready,
        onboardingStep: "currency",
      }),
    ).toBe(false);

    expect(
      shouldRunOfflineSync({
        ...ready,
        onboardingStep: "accounts",
      }),
    ).toBe(false);
  });

  it("syncs after setup is complete and the user has left onboarding", () => {
    expect(shouldRunOfflineSync(ready)).toBe(true);
  });

  it("stays off on onboarding and admin routes", () => {
    expect(
      shouldRunOfflineSync({
        ...ready,
        isOnOnboardingPage: true,
      }),
    ).toBe(false);

    expect(
      shouldRunOfflineSync({
        ...ready,
        isOnAdminPage: true,
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
