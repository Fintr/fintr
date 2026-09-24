"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { listDistinctOutboxSpaceIds, OUTBOX_SPACE_ID_USER } from "@/lib/local-db";
import { isSpaceSyncPullEnabled } from "@/lib/space-sync-feature-flag";
import { useAuthApi } from "@/hooks/useAuthApi";
import { drainAllOutboxes } from "@/services/local-sync/drain-outbox";
import { schedulePullForSpace } from "@/services/local-sync/sync-coordinator";

const isBrowserOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

/**
 * Drains the ordered outbox when the app is online / becomes online / returns
 * to the foreground. After a successful push, pulls peer changes so other
 * devices catch up without a full page reload.
 */
export const useOutboxDrain = (enabled: boolean = true): void => {
  const queryClient = useQueryClient();
  const { api, isAuthenticated } = useAuthApi({
    scope: "openid profile email read:current_user read:transactions read:users",
  });
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !api) {
      return;
    }

    const run = async () => {
      if (inFlightRef.current) {
        return;
      }
      if (!isBrowserOnline()) {
        return;
      }

      inFlightRef.current = true;
      try {
        const pendingSpaceIds = await listDistinctOutboxSpaceIds();
        const result = await drainAllOutboxes({ api });

        if (
          !isSpaceSyncPullEnabled() ||
          result.processed === 0 ||
          pendingSpaceIds.length === 0
        ) {
          return;
        }

        for (const spaceId of pendingSpaceIds) {
          if (spaceId === OUTBOX_SPACE_ID_USER) {
            continue;
          }
          await schedulePullForSpace(
            { api, queryClient, spaceCodes: [spaceId] },
            spaceId,
            "online",
          );
        }
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

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      void run();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [api, enabled, isAuthenticated, queryClient]);
};
