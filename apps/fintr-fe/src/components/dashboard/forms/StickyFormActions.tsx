"use client";

import { cn } from "@/lib/utils";
import { useKeyboardDetector } from "@/hooks/useKeyboardDetector";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";

type StickyFormActionsProps = {
  children: React.ReactNode;
  className?: string;
};

const ANDROID_ACTIONS_BASE_PADDING_PX = 12;

/** Scroll region above pinned form actions — includes bottom padding before the footer. */
export const pinnedFormScrollAreaClassName =
  "min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 pb-8";

/**
 * Pinned form action bar for create/update sheets and modals that pin
 * body layout. Stays visible while fields scroll above it.
 * Pads above Android 3-button / gesture nav and iOS home-indicator.
 * When the soft keyboard is open, Android nav inset is omitted — the keyboard
 * already sits above system nav, so stacking that padding leaves a gap.
 */
export const StickyFormActions = ({
  children,
  className,
}: StickyFormActionsProps) => {
  const {
    isAndroidNative,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav,
  } = usePlatformDetection();
  const { isOpen: isKeyboardOpen } = useKeyboardDetector();

  const androidBottomInset =
    isAndroidNative && !isKeyboardOpen
      ? Math.max(safeAreaInsetBottom, hasAndroid3ButtonNav ? 48 : 16)
      : 0;

  return (
    <div
      className={cn(
        "flex shrink-0 justify-between gap-2 border-t border-border bg-background px-6 pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_12px_rgba(0,0,0,0.35)]",
        !isAndroidNative &&
          "pb-[max(0.75rem,var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))]",
        className,
      )}
      style={
        isAndroidNative
          ? {
              paddingBottom:
                androidBottomInset + ANDROID_ACTIONS_BASE_PADDING_PX,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
};
