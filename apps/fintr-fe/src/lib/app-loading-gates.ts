/**
 * Full-screen Fintr logo is a cold-start splash only.
 * In-app navigation — including offline remounts — must keep the current shell.
 */

export function shouldShowAuthLoadingScreen(params: {
  appShellReady: boolean;
  isPublicRoute: boolean;
  isAuthContextLoading: boolean;
  isAuthenticated: boolean;
  hasStoredSession: boolean;
}): boolean {
  if (params.appShellReady) {
    return false;
  }

  if (params.isPublicRoute) {
    return false;
  }

  if (params.hasStoredSession || params.isAuthenticated) {
    return false;
  }

  return params.isAuthContextLoading || !params.isAuthenticated;
}

export function shouldShowPrivateContextLoadingScreen(params: {
  appShellReady: boolean;
  isOnOnboardingPage: boolean;
  isOnAdminPage: boolean;
  isResolvingWorkspaceContext: boolean;
  hasPersistedSpaceCode: boolean;
}): boolean {
  if (params.appShellReady) {
    return false;
  }

  if (params.isOnOnboardingPage || params.isOnAdminPage) {
    return false;
  }

  if (params.hasPersistedSpaceCode) {
    return false;
  }

  return params.isResolvingWorkspaceContext;
}

export function shouldShowDashboardShellLoadingScreen(_params?: {
  hasSpaceCode: boolean;
  isOnline: boolean;
  isWaitingForDashboardData: boolean;
}): boolean {
  return false;
}

export function shouldShowOfflineSyncScreen(params: {
  requiresOfflineReimport: boolean;
  offlineSyncStatus: "idle" | "checking" | "syncing" | "complete" | "error";
  canRunOfflineSync?: boolean;
}): boolean {
  if (params.canRunOfflineSync === false) {
    return false;
  }

  if (!params.requiresOfflineReimport) {
    return false;
  }

  return params.offlineSyncStatus !== "complete";
}

/**
 * Offline bootstrap must wait until setup has created accounts, categories,
 * and budgets. Running it earlier caches an empty workspace as the local snapshot.
 */
export function shouldRunOfflineSync(params: {
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  isOnOnboardingPage: boolean;
  isOnAdminPage: boolean;
  onboardingStep: string | null;
}): boolean {
  if (!params.isAuthenticated || params.isAuthLoading) {
    return false;
  }

  if (params.isOnOnboardingPage || params.isOnAdminPage) {
    return false;
  }

  return params.onboardingStep === "completed";
}

export function isWorkspaceContextBlocking(params: {
  queryEnabled: boolean;
  isUserContextResolved: boolean;
  hasPersistedSpaceCode: boolean;
  queriesBusy: boolean;
}): boolean {
  if (!params.queryEnabled) {
    return false;
  }

  if (params.hasPersistedSpaceCode || params.isUserContextResolved) {
    return false;
  }

  return params.queriesBusy;
}
