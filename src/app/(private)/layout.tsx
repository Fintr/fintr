"use client";

import React, { useEffect, useState } from "react";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import BottomNavigation from "@/components/dashboard/bottom-navigation";
import MobileStickyHeader from "@/components/dashboard/mobile-sticky-header";
import { useAtomValue } from 'jotai';
import { isAdminAtom } from '@/atoms/dashboardAtoms';
import { onboardingStepAtom, isOnboardingCompletedAtom } from '@/atoms/onboardingAtoms';
import { workspaceTransitionAtom } from '@/atoms/spaceAtoms';
import { useAuthApi } from '@/hooks/useAuthApi';
import { useGetSpaceCode } from '@/hooks/useGetSpaceCode';
import { usePathname } from 'next/navigation';
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import LoadingScreen from "@/components/ui/loading-screen";
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
        income: '/onboarding/step1',
        budgets: '/onboarding/step2',
        accounts: '/onboarding/step3',
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
              <div className="h-[44px] md:h-0" />
            </>
          )}
        </>
      )}
      <div className={
        isOnOnboardingPage || isStandalonePage 
          ? "min-h-screen" 
          : "p-0 md:p-8 md:pt-[88px] max-w-7xl mx-auto"
      }>
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
