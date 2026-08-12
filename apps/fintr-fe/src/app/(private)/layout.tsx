"use client";

import React, { useEffect } from "react";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import BottomNavigation from "@/components/dashboard/bottom-navigation";
import MobileStickyHeader from "@/components/dashboard/mobile-sticky-header";
import { useAtomValue } from 'jotai';
import { isAdminAtom } from '@/atoms/dashboardAtoms';
import { workspaceTransitionAtom } from '@/atoms/spaceAtoms';
import { useAuthApi } from '@/hooks/useAuthApi';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useGetSpaceCode } from '@/hooks/useGetSpaceCode';
import { usePathname } from 'next/navigation';
import { useRouter } from "next/navigation";
import TutorialOverlay from "@/components/tutorial/TutorialOverlay";
import LoadingScreen from "@/components/ui/loading-screen";
import { WorkspaceSetupGate } from "@/components/onboarding/workspace-setup-gate";
import { CapacitorLoadingTimeout } from "@/components/capacitor-loading-timeout";
import { useBootstrapLoadingTimeout } from "@/hooks/useBootstrapLoadingTimeout";
import { BOOTSTRAP_LOADING_MAX_MS } from "@/lib/bootstrap-loading";
import { WorkspaceTransitionScreen } from "@/components/space/workspace-transition-screen";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import {
  calculateBottomPadding,
  calculateHeaderSpacerHeight,
} from "@/lib/platform-detection";
import { isDashboardShellRoute } from "@/lib/dashboard-shell-route";
import { WeeklyFeedbackPrompt } from "@/components/feedback/weekly-feedback-prompt";
import { MaintenanceScreen } from "@/components/maintenance/maintenance-screen";
import { isMaintenanceModeEnabled } from "@/lib/maintenance-mode";
import { OfflineSyncScreen } from "@/components/offline/offline-sync-screen";
import { useHydrateOfflineSyncReady } from "@/hooks/useHydrateOfflineSyncReady";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useOutboxDrain } from "@/hooks/useOutboxDrain";

