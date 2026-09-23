"use client";

import { useEffect, useRef, useState } from "react";

const easeOutCubic = (progress: number): number =>
  1 - Math.pow(1 - progress, 3);

type UseCountUpOptions = {
  duration?: number;
  enabled?: boolean;
  /** When false, only the first count-up runs; later target changes snap to the value. */
  restartOnTargetChange?: boolean;
};

export function useCountUp(
  target: number,
  options: UseCountUpOptions = {},
): number {
  const {
    duration = 500,
    enabled = true,
    restartOnTargetChange = false,
  } = options;
  const [value, setValue] = useState(0);
  const valueRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      valueRef.current = target;
      hasAnimatedRef.current = true;
      return;
    }

    if (hasAnimatedRef.current && !restartOnTargetChange) {
      setValue(target);
      valueRef.current = target;
      return;
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    const from = valueRef.current;
    const to = target;

    if (from === to) {
      hasAnimatedRef.current = true;
      return;
    }

    // Start when the first frame paints. A blocked main thread would otherwise
    // burn the whole duration before any tick, and the number would jump.
    let startTime: number | null = null;

    const tick = (now: number) => {
      if (startTime === null) {
        startTime = now;
      }

      const progress =
        duration <= 0 ? 1 : Math.min((now - startTime) / duration, 1);
      const next = from + (to - from) * easeOutCubic(progress);

      setValue(next);
      valueRef.current = next;

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      setValue(to);
      valueRef.current = to;
      frameRef.current = null;
      hasAnimatedRef.current = true;
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [target, duration, enabled, restartOnTargetChange]);

  return value;
}
