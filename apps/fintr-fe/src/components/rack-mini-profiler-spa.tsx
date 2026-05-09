"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    MiniProfiler?: {
      pageTransition?: () => void;
    };
  }
}

function shouldEnableRackMiniProfiler(): boolean {
  const explicit = process.env.NEXT_PUBLIC_RACK_MINI_PROFILER;
  if (explicit === "false") return false;
  if (explicit === "true") return true;
  return process.env.NODE_ENV === "development";
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
