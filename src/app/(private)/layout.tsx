"use client";

import React, { useEffect, useState } from "react";
import DashboardNavigation from "@/components/dashboard/dashboard-navigation";
import { useAtomValue } from 'jotai';
import { isAdminAtom } from '@/atoms/dashboardAtoms';
import { onboardingStepAtom, isOnboardingCompletedAtom } from '@/atoms/onboardingAtoms';
import { useAuthApi } from '@/hooks/useAuthApi';
import { useGetSpaceCode } from '@/hooks/useGetSpaceCode';
import { usePathname } from 'next/navigation';
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import LoadingScreen from "@/components/ui/loading-screen";

const PrivateLayout = ({ children }: { children: React.ReactNode }) => {
  const { api, isLoading: isApiLoading } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  const isAdmin = useAtomValue(isAdminAtom);
  const onboardingStep = useAtomValue(onboardingStepAtom);
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom);
  const pathname = usePathname();
  const router = useRouter();

  // Determine if action buttons should be hidden (e.g., on admin page)
  const hideActionButtons = pathname.startsWith("/admin");
  
  // Hide navigation completely during onboarding
  const isOnOnboardingPage = pathname.startsWith('/onboarding');

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
      {!isOnOnboardingPage && (
        <DashboardNavigation hideActionButtons={hideActionButtons} isAdmin={isAdmin} />
      )}
      <div className={isOnOnboardingPage ? "min-h-screen" : "pt-[76px] p-0 md:p-8 md:pt-[108px]  max-w-7xl mx-auto"}>
        {children}
      </div>
    </div>
  );
};

export default PrivateLayout;
