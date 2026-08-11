import { atom } from "jotai";

/** True after offline bootstrap has completed for the current sync version. */
export const offlineSyncReadyAtom = atom(false);
