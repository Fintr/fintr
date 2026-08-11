"use client";

import { useEffect, useRef } from "react";

import { useAuthApi } from "@/hooks/useAuthApi";
import { drainAllOutboxes } from "@/services/local-sync/drain-outbox";

/**
 * Drains the ordered outbox when the app is online / becomes online.
 */
export const useOutboxDrain = (enabled: boolean = true): void => {
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !api) {
      return;
    }

    const run = async () => {
      if (inFlightRef.current) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        return;
      }

      inFlightRef.current = true;
      try {
        await drainAllOutboxes({ api });
      } catch (error) {
        console.warn("[outbox] Drain failed", error);
      } finally {
        inFlightRef.current = false;
      }
    };

    void run();

    const onOnline = () => {
      void run();
    };

    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [api, enabled, isAuthenticated]);
};
