"use client";

import React from "react";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { calculateOnboardingScreenInsets } from "@/lib/platform-detection";

interface OnboardingScreenLayoutProps {
  children: React.ReactNode;
}

/**
 * Full-screen onboarding wrapper with native safe-area padding (Android status bar
 * and system navigation, iOS home indicator). Use for all setup / onboarding steps.
 */
export function OnboardingScreenLayout({ children }: OnboardingScreenLayoutProps) {
  const platform = usePlatformDetection();
  const { paddingTop, paddingBottom } = calculateOnboardingScreenInsets(platform);

  return (
    <div
      className="min-h-screen bg-background overflow-y-auto px-4"
      style={{
        paddingTop,
        paddingBottom,
      }}
    >
      <div className="mx-auto w-full max-w-2xl py-4">{children}</div>
    </div>
  );
}
