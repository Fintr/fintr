"use client";

import { useEffect, useState } from "react";
import { useToastSettings } from "@/contexts/ToastSettingsContext";
import { Toaster } from "@/components/ui/sonner";
import { type ToasterProps } from "sonner";

function useIsSmallScreen(breakpoint = 640) {
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsSmall(mql.matches);

    const handler = (e: MediaQueryListEvent) => setIsSmall(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);

  return isSmall;
}

/**
 * Renders the Sonner Toaster with position controlled by ToastSettingsContext.
 * On small screens the toast appears at the top-center; on larger screens it
 * appears at the top-right.
 */
export function ToasterWithSettings() {
  const { settings } = useToastSettings();
  const isSmall = useIsSmallScreen();

  const position: ToasterProps["position"] = isSmall ? "top-center" : "top-right";

  return (
    <Toaster
      position={position}
      style={{
        bottom: `${settings.offsetBottom}px`,
        pointerEvents: "none",
      }}
    />
  );
}
