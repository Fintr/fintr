"use client";

import { useEffect } from "react";

/**
 * In-app devtools (Console, Network, etc.) on the device — no USB or ADB.
 * Loads when:
 * - NEXT_PUBLIC_ERUDA=true (any build, e.g. production testing), or
 * - Development build running inside Capacitor (on device/emulator).
 * Does not load in browser dev so you can use normal DevTools.
 */
export default function ErudaDevTools() {
  useEffect(() => {
    const isCapacitor =
      typeof window !== "undefined" &&
      !!(window as unknown as { Capacitor?: unknown }).Capacitor;
    const erudaFlag = process.env.NEXT_PUBLIC_ERUDA === "true";
    const devOnDevice = process.env.NODE_ENV === "development" && isCapacitor;

    if (!erudaFlag && !devOnDevice) return;

    import("eruda").then((mod) => {
      mod.default.init();
    });
  }, []);

  return null;
}
