import { getLocalDb } from "@/lib/local-db/db";
import type { LocalMetaKey } from "@/lib/local-db/types";

export type SpaceSyncCursor = {
  lastPulledSeq: number;
  lastPulledAt: number;
};

const syncCursorKey = (spaceId: string): LocalMetaKey =>
  `syncCursor:${spaceId}`;

const syncCursorHintKey = (spaceId: string): string =>
  `fintr:syncCursor:${spaceId}`;

/** Synchronous hint so hooks can skip network on first paint after a prior pull. */
export const readSyncCursorHint = (spaceId: string): boolean => {
  if (!spaceId || typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(syncCursorHintKey(spaceId)) === "1";
  } catch {
    return false;
  }
};

const writeSyncCursorHint = (spaceId: string): void => {
  if (!spaceId || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(syncCursorHintKey(spaceId), "1");
  } catch {
    // Ignore quota / private mode errors.
  }
};

export const getSyncCursor = async (
  spaceId: string,
): Promise<SpaceSyncCursor | undefined> => {
  if (!spaceId) {
    return undefined;
  }

  const row = await getLocalDb().meta.get(syncCursorKey(spaceId));
  if (!row?.value || typeof row.value !== "object") {
    return undefined;
  }

  const value = row.value as Partial<SpaceSyncCursor>;
  if (typeof value.lastPulledSeq !== "number") {
    return undefined;
  }

  return {
    lastPulledSeq: value.lastPulledSeq,
    lastPulledAt: typeof value.lastPulledAt === "number" ? value.lastPulledAt : 0,
  };
};

export const setSyncCursor = async (
  spaceId: string,
  cursor: SpaceSyncCursor,
): Promise<void> => {
  if (!spaceId) {
    return;
  }

  await getLocalDb().meta.put({
    key: syncCursorKey(spaceId),
    value: cursor,
  });

  writeSyncCursorHint(spaceId);
};

export const hasSyncCursor = async (spaceId: string): Promise<boolean> =>
  (await getSyncCursor(spaceId)) != null;

export const backfillSyncCursorHint = async (spaceId: string): Promise<void> => {
  if (!spaceId || readSyncCursorHint(spaceId)) {
    return;
  }

  if (await hasSyncCursor(spaceId)) {
    writeSyncCursorHint(spaceId);
  }
};
