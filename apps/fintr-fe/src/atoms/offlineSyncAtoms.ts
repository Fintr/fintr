import { atom } from "jotai";

import { readOfflineSyncReadyHint } from "@/lib/local-db/sync-state";

/** Synchronous bootstrap for returning users — avoids a loading flash before hydrate. */
export const getInitialOfflineSyncReady = (): boolean =>
  readOfflineSyncReadyHint();

/** True after offline bootstrap has completed for the current sync version. */
export const offlineSyncReadyAtom = atom(getInitialOfflineSyncReady());
