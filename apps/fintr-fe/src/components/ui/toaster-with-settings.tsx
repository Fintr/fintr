"use client";

import { Toaster } from "@/components/ui/sonner";
import { type ToasterProps } from "sonner";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePlatformDetection } from "@/hooks/usePlatformDetection";
import { calculateToastTopOffset } from "@/lib/platform-detection";

/**
 * Renders the Sonner Toaster with position controlled by viewport and platform.
 * On mobile the toast appears at top-center below the status bar; on larger
 * screens it appears at the top-right.
 */
export function ToasterWithSettings() {
  const isMobile = useMediaQuery("(max-width: 768px)");

  const {
    isAndroidNative,
    isIOSNative,
    safeAreaInsetTop,
  } = usePlatformDetection();

  const offsetTop = calculateToastTopOffset(
    isAndroidNative,
    isIOSNative,
    safeAreaInsetTop,
    isMobile,
  );

  const position: ToasterProps["position"] = isMobile
    ? "top-center"
    : "top-right";

  return (
    <Toaster
      position={position}
      offset={{ top: offsetTop }}
      mobileOffset={{ top: offsetTop }}
      style={{
        pointerEvents: "none",
        ...(isMobile
          ? { top: `${offsetTop}px` }
          : { top: "16px", right: "16px" }),
      }}
    />
  );
}
