import {
  getLocalResponseSnapshot,
  putLocalResponseSnapshot,
} from "./response-cache";
import type { MonthlyFinancialSummary } from "@/services/monthly-financial-summaries/types";
import {
  countSpaceTransactions,
  isSpaceTransactionIndexComplete,
} from "./transactions";

export const OFFLINE_SYNC_VERSION = 12;

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

export const clearOfflineSyncReadyHint = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(OFFLINE_SYNC_READY_HINT_KEY);
  } catch {
    // Ignore quota / private mode errors.
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

export const backfillOfflineSyncReadyHint = async (
  spaceCode?: string,
): Promise<void> => {
  if (readOfflineSyncReadyHint()) {
    return;
  }

  if (await shouldRunFullOfflineSync()) {
    return;
  }

  if (spaceCode && !(await isOfflineSpaceCacheComplete(spaceCode))) {
    return;
  }

  writeOfflineSyncReadyHint();
};

export type OfflineSyncBootstrapState = {
  needsFullSync: boolean;
  spaceCacheComplete: boolean;
  requiresReimport: boolean;
};

/**
 * Decide whether the user must see the full offline import screen.
 * Clears a stale localStorage ready-hint when IndexedDB was wiped manually.
 */
export const resolveOfflineSyncBootstrapState = async (
  spaceCode?: string,
): Promise<OfflineSyncBootstrapState> => {
  const needsFullSync = await shouldRunFullOfflineSync();
  const spaceCacheComplete = spaceCode
    ? await isOfflineSpaceCacheComplete(spaceCode)
    : !needsFullSync;
  const requiresReimport = needsFullSync || !spaceCacheComplete;

  if (requiresReimport && readOfflineSyncReadyHint()) {
    clearOfflineSyncReadyHint();
  }

  return {
    needsFullSync,
    spaceCacheComplete,
    requiresReimport,
  };
};

export const isOfflineSpaceCacheComplete = async (
  spaceCode: string,
): Promise<boolean> => {
  if (!spaceCode) {
    return false;
  }

  const summaries = await getLocalResponseSnapshot<MonthlyFinancialSummary[]>(
    `monthlyFinancialSummaries:${spaceCode}`,
  );
  if (summaries === undefined) {
    return false;
  }

  if (!(await isSpaceTransactionIndexComplete(spaceCode))) {
    return false;
  }

  const transactionCount = await countSpaceTransactions(spaceCode);
  if (transactionCount > 0) {
    return true;
  }

  const hasFinancialActivity = summaries.some((row) => {
    const income = Number(row.totalIncome) || 0;
    const expenses = Number(row.totalExpenses) || 0;

    return income !== 0 || expenses !== 0;
  });

  if (!hasFinancialActivity) {
    return true;
  }

  // Summaries imply activity but the transaction index is empty (partial wipe).
  return false;
};

export const shouldRunFullOfflineSync = async (): Promise<boolean> => {
  const meta = await getOfflineSyncMeta();

  if (!meta || meta.version !== OFFLINE_SYNC_VERSION) {
    return true;
  }

  return meta.spaceCodes.length === 0;
};
