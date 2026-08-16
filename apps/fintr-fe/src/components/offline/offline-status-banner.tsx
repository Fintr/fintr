"use client";

import { useEffect, useState } from "react";

import { useBrowserOnline } from "@/hooks/useOfflineReadMode";

export const OFFLINE_STATUS_BANNER_VISIBLE_MS = 3000;

export function OfflineStatusBanner() {
  const isOnline = useBrowserOnline();
  const [isVisible, setIsVisible] = useState(() => !isOnline);

  useEffect(() => {
    if (isOnline) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    const timeoutId = window.setTimeout(() => {
      setIsVisible(false);
    }, OFFLINE_STATUS_BANNER_VISIBLE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isOnline]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 top-0 z-[100] bg-amber-500 px-3 py-2 text-center text-sm font-medium text-black"
      style={{
        paddingTop: "max(8px, env(safe-area-inset-top))",
      }}
    >
      You&apos;re offline — you can keep using Fintr. Changes will sync when you
      reconnect.
    </div>
  );
}
