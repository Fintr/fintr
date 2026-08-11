"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

export const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

type UseRevealProgressOptions = {
  durationMs?: number;
  amount?: number | "some" | "all";
};

const getScrollParent = (element: HTMLElement | null): HTMLElement | null => {
  if (!element) {
    return null;
  }

  let parent = element.parentElement;
  while (parent) {
    const { overflow, overflowY } = window.getComputedStyle(parent);
    if (
      overflowY === "auto"
      || overflowY === "scroll"
      || overflow === "auto"
      || overflow === "scroll"
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }

  return null;
};

const getVisibilityRootRect = (element: HTMLElement) => {
  const scrollParent = getScrollParent(element);
  if (scrollParent) {
    return scrollParent.getBoundingClientRect();
  }

  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;

  return {
    top: 0,
    left: 0,
    bottom: viewportHeight,
    right: viewportWidth,
  };
};

const isElementVisibleInRoot = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  const root = getVisibilityRootRect(element);

  return (
    rect.bottom > root.top
    && rect.top < root.bottom
    && rect.right > root.left
    && rect.left < root.right
  );
};

export const useRevealProgress = ({
  durationMs = 1200,
  amount = 0,
}: UseRevealProgressOptions = {}) => {
  const ref = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const isInView = useInView(ref, {
    once: true,
    amount,
    root: scrollRootRef,
  });
  const shouldReduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(shouldReduceMotion ? 1 : 0);
  const [forceReveal, setForceReveal] = useState(false);
  const progressRef = useRef(progress);
  const shouldAnimate = isInView || forceReveal;

  useLayoutEffect(() => {
    scrollRootRef.current = getScrollParent(ref.current);
  });

  useEffect(() => {
    if (shouldReduceMotion || shouldAnimate) {
      return;
    }

    const revealIfVisible = () => {
      const element = ref.current;
      if (!element || progressRef.current > 0) {
        return;
      }

      if (isElementVisibleInRoot(element)) {
        setForceReveal(true);
      }
    };

    revealIfVisible();

    const scrollParent = getScrollParent(ref.current);
    scrollParent?.addEventListener("scroll", revealIfVisible, { passive: true });
    window.addEventListener("scroll", revealIfVisible, { passive: true });
    window.addEventListener("resize", revealIfVisible, { passive: true });

    const retryDelays = [0, 100, 400, 1000];
    const timeoutIds = retryDelays.map((delay) =>
      window.setTimeout(revealIfVisible, delay),
    );

    return () => {
      scrollParent?.removeEventListener("scroll", revealIfVisible);
      window.removeEventListener("scroll", revealIfVisible);
      window.removeEventListener("resize", revealIfVisible);
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, [shouldAnimate, shouldReduceMotion]);

  useEffect(() => {
    if (shouldReduceMotion) {
      progressRef.current = 1;
      setProgress(1);
      return;
    }

    if (!shouldAnimate) {
      return;
    }

    let cancelled = false;
    const from = progressRef.current;
    const start = performance.now();

    const frame = (now: number) => {
      if (cancelled) {
        return;
      }

      const elapsed = Math.min((now - start) / durationMs, 1);
      const next = from + (1 - from) * easeOutCubic(elapsed);

      progressRef.current = next;
      setProgress(next);

      if (elapsed < 1) {
        requestAnimationFrame(frame);
        return;
      }

      progressRef.current = 1;
      setProgress(1);
    };

    requestAnimationFrame(frame);

    return () => {
      cancelled = true;
    };
  }, [durationMs, shouldAnimate, shouldReduceMotion]);

  return {
    ref,
    progress,
    isInView: shouldAnimate,
    shouldReduceMotion,
  };
};
