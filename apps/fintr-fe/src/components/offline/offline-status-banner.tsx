"use client";

import { useEffect, useState } from "react";

import { usePathname } from "next/navigation";

import { useBrowserOnline } from "@/hooks/useOfflineReadMode";
import { isLoginFlowAuthPage } from "@/lib/auth-routes";

export const OFFLINE_STATUS_BANNER_VISIBLE_MS = 3000;

export const OFFLINE_STATUS_BANNER_MESSAGE_APP =
  "You're offline — you can keep using Fintr. Changes will sync when you reconnect.";

export const OFFLINE_STATUS_BANNER_MESSAGE_LOGIN =
  "You need to be online to log in.";

export function OfflineStatusBanner() {
  const pathname = usePathname() ?? "";
  const isOnline = useBrowserOnline();
  const [isVisible, setIsVisible] = useState(() => !isOnline);
  const message = isLoginFlowAuthPage(pathname)
    ? OFFLINE_STATUS_BANNER_MESSAGE_LOGIN
    : OFFLINE_STATUS_BANNER_MESSAGE_APP;

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
      {message}
    </div>
  );
}
