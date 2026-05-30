"use client";

import { LoadingFintrLogo } from "@/components/brand/fintr-logo";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { calculateOnboardingScreenInsets } from "@/lib/platform-detection";

interface WorkspaceSetupGateProps {
  message?: string;
  subtitle?: string;
}

/**
 * Full-screen placeholder shown while we resolve onboarding status or route
 * new users into setup. Prevents a flash of the dashboard + Joyride overlay.
 */
export function WorkspaceSetupGate({
  message = "Let's set up your workspace",
  subtitle = "We'll walk you through a quick setup so Fintr is ready for you.",
}: WorkspaceSetupGateProps) {
  const platform = usePlatformDetection();
  const { paddingTop, paddingBottom } = calculateOnboardingScreenInsets(platform);

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-6 overflow-y-auto"
      style={{
        paddingTop,
        paddingBottom,
      }}
      data-testid="workspace-setup-gate"
    >
      <div className="text-center space-y-6 max-w-sm">
        <div className="flex justify-center">
          <LoadingFintrLogo size={96} />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">{message}</h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div
          className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"
          aria-hidden
        />
      </div>
    </div>
  );
}
