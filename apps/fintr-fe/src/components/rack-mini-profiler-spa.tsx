"use client";

import { shouldEnableRackMiniProfiler } from "@/lib/rack-mini-profiler-inline-bootstrap";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    MiniProfiler?: {
      pageTransition?: () => void;
    };
  }
}

/**
 * Route-change hook for rack-mini-profiler (script loads from root layout inline bootstrap).
 */
export default function RackMiniProfilerSpa() {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!shouldEnableRackMiniProfiler()) return;

    if (previousPathname.current === null) {
      previousPathname.current = pathname;
      return;
    }

    if (previousPathname.current === pathname) return;

    previousPathname.current = pathname;
    window.MiniProfiler?.pageTransition?.();
  }, [pathname]);

  return null;
}
