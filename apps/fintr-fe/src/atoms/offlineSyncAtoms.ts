import { atom } from "jotai";

import { readOfflineSyncReadyHint } from "@/lib/local-db/sync-state";

/** Synchronous bootstrap for returning users — avoids a loading flash before hydrate. */
export const getInitialOfflineSyncReady = (): boolean =>
  readOfflineSyncReadyHint();

/**
 * When the ready hint is missing, assume import is required until IndexedDB is verified.
 */
export const getInitialOfflineReimportRequired = (): boolean => {
  if (typeof window === "undefined") {
    return true;
  }

  return !readOfflineSyncReadyHint();
};

/** True after offline bootstrap has completed for the current sync version. */
export const offlineSyncReadyAtom = atom(getInitialOfflineSyncReady());

/** True when IndexedDB must be repopulated before showing the dashboard. */
export const offlineReimportRequiredAtom = atom(getInitialOfflineReimportRequired());
