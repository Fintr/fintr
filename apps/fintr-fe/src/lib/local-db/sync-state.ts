import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "./response-cache";
import { isSpaceTransactionIndexComplete } from "./transactions";

export const OFFLINE_SYNC_VERSION = 9;

const OFFLINE_SYNC_META_KEY = "offlineSyncMeta";
const OFFLINE_SYNC_READY_HINT_KEY = "fintr:offlineSyncReadyVersion";

export const readOfflineSyncReadyHint = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(OFFLINE_SYNC_READY_HINT_KEY)
      === String(OFFLINE_SYNC_VERSION)
    );
  } catch {
    return false;
  }
};

const writeOfflineSyncReadyHint = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      OFFLINE_SYNC_READY_HINT_KEY,
      String(OFFLINE_SYNC_VERSION),
    );
  } catch {
    // Ignore quota / private mode errors.
  }
};

export type OfflineSyncMeta = {
  version: number;
  completedAt: number;
  spaceCodes: string[];
};

export const getOfflineSyncMeta = async (): Promise<OfflineSyncMeta | undefined> =>
  getLocalResponseSnapshot<OfflineSyncMeta>(OFFLINE_SYNC_META_KEY);

export const markOfflineSyncComplete = async (
  spaceCodes: string[],
): Promise<void> => {
  const existing = await getOfflineSyncMeta();
  const merged = Array.from(
    new Set([...(existing?.spaceCodes ?? []), ...spaceCodes]),
  );

  await putLocalResponseSnapshot(OFFLINE_SYNC_META_KEY, {
    version: OFFLINE_SYNC_VERSION,
    completedAt: Date.now(),
    spaceCodes: merged,
  });

  writeOfflineSyncReadyHint();
};

/**
 * Space codes the user can access that have not been offline-synced yet
 * (e.g. newly granted workspace access).
 */
export const getUnsyncedSpaceCodes = async (
  spaceCodes: string[],
): Promise<string[]> => {
  const meta = await getOfflineSyncMeta();

  if (!meta || meta.version !== OFFLINE_SYNC_VERSION) {
    return [...spaceCodes];
  }

  const synced = new Set(meta.spaceCodes);
  return spaceCodes.filter((code) => code && !synced.has(code));
};

export const backfillOfflineSyncReadyHint = async (): Promise<void> => {
  if (readOfflineSyncReadyHint()) {
    return;
  }

  if (!(await shouldRunFullOfflineSync())) {
    writeOfflineSyncReadyHint();
  }
};

export const isOfflineSpaceCacheComplete = async (
  spaceCode: string,
): Promise<boolean> => {
  if (!spaceCode) {
    return false;
  }

  const summaries = await getLocalResponseSnapshot<unknown[]>(
    `monthlyFinancialSummaries:${spaceCode}`,
  );
  if (summaries === undefined) {
    return false;
  }

  if (!(await isSpaceTransactionIndexComplete(spaceCode))) {
    return false;
  }

  return true;
};

export const shouldRunFullOfflineSync = async (): Promise<boolean> => {
  const meta = await getOfflineSyncMeta();

  if (!meta || meta.version !== OFFLINE_SYNC_VERSION) {
    return true;
  }

  for (const spaceCode of meta.spaceCodes) {
    if (!(await isOfflineSpaceCacheComplete(spaceCode))) {
      return true;
    }
  }

  return false;
};
