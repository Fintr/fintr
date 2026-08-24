"use client";

import { useLayoutEffect } from "react";
import { useSetAtom } from "jotai";

import {
  offlineReimportRequiredAtom,
  offlineSyncReadyAtom,
} from "@/atoms/offlineSyncAtoms";
import { backfillSyncCursorHint } from "@/lib/local-db/sync-cursor";
import {
  backfillOfflineSyncReadyHint,
  resolveOfflineSyncBootstrapState,
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
  const setOfflineReimportRequired = useSetAtom(offlineReimportRequiredAtom);

  useLayoutEffect(() => {
    void (async () => {
      const spaceCode = getPersistedSpaceCode();
      const bootstrapState = await resolveOfflineSyncBootstrapState(
        spaceCode || undefined,
      );

      setOfflineReimportRequired(bootstrapState.requiresReimport);

      if (bootstrapState.requiresReimport) {
        setOfflineSyncReady(false);
        return;
      }

      setOfflineSyncReady(true);
      await backfillOfflineSyncReadyHint(spaceCode || undefined);

      if (isSpaceSyncPullEnabled() && spaceCode) {
        await backfillSyncCursorHint(spaceCode);
      }
    })();
  }, [setOfflineReimportRequired, setOfflineSyncReady]);
};
