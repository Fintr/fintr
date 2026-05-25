"use client";

import { OnboardingScreenLayout } from "@/components/onboarding/onboarding-screen-layout";

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OnboardingScreenLayout>{children}</OnboardingScreenLayout>;
}
