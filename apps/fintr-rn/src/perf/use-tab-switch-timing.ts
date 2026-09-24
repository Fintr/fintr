import { useEffect } from "react";
import { usePathname } from "expo-router";

declare global {
  // eslint-disable-next-line no-var
  var __fintrTabPressAtMs: number | undefined;
}

export function useTabSwitchTiming(params: {
  tabLabel: string;
  matchPath: string;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== params.matchPath) return;

    const startAt = globalThis.__fintrTabPressAtMs;
    if (typeof startAt !== "number") {
      return;
    }

    const elapsedMs = Date.now() - startAt;
    // eslint-disable-next-line no-console
    console.log(`[rn-tab-switch] ${params.tabLabel}: ${elapsedMs}ms`);
  }, [pathname, params.matchPath, params.tabLabel]);
}

