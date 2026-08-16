import { describe, expect, it } from "vitest";

import {
  isWorkspaceContextBlocking,
  shouldShowAuthLoadingScreen,
  shouldShowDashboardShellLoadingScreen,
  shouldShowOfflineSyncScreen,
  shouldShowPrivateContextLoadingScreen,
} from "./app-loading-gates";

describe("shouldShowAuthLoadingScreen", () => {
  it("never covers an in-app remount when a stored session already exists", () => {
    expect(
      shouldShowAuthLoadingScreen({
        isPublicRoute: false,
        isAuthContextLoading: true,
        isAuthenticated: false,
        hasStoredSession: true,
      }),
    ).toBe(false);
  });

  it("never covers a route that is already authenticated in context", () => {
    expect(
      shouldShowAuthLoadingScreen({
        isPublicRoute: false,
        isAuthContextLoading: true,
        isAuthenticated: true,
        hasStoredSession: false,
      }),
    ).toBe(false);
  });

  it("does not splash public pages", () => {
    expect(
      shouldShowAuthLoadingScreen({
        isPublicRoute: true,
        isAuthContextLoading: true,
        isAuthenticated: false,
        hasStoredSession: false,
      }),
    ).toBe(false);
  });

  it("splashes only a true cold start with no session", () => {
    expect(
      shouldShowAuthLoadingScreen({
        isPublicRoute: false,
        isAuthContextLoading: true,
        isAuthenticated: false,
        hasStoredSession: false,
      }),
    ).toBe(true);
  });
});

describe("shouldShowPrivateContextLoadingScreen", () => {
  it("keeps the private shell when a space code is already persisted", () => {
    expect(
      shouldShowPrivateContextLoadingScreen({
        isOnOnboardingPage: false,
        isOnAdminPage: false,
        isResolvingWorkspaceContext: true,
        hasPersistedSpaceCode: true,
      }),
    ).toBe(false);
  });

  it("splashes first-time workspace resolution with no persisted space", () => {
    expect(
      shouldShowPrivateContextLoadingScreen({
        isOnOnboardingPage: false,
        isOnAdminPage: false,
        isResolvingWorkspaceContext: true,
        hasPersistedSpaceCode: false,
      }),
    ).toBe(true);
  });
});

describe("shouldShowDashboardShellLoadingScreen", () => {
  it("never replaces the dashboard chrome with a full-screen splash", () => {
    expect(
      shouldShowDashboardShellLoadingScreen({
        hasSpaceCode: false,
        isOnline: true,
        isWaitingForDashboardData: true,
      }),
    ).toBe(false);

    expect(
      shouldShowDashboardShellLoadingScreen({
        hasSpaceCode: true,
        isOnline: false,
        isWaitingForDashboardData: true,
      }),
    ).toBe(false);
  });
});

describe("shouldShowOfflineSyncScreen", () => {
  it("never blocks after the app shell has rendered this session", () => {
    sessionStorage.setItem("fintr:appShellReady", "1");

    expect(
      shouldShowOfflineSyncScreen({
        isOfflineSyncBlocking: true,
        hasOfflineSyncReadyHint: false,
      }),
    ).toBe(false);

    sessionStorage.removeItem("fintr:appShellReady");
  });

  it("never blocks in-app navigation after offline sync has completed once", () => {
    expect(
      shouldShowOfflineSyncScreen({
        isOfflineSyncBlocking: true,
        hasOfflineSyncReadyHint: true,
      }),
    ).toBe(false);
  });

  it("blocks only the first-time offline bootstrap", () => {
    expect(
      shouldShowOfflineSyncScreen({
        isOfflineSyncBlocking: true,
        hasOfflineSyncReadyHint: false,
      }),
    ).toBe(true);

    expect(
      shouldShowOfflineSyncScreen({
        isOfflineSyncBlocking: false,
        hasOfflineSyncReadyHint: false,
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

  it("blocks only when there is no space yet and queries are still running", () => {
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
