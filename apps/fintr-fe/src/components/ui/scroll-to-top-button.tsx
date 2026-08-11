"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { calculateToastBottomOffset } from "@/lib/platform-detection";
import { findScrollableAncestor } from "@/components/ui/calculator-keyboard-scroll";

const SCROLL_DURATION_MS = 300;
const SHOW_AFTER_PAGES = 1;

type ScrollMetrics = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
};

const getScrollMetrics = (container: HTMLElement | Window): ScrollMetrics => {
  if (container instanceof Window) {
    const doc = document.documentElement;

    return {
      scrollTop: window.scrollY || doc.scrollTop,
      clientHeight: window.innerHeight,
      scrollHeight: doc.scrollHeight,
    };
  }

  return {
    scrollTop: container.scrollTop,
    clientHeight: container.clientHeight,
    scrollHeight: container.scrollHeight,
  };
};

const animateScrollTo = (
  container: HTMLElement | Window,
  target: number,
  durationMs: number,
): void => {
  const { scrollTop: start } = getScrollMetrics(container);
  const delta = target - start;
  if (Math.abs(delta) < 1) return;

  const startTime = performance.now();
  const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

  const frame = (now: number) => {
    const progress = Math.min(1, (now - startTime) / durationMs);
    const next = start + delta * easeOutCubic(progress);

    if (container instanceof Window) {
      window.scrollTo(0, next);
    } else {
      container.scrollTop = next;
    }

    if (progress < 1) {
      requestAnimationFrame(frame);
    }
  };

  requestAnimationFrame(frame);
};

const resolveScrollContainer = (
  anchor: HTMLElement | null,
): HTMLElement | Window => {
  if (!anchor) return window;

  const ancestor = findScrollableAncestor(anchor);
  if (!ancestor) return window;

  const { scrollHeight, clientHeight } = ancestor;
  if (scrollHeight > clientHeight + 1) {
    return ancestor;
  }

  return window;
};

type ScrollToTopButtonProps = {
  /** Element inside the scrollable region (used to find the scroll container). */
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** Change when list content grows so visibility can re-evaluate. */
  contentKey?: string | number;
  className?: string;
};

export const ScrollToTopButton = ({
  anchorRef,
  contentKey,
  className,
}: ScrollToTopButtonProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const {
    isAndroidNative,
    isIOSNative,
    isNative,
    safeAreaInsetBottom,
    hasAndroid3ButtonNav,
  } = usePlatformDetection();

  const nativeBottomOffsetPx = isNative
    ? calculateToastBottomOffset(
        isAndroidNative,
        isIOSNative,
        safeAreaInsetBottom,
        hasAndroid3ButtonNav,
        { aboveBottomNav: true },
      )
    : null;

  const updateVisibility = useCallback(() => {
    const container = resolveScrollContainer(anchorRef?.current ?? null);
    const { scrollTop, clientHeight, scrollHeight } =
      getScrollMetrics(container);

    const pageHeight = Math.max(clientHeight, 1);
    const totalPages = scrollHeight / pageHeight;
    const scrolledPages = scrollTop / pageHeight;

    setIsVisible(
      totalPages > SHOW_AFTER_PAGES && scrolledPages >= SHOW_AFTER_PAGES,
    );
  }, [anchorRef]);

  useEffect(() => {
    updateVisibility();

    const container = resolveScrollContainer(anchorRef?.current ?? null);
    const scrollTarget: HTMLElement | Window =
      container instanceof Window ? window : container;

    scrollTarget.addEventListener("scroll", updateVisibility, {
      passive: true,
    });
    window.addEventListener("resize", updateVisibility, { passive: true });

    return () => {
      scrollTarget.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, [anchorRef, contentKey, updateVisibility]);

  const handleClick = () => {
    const container = resolveScrollContainer(anchorRef?.current ?? null);
    animateScrollTo(container, 0, SCROLL_DURATION_MS);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Scroll to top"
      tabIndex={isVisible ? 0 : -1}
      className={cn(
        "fixed right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full",
        "bottom-24 md:bottom-6",
        "border border-border/60 bg-card/95 text-foreground shadow-lg backdrop-blur-md",
        "transition-[opacity,transform] duration-200 ease-out",
        "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "dark:bg-card dark:hover:bg-accent/50",
        isVisible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
        className,
      )}
      style={
        nativeBottomOffsetPx != null
          ? { bottom: nativeBottomOffsetPx }
          : undefined
      }
    >
      <ChevronUp className="h-5 w-5" aria-hidden />
    </button>
  );
};
