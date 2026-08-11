"use client";

import { useEffect, useState } from "react";

import { LoadingFintrLogo } from "@/components/brand/fintr-logo";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { calculateOnboardingScreenInsets } from "@/lib/platform-detection";
import {
  OFFLINE_SYNC_HEADLINE,
  OFFLINE_SYNC_SUBHEADLINE,
  pickOfflineSyncMessage,
} from "@/services/local-sync/offline-sync-messages";
import type { OfflineSyncProgress } from "@/services/local-sync/bootstrap-local-data";

type OfflineSyncScreenProps = {
  progress: OfflineSyncProgress;
  error?: Error | null;
  onRetry?: () => void;
};

const ROTATE_MS = 2800;

export function OfflineSyncScreen({
  progress,
  error = null,
  onRetry,
}: OfflineSyncScreenProps) {
  const platform = usePlatformDetection();
  const { paddingTop, paddingBottom } = calculateOnboardingScreenInsets(platform);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((current) => current + 1);
    }, ROTATE_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const rotatingMessage = pickOfflineSyncMessage(messageIndex);
  const workspaceLabel =
    progress.currentSpaceName ??
    (progress.totalSpaces > 0
      ? `Workspace ${progress.completedSpaces + 1} of ${progress.totalSpaces}`
      : "Your workspaces");

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center px-6 overflow-y-auto"
      style={{
        paddingTop,
        paddingBottom,
      }}
      data-testid="offline-sync-screen"
    >
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="flex justify-center">
          <LoadingFintrLogo size={96} />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {OFFLINE_SYNC_HEADLINE}
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {OFFLINE_SYNC_SUBHEADLINE}
          </p>
        </div>

        <div className="space-y-3 text-left">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{workspaceLabel}</span>
            <span>{Math.round(progress.overallProgress)}%</span>
          </div>
          <Progress value={progress.overallProgress} className="h-2.5" />
          <p className="text-sm text-foreground min-h-[1.25rem] transition-opacity duration-300">
            {error?.message ?? progress.detailMessage}
          </p>
          {!error && (
            <p
              key={messageIndex}
              className="text-sm text-primary/80 min-h-[1.25rem] animate-in fade-in duration-500"
            >
              {rotatingMessage}
            </p>
          )}
        </div>

        <div className="flex justify-center">
          {!error ? (
            <div
              className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin"
              aria-hidden
            />
          ) : null}
        </div>

        {error && onRetry ? (
          <Button type="button" onClick={onRetry} className="w-full">
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
