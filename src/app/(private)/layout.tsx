"use client";

import React, { useEffect } from "react";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import BottomNavigation from "@/components/dashboard/bottom-navigation";
import MobileStickyHeader from "@/components/dashboard/mobile-sticky-header";
import { useAtomValue } from 'jotai';
import { isAdminAtom } from '@/atoms/dashboardAtoms';
import { onboardingStepAtom, isOnboardingCompletedAtom } from '@/atoms/onboardingAtoms';
import { workspaceTransitionAtom } from '@/atoms/spaceAtoms';
import { useToastSettings } from '@/contexts/ToastSettingsContext';
import { useAuthApi } from '@/hooks/useAuthApi';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useGetSpaceCode } from '@/hooks/useGetSpaceCode';
import { usePathname } from 'next/navigation';
import { useRouter } from "next/navigation";
import TutorialOverlay from "@/components/tutorial/TutorialOverlay";
import { WorkspaceTransitionScreen } from "@/components/space/workspace-transition-screen";

const PrivateLayout = ({ children }: { children: React.ReactNode }) => {
  const { api, isLoading: isApiLoading } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  const isAdmin = useAtomValue(isAdminAtom);
  const onboardingStep = useAtomValue(onboardingStepAtom);
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom);
  const pathname = usePathname();
  const router = useRouter();
  
  // Get workspace transition state from shared atom
  const transitionState = useAtomValue(workspaceTransitionAtom);

  // Determine if action buttons should be hidden (e.g., on admin page)
  const hideActionButtons = pathname.startsWith("/admin");
  
  // Hide navigation completely during onboarding
  const isOnOnboardingPage = pathname.startsWith('/onboarding');
  
  // Hide navigation for standalone subscription create page
  const isStandalonePage = pathname.startsWith('/dashboard/subscriptions/create');
  
  // Show mobile sticky header in private layout only for non-dashboard pages (CRM, Admin)
  const isDashboardPage = pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/subscriptions/create');

  const { spaceCode } = useGetSpaceCode(api);
  const { setSettings: setToastSettings } = useToastSettings();
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [isAndroidNative, setIsAndroidNative] = React.useState(false);
  const [isIOSNative, setIsIOSNative] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent || "";
    const uaLower = ua.toLowerCase();

    // Detect Android native (including WebView)
    const isAndroid = /Android/i.test(ua);
    const isFintrNative = uaLower.includes("fintrnativeapp");
    const isWebView = /; wv\)/.test(ua);
    const hasAndroidClass = document.documentElement.classList.contains("fintr-native-android");

    // Detect iOS native (including WebView)
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const hasIOSClass = document.documentElement.classList.contains("fintr-native-ios");

    setIsAndroidNative(isAndroid && (isFintrNative || isWebView || hasAndroidClass));
    setIsIOSNative(isIOS && (isFintrNative || isWebView || hasIOSClass));
  }, []);

  // Control toast position: bottom-most on onboarding (mobile); above nav elsewhere on mobile
  useEffect(() => {
    const offsetBottom =
      isOnOnboardingPage && isMobile
        ? 24
        : isMobile
          ? 88
          : 24;
    setToastSettings({ offsetBottom });
  }, [isOnOnboardingPage, isMobile, setToastSettings]);

  // Check onboarding status and redirect if necessary
  useEffect(() => {
    
    // Skip onboarding redirect if user is on onboarding pages or admin pages
    if (pathname.startsWith('/onboarding') || pathname.startsWith('/admin')) {
      return;
    }

    // Check if user needs onboarding based on the step from API
    if (pathname === '/dashboard' && onboardingStep && onboardingStep !== 'completed') {
      // Determine which step to redirect to based on current onboarding step
      const stepRoutes = {
        currency: '/onboarding/step1',
        income: '/onboarding/step2',
        budgets: '/onboarding/step3',
        accounts: '/onboarding/step4',
      };
      
      const redirectRoute = stepRoutes[onboardingStep as keyof typeof stepRoutes];
      if (redirectRoute) {
        router.push(redirectRoute);
      }
    }
  }, [pathname, onboardingStep, router]);

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
                style={
                  isAndroidNative || isIOSNative
                    ? {
                        height:
                          "calc(44px + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",
                      }
                    : {
                        // For mobile browsers, use env() for safe area
                        height:
                          "calc(44px + env(safe-area-inset-top, 0px))",
                      }
                }
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
          !transitionState.isTransitioning
            ? {
                // Apply bottom padding for all mobile platforms
                // Android needs extra for 3-button nav (48px minimum)
                // iOS and mobile browsers need fixed 80px padding to clear bottom nav
                paddingBottom: isAndroidNative
                  ? `max(var(--safe-area-inset-bottom, 0px), 48px)`
                  : "80px",
              }
            : undefined
        }
      >
        {children}
      </div>
      {/* Bottom Navigation for Mobile - Show on CRM and Admin pages */}
      {!isOnOnboardingPage && !isStandalonePage && !transitionState.isTransitioning && (
        <BottomNavigation />
      )}
      {/* Tutorial Overlay */}
      <TutorialOverlay />
      
      {/* Workspace Transition Screen */}
      <WorkspaceTransitionScreen
        isVisible={transitionState.isTransitioning}
        workspaceName={transitionState.destinationSpace?.name}
        isOrganization={transitionState.destinationSpace?.isOrganization}
      />
    </div>
  );
};

export default PrivateLayout;
