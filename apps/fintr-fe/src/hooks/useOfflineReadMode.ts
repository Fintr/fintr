"use client";

import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

import { offlineSyncReadyAtom } from "@/atoms/offlineSyncAtoms";
import { hasSyncCursor, readSyncCursorHint } from "@/lib/local-db/sync-cursor";
import { isSpaceSyncPullEnabled } from "@/lib/space-sync-feature-flag";

type LocalCacheQueryState = {
  data: unknown;
  isPending: boolean;
  isFetching: boolean;
};

const readBrowserOnline = (): boolean =>
  typeof navigator === "undefined" ? true : navigator.onLine !== false;

/**
 * True when the browser reports online. Shared by offline-read gates so hooks
 * can pull peer changes while connected and stay on IndexedDB when online.
 */
export const useBrowserOnline = (): boolean => {
  const [isOnline, setIsOnline] = useState(readBrowserOnline);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return isOnline;
};

/**
 * Pure gate used by hooks: skip network only after offline-ready **and** offline.
 * When space sync pull is enabled and a cursor exists, skip network while online too.
 */
export const shouldSkipCachedNetworkFetch = (params: {
  offlineSyncReady: boolean;
  isOnline: boolean;
  hasSyncCursor?: boolean;
  spaceSyncPullEnabled?: boolean;
}): boolean => {
  const spaceSyncPullEnabled = params.spaceSyncPullEnabled ?? false;

  if (spaceSyncPullEnabled && params.offlineSyncReady) {
    return params.hasSyncCursor !== false;
  }

  if (!params.isOnline) {
    return true;
  }

  return false;
};

/**
 * Skip network fetch when offline sync has finished and either:
 * - space sync pull is active with a cursor (IDB is source of truth), or
 * - the device is offline.
 */
export const useSkipCachedNetworkFetch = (
  _localCacheQuery?: LocalCacheQueryState,
  spaceCode?: string,
): boolean => {
  const offlineSyncReady = useAtomValue(offlineSyncReadyAtom);
  const isOnline = useBrowserOnline();
  const spaceSyncPullEnabled = isSpaceSyncPullEnabled();
  const [cursorReady, setCursorReady] = useState<boolean | null>(() => {
    if (!spaceCode || !spaceSyncPullEnabled) {
      return null;
    }

    return readSyncCursorHint(spaceCode) ? true : null;
  });

  useEffect(() => {
    if (!spaceSyncPullEnabled || !spaceCode || !offlineSyncReady) {
      setCursorReady(null);
      return;
    }

    let cancelled = false;
    void hasSyncCursor(spaceCode).then((value) => {
      if (!cancelled) {
        setCursorReady(value);
      }
    });

    const handlePullComplete = (event: Event) => {
      const detail = (event as CustomEvent<{ spaceId?: string }>).detail;
      if (detail?.spaceId === spaceCode) {
        setCursorReady(true);
      }
    };

    window.addEventListener("fintr-sync-pull-complete", handlePullComplete);

    return () => {
      cancelled = true;
      window.removeEventListener("fintr-sync-pull-complete", handlePullComplete);
    };
  }, [offlineSyncReady, spaceCode, spaceSyncPullEnabled]);

  const hasSyncCursorState =
    cursorReady === false
      ? false
      : cursorReady === true || readSyncCursorHint(spaceCode ?? "")
        ? true
        : undefined;

  return shouldSkipCachedNetworkFetch({
    offlineSyncReady,
    isOnline,
    hasSyncCursor: hasSyncCursorState,
    spaceSyncPullEnabled,
  });
};

/**
 * @deprecated Use useSkipCachedNetworkFetch — inverted boolean for readability at call sites.
 */
export const useOfflineReadMode = (hasLocalSnapshot: boolean): boolean => {
  const skipNetwork = useSkipCachedNetworkFetch();
  return skipNetwork && hasLocalSnapshot;
};
