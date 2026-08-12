"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { backfillSyncCursorHint } from "@/lib/local-db/sync-cursor";
import {
  backfillOfflineSyncReadyHint,
  shouldRunFullOfflineSync,
} from "@/lib/local-db/sync-state";
import { isSpaceSyncPullEnabled } from "@/lib/space-sync-feature-flag";

const getPersistedSpaceCode = (): string => {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    return window.localStorage.getItem("spaceCode")?.trim() ?? "";
  } catch {
    return "";
  }
};

/** Hydrate offline-read mode from IndexedDB before hooks mount. */
export const useHydrateOfflineSyncReady = () => {
  const setOfflineSyncReady = useSetAtom(offlineSyncReadyAtom);

  useEffect(() => {
    void (async () => {
      const needsFullSync = await shouldRunFullOfflineSync();
      setOfflineSyncReady(!needsFullSync);

      if (!needsFullSync) {
        await backfillOfflineSyncReadyHint();

        if (isSpaceSyncPullEnabled()) {
          const spaceCode = getPersistedSpaceCode();
          if (spaceCode) {
            await backfillSyncCursorHint(spaceCode);
          }
        }
      }
    })();
  }, [setOfflineSyncReady]);
};
