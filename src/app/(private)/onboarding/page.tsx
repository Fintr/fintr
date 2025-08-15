"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthApi } from "@/hooks/useAuthApi";
import { useGetSpaceCode } from "@/hooks/useGetSpaceCode";

export default function OnboardingIndex() {
  const router = useRouter();
  const { api, isLoading: isApiLoading } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  
  const { onboardingStep } = useGetSpaceCode(api!);

  useEffect(() => {
    if (!isApiLoading && onboardingStep !== null) {
      // Check if user has completed onboarding
      if (onboardingStep === 'completed') {
        // If already completed, redirect to completed page
        router.push('/onboarding/completed');
      } else {
        // If not completed, redirect to appropriate step
        switch (onboardingStep) {
          case 'income':
            router.push('/onboarding/step1');
            break;
          case 'budgets':
            router.push('/onboarding/step2');
            break;
          case 'accounts':
            router.push('/onboarding/step3');
            break;
          default:
            // Default to step 1 if no step is set
            router.push('/onboarding/step1');
        }
      }
    }
  }, [onboardingStep, isApiLoading, router]);

  // Show loading state while checking user status
  if (isApiLoading || onboardingStep === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground">Loading your onboarding status...</p>
        </div>
      </div>
    );
  }

  // This should not be reached as useEffect handles redirects
  return null;
}
