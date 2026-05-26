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
      if (onboardingStep === "completed") {
        router.replace("/dashboard");
      } else {
        // Map API step to route; unknown or missing step always starts at step1
        const stepRoutes: Record<string, string> = {
          currency: "/onboarding/step1",
          income: "/onboarding/step2",
          budgets: "/onboarding/step3",
          accounts: "/onboarding/step4",
          import: "/onboarding/step5",
        };
        const route = stepRoutes[onboardingStep] ?? "/onboarding/step1";
        router.push(route);
      }
    }
  }, [onboardingStep, isApiLoading, router]);

  // Show loading state while checking user status
  if (isApiLoading || onboardingStep === null) {
    return (
      <div
        className="flex min-h-[50vh] flex-col items-center justify-center text-center space-y-4"
        data-testid="onboarding-setup-loading"
      >
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-muted-foreground">Preparing your workspace setup...</p>
      </div>
    );
  }

  // This should not be reached as useEffect handles redirects
  return null;
}
