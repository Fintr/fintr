"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { resolveAppearanceFromDom } from "@/lib/resolve-appearance";
import { syncNativeAppearance } from "@/lib/native-appearance";
import type { AppAppearance } from "@/lib/theme-colors";
import { isLightThemePath } from "@/lib/theme-routes";

/**
 * Keeps native status/navigation bars and theme-color meta in sync with next-themes.
 */
export function NativeThemeSync() {
  const pathname = usePathname();
  const { resolvedTheme, theme } = useTheme();

  const pushToNative = (appearance?: AppAppearance) => {
    const next =
      appearance ??
      (isLightThemePath(pathname)
        ? "light"
        : resolvedTheme === "light" || resolvedTheme === "dark"
          ? resolvedTheme
          : resolveAppearanceFromDom(pathname));
    void syncNativeAppearance(next);
  };

  useEffect(() => {
    pushToNative();
  }, [pathname, resolvedTheme, theme]);

  useEffect(() => {
    const root = document.documentElement;
    let frame = 0;

    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        pushToNative(resolveAppearanceFromDom(pathname));
      });
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [pathname, resolvedTheme, theme]);

  return null;
}
