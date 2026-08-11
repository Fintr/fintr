import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";

import { getOfflineSyncMeta } from "@/lib/local-db/sync-state";
import { setSyncCursor } from "@/lib/local-db/sync-cursor";
import { isSpaceSyncPullEnabled } from "@/lib/space-sync-feature-flag";
import { offlineBootstrapDateRange } from "@/lib/local-sync/offline-bootstrap-dates";

import { syncLocalDataFromBackend } from "./bootstrap-local-data";
import { bootstrapSpaceV2 } from "./bootstrap-v2";
import { drainAllOutboxes } from "./drain-outbox";
import { pullSpaceChanges } from "./pull-space-changes";

export type SyncPullReason =
  | "online"
  | "focus"
  | "cable_disconnect"
  | "periodic"
  | "launch";

export type SyncCoordinatorOptions = {
  api: AxiosInstance;
  queryClient: QueryClient;
  spaceCodes: string[];
};

const PULL_THROTTLE_MS = 30_000;
const PERIODIC_PULL_MS = 5 * 60_000;
const SYNC_BROADCAST_CHANNEL = "fintr-sync";

const lastPullAtBySpace = new Map<string, number>();
let periodicTimer: ReturnType<typeof setInterval> | null = null;

const isBrowserOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

export const broadcastPullComplete = (
  spaceId: string,
  lastPulledSeq: number,
): void => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("fintr-sync-pull-complete", {
        detail: { spaceId, lastPulledSeq },
      }),
    );
  }

  if (typeof BroadcastChannel === "undefined") {
    return;
  }

  const channel = new BroadcastChannel(SYNC_BROADCAST_CHANNEL);
  channel.postMessage({
    type: "pull_complete",
    spaceId,
    lastPulledSeq,
  });
  channel.close();
};

export const subscribeSyncBroadcast = (
  onPullComplete: (spaceId: string, lastPulledSeq: number) => void,
): (() => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleWindowEvent = (event: Event) => {
    const detail = (event as CustomEvent<{ spaceId?: string; lastPulledSeq?: number }>)
      .detail;
    if (detail?.spaceId && typeof detail.lastPulledSeq === "number") {
      onPullComplete(detail.spaceId, detail.lastPulledSeq);
    }
  };

  window.addEventListener("fintr-sync-pull-complete", handleWindowEvent);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(SYNC_BROADCAST_CHANNEL);
    channel.onmessage = (event) => {
      if (
        event.data?.type === "pull_complete" &&
        typeof event.data.spaceId === "string" &&
        typeof event.data.lastPulledSeq === "number"
      ) {
        onPullComplete(event.data.spaceId, event.data.lastPulledSeq);
      }
    };
  }

  return () => {
    window.removeEventListener("fintr-sync-pull-complete", handleWindowEvent);
    channel?.close();
  };
};

const bootstrapSpaceAfterStaleCursor = async (params: {
  api: AxiosInstance;
  queryClient: QueryClient;
  spaceId: string;
  oldestAvailableSeq: number;
}): Promise<void> => {
  const bootstrapRange = offlineBootstrapDateRange();

  if (isSpaceSyncPullEnabled()) {
    await bootstrapSpaceV2(params.api, params.queryClient, {
      spaceCode: params.spaceId,
      startDate: bootstrapRange.startDate,
      endDate: bootstrapRange.endDate,
    });
    return;
  }

  await syncLocalDataFromBackend(params.api, params.queryClient, {
    spaceCode: params.spaceId,
    startDate: bootstrapRange.startDate,
    endDate: bootstrapRange.endDate,
  });

  await setSyncCursor(params.spaceId, {
    lastPulledSeq: params.oldestAvailableSeq,
    lastPulledAt: Date.now(),
  });
};

export const pullSpaceWithBootstrapRecovery = async (params: {
  api: AxiosInstance;
  queryClient: QueryClient;
  spaceId: string;
}): Promise<void> => {
  if (!isSpaceSyncPullEnabled()) {
    return;
  }

  const result = await pullSpaceChanges({
    api: params.api,
    spaceId: params.spaceId,
    queryClient: params.queryClient,
  });

  if (result.status === "bootstrap_required") {
    await bootstrapSpaceAfterStaleCursor({
      api: params.api,
      queryClient: params.queryClient,
      spaceId: params.spaceId,
      oldestAvailableSeq: result.oldestAvailableSeq,
    });

    const retry = await pullSpaceChanges({
      api: params.api,
      spaceId: params.spaceId,
      queryClient: params.queryClient,
    });

    if (retry.status === "complete") {
      broadcastPullComplete(params.spaceId, retry.latestSeq);
    }
    return;
  }

  broadcastPullComplete(params.spaceId, result.latestSeq);
};

export const schedulePullForSpace = async (
  opts: SyncCoordinatorOptions,
  spaceId: string,
  reason: SyncPullReason,
): Promise<void> => {
  if (!isSpaceSyncPullEnabled()) {
    return;
  }

  if (!isBrowserOnline()) {
    return;
  }

  if (!spaceId) {
    return;
  }

  const throttleMs = reason === "cable_disconnect" ? 0 : PULL_THROTTLE_MS;
  const last = lastPullAtBySpace.get(spaceId) ?? 0;
  if (Date.now() - last < throttleMs) {
    return;
  }

  try {
    await drainAllOutboxes({ api: opts.api, spaceIds: [spaceId] });
    await pullSpaceWithBootstrapRecovery({
      api: opts.api,
      queryClient: opts.queryClient,
      spaceId,
    });
    lastPullAtBySpace.set(spaceId, Date.now());
  } catch (error) {
    console.warn("[sync] Pull failed for space", spaceId, error);
  }
};

export const schedulePullAllSpaces = async (
  opts: SyncCoordinatorOptions,
  reason: SyncPullReason,
): Promise<void> => {
  if (!isSpaceSyncPullEnabled()) {
    return;
  }

  for (const spaceId of opts.spaceCodes) {
    await schedulePullForSpace(opts, spaceId, reason);
  }
};

export const startPeriodicPull = (opts: SyncCoordinatorOptions): void => {
  if (!isSpaceSyncPullEnabled()) {
    return;
  }

  stopPeriodicPull();
  periodicTimer = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }
    void schedulePullAllSpaces(opts, "periodic");
  }, PERIODIC_PULL_MS);
};

export const stopPeriodicPull = (): void => {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
};

export const resolveAccessibleSpaceCodes = async (
  activeSpaceCode?: string,
): Promise<string[]> => {
  const meta = await getOfflineSyncMeta();
  if (meta?.spaceCodes?.length) {
    return meta.spaceCodes;
  }

  if (activeSpaceCode) {
    return [activeSpaceCode];
  }

  if (typeof localStorage === "undefined") {
    return [];
  }

  const stored = localStorage.getItem("spaceCode");
  return stored ? [stored] : [];
};

export const resetSyncCoordinatorForTests = (): void => {
  lastPullAtBySpace.clear();
  stopPeriodicPull();
};
