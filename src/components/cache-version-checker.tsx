"use client";

import { useEffect, useRef } from "react";
import { waitForCapacitor } from "@/lib/capacitor";
import { getPublicCacheVersion } from "@/services/admin/cache";
import { CacheControl } from "@/plugins/cache-control";

const CACHE_VERSION_KEY = "fintr_cache_version";

/**
 * When running inside the Capacitor app (iOS/Android), checks the backend
 * cache version. If it changed (e.g. admin clicked "Clear cache"), clears
 * the WebView cache and reloads so the app shows fresh content.
 */
export default function CacheVersionChecker() {
  const checked = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || checked.current) return;

    const run = async () => {
      const isCapacitor = await waitForCapacitor();
      if (!isCapacitor) return;

      checked.current = true;

      try {
        const { cacheVersion } = await getPublicCacheVersion();
        const stored = localStorage.getItem(CACHE_VERSION_KEY);

        if (stored !== cacheVersion) {
          localStorage.setItem(CACHE_VERSION_KEY, cacheVersion);
          // Only clear and reload when version actually changed (not first launch)
          if (stored != null) {
            await CacheControl.clearCacheAndReload();
          }
        }
      } catch {
        // Ignore errors (e.g. network) so app still works offline
      }
    };

    run();
  }, []);

  return null;
}