const PrivateLayout = ({ children }: { children: React.ReactNode }) => {
  const {
    api,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  const isAdmin = useAtomValue(isAdminAtom);
  const pathname = usePathname();
  const router = useRouter();
  const {
    spaceCode,
    onboardingStep,
    isUserContextLoading,
    refetchUserContext,
  } = useGetSpaceCode(api, isAuthenticated && !isAuthLoading);

  // Get workspace transition state from shared atom
  const transitionState = useAtomValue(workspaceTransitionAtom);

  // Determine if action buttons should be hidden (e.g., on admin page)
  const hideActionButtons = pathname.startsWith("/admin");

  // Hide navigation completely during onboarding
  const isOnOnboardingPage = pathname.startsWith('/onboarding');
  const isOnAdminPage = pathname.startsWith('/admin');

  const isOnboardingIncomplete =
    onboardingStep !== null && onboardingStep !== 'completed';
  const isResolvingWorkspaceContext =
    isAuthenticated &&
    !isAuthLoading &&
    isUserContextLoading;
  const maintenanceModeEnabled = isMaintenanceModeEnabled();
  const shouldShowMaintenanceScreen =
    maintenanceModeEnabled &&
    isAuthenticated &&
    !isAuthLoading &&
    !isResolvingWorkspaceContext &&
    isAdmin === false;
  const { shouldBlock: shouldBlockOnContextLoading } = useBootstrapLoadingTimeout(
    isResolvingWorkspaceContext,
  );
  const shouldShowWorkspaceSetupGate =
    !isOnOnboardingPage &&
    !isOnAdminPage &&
    isOnboardingIncomplete;

  // Hide navigation for standalone subscription create page
  const isStandalonePage = pathname.startsWith('/dashboard/subscriptions/create');

  // Dashboard shell layout already applies mobile bottom padding + BottomNavigation
  const isDashboardPage = isDashboardShellRoute(pathname);
  const weeklyFeedbackEnabled =
    Boolean(spaceCode) &&
    !isOnOnboardingPage &&
    !isStandalonePage &&
    !transitionState.isTransitioning &&
    !pathname.startsWith("/admin");
  const isMobile = useMediaQuery("(max-width: 768px)");

  useHydrateOfflineSyncReady();

  const {
    status: offlineSyncStatus,
    progress: offlineSyncProgress,
    error: offlineSyncError,
    retry: retryOfflineSync,
    isBlocking: isOfflineSyncBlocking,
  } = useOfflineSync(
    isAuthenticated &&
    !isAuthLoading &&
    !isOnOnboardingPage &&
    !isOnAdminPage,
  );

  useOutboxDrain(
    isAuthenticated &&
    !isAuthLoading &&
    !isOnOnboardingPage &&
    !isOnAdminPage,
  );

  const {
    isAndroidNative,
    isIOSNative,
    safeAreaInsetBottom,
    safeAreaInsetTop,
    hasAndroid3ButtonNav,
  } = usePlatformDetection();

  const bottomPadding = calculateBottomPadding(
    isAndroidNative,
    isIOSNative,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav
  );

  const headerSpacerHeight = calculateHeaderSpacerHeight(
    isAndroidNative,
    isIOSNative,
    safeAreaInsetTop
  );

  // Route incomplete workspaces into onboarding (avoids dashboard + Joyride flash)
  useEffect(() => {
    if (isOnOnboardingPage || isOnAdminPage) {
      return;
    }

    if (!isOnboardingIncomplete) {
      return;
    }

    router.replace('/onboarding');
  }, [
    isOnOnboardingPage,
    isOnAdminPage,
    isOnboardingIncomplete,
    router,
  ]);

  if (
    !isOnOnboardingPage &&
    !isOnAdminPage &&
    shouldBlockOnContextLoading
  ) {
    return (
      <div className="min-h-screen bg-background text-primary">
        <LoadingScreen />
        <CapacitorLoadingTimeout
          isLoading={isResolvingWorkspaceContext}
          timeoutMs={BOOTSTRAP_LOADING_MAX_MS}
          onRetry={() => {
            void refetchUserContext();
          }}
        />
      </div>
    );
  }

  if (shouldShowMaintenanceScreen) {
    return (
      <div className="min-h-screen bg-background text-primary">
        <MaintenanceScreen />
      </div>
    );
  }

  if (shouldShowWorkspaceSetupGate) {
    return (
      <div className="min-h-screen bg-background text-primary">
        <WorkspaceSetupGate />
      </div>
    );
  }

  if (isOfflineSyncBlocking) {
    return (
      <div className="min-h-screen bg-background text-primary">
        <OfflineSyncScreen
          progress={offlineSyncProgress}
          error={offlineSyncStatus === "error" ? offlineSyncError : null}
          onRetry={retryOfflineSync}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-primary">
      {!isOnOnboardingPage && !isStandalonePage && !transitionState.isTransitioning && (
        <>
          <DashboardNavigation hideActionButtons={hideActionButtons} isAdmin={isAdmin} />
          {/* Mobile Sticky Header - Show only on CRM and Admin pages (not dashboard pages) */}
          {!isDashboardPage && (
            <>
              <MobileStickyHeader />
              {/* Spacer for fixed header on mobile */}
              <div
                className="mobile-header-spacer md:hidden"
                style={{ height: headerSpacerHeight }}
              />
            </>
          )}
        </>
      )}
      <div
        className={
          isOnOnboardingPage || isStandalonePage
            ? "min-h-screen"
            : "p-0 md:p-8 md:pt-[88px] max-w-7xl mx-auto"
        }
        style={
          isMobile &&
          !isOnOnboardingPage &&
          !isStandalonePage &&
          !transitionState.isTransitioning &&
          !isDashboardPage
            ? { paddingBottom: bottomPadding }
            : undefined
        }
      >
        {children}
      </div>
      {/* Bottom nav: dashboard shell renders its own; CRM/Admin use this instance */}
      {!isOnOnboardingPage &&
        !isStandalonePage &&
        !transitionState.isTransitioning &&
        !isDashboardPage && <BottomNavigation />}
      {/* Tutorial Overlay */}
      <TutorialOverlay />
      
      {/* Workspace Transition Screen */}
      <WorkspaceTransitionScreen
        isVisible={transitionState.isTransitioning}
        workspaceName={transitionState.destinationSpace?.name}
        isOrganization={transitionState.destinationSpace?.isOrganization}
      />
      {weeklyFeedbackEnabled ? (
        <WeeklyFeedbackPrompt api={api} enabled={weeklyFeedbackEnabled} />
      ) : null}
    </div>
  );
};

export default PrivateLayout;
