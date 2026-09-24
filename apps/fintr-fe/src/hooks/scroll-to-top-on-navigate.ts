"use client";

import { useEffect, useRef, type RefObject } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { shouldResetScrollOnNavigate } from "@/lib/should-reset-scroll-on-navigate";

export type ScrollSnapshot = {
  windowY: number;
  containerY: number;
};

const scrollPositionCache = new Map<string, ScrollSnapshot>();
let pendingPopNavigation = false;
let popstateListenerAttached = false;

export const buildNavigationKey = (
  pathname: string,
  searchParams: URLSearchParams,
): string => `${pathname}?${searchParams.toString()}`;

export const readScrollSnapshot = (
  scrollContainer?: HTMLElement | null,
): ScrollSnapshot => ({
  windowY: window.scrollY,
  containerY: scrollContainer?.scrollTop ?? 0,
});

export const applyScrollSnapshot = (
  snapshot: ScrollSnapshot,
  scrollContainer?: HTMLElement | null,
): void => {
  window.scrollTo(0, snapshot.windowY);

  if (scrollContainer) {
    scrollContainer.scrollTop = snapshot.containerY;
  }
};

export const scrollContainersToTop = (
  ...containers: Array<HTMLElement | Window | null | undefined>
): void => {
  for (const container of containers) {
    if (!container) {
      continue;
    }

    if (container instanceof HTMLElement) {
      container.scrollTop = 0;
      continue;
    }

    window.scrollTo(0, 0);
  }
};

export const resetScrollNavigationState = (): void => {
  scrollPositionCache.clear();
  pendingPopNavigation = false;
};

const saveScrollForKey = (
  key: string,
  scrollContainer?: HTMLElement | null,
): void => {
  scrollPositionCache.set(key, readScrollSnapshot(scrollContainer));
};

const restoreScrollForKey = (
  key: string,
  scrollContainer?: HTMLElement | null,
): boolean => {
  const snapshot = scrollPositionCache.get(key);
  if (!snapshot) {
    return false;
  }

  applyScrollSnapshot(snapshot, scrollContainer);
  requestAnimationFrame(() => {
    applyScrollSnapshot(snapshot, scrollContainer);
  });

  return true;
};

const ensurePopstateListener = (): void => {
  if (typeof window === "undefined" || popstateListenerAttached) {
    return;
  }

  window.addEventListener("popstate", () => {
    pendingPopNavigation = true;
  });
  popstateListenerAttached = true;
};

export const useScrollToTopOnNavigate = (
  scrollContainerRef?: RefObject<HTMLElement | null>,
): void => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navigationKey = buildNavigationKey(pathname, searchParams);
  const isFirstRender = useRef(true);
  const previousPathnameRef = useRef(pathname);

  useEffect(() => {
    ensurePopstateListener();

    const container = scrollContainerRef?.current ?? null;
    const handleScroll = () => {
      saveScrollForKey(navigationKey, container);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    container?.addEventListener("scroll", handleScroll, { passive: true });

    if (!isFirstRender.current) {
      if (pendingPopNavigation) {
        pendingPopNavigation = false;

        if (!restoreScrollForKey(navigationKey, container)) {
          scrollContainersToTop(window, container);
        }
      } else if (
        shouldResetScrollOnNavigate(previousPathnameRef.current, pathname)
      ) {
        scrollContainersToTop(window, container);
      }
    }

    previousPathnameRef.current = pathname;
    isFirstRender.current = false;

    return () => {
      window.removeEventListener("scroll", handleScroll);
      container?.removeEventListener("scroll", handleScroll);
    };
  }, [navigationKey, scrollContainerRef, pathname]);
};
