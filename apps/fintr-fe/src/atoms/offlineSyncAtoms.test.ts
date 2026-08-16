import { afterEach, describe, expect, it } from "vitest";

import { OFFLINE_SYNC_VERSION } from "@/lib/local-db/sync-state";

import { getInitialOfflineSyncReady } from "./offlineSyncAtoms";

const OFFLINE_SYNC_READY_HINT_KEY = "fintr:offlineSyncReadyVersion";

describe("getInitialOfflineSyncReady", () => {
  afterEach(() => {
    window.localStorage.removeItem(OFFLINE_SYNC_READY_HINT_KEY);
  });

  it("returns false when the offline sync hint is missing", () => {
    expect(getInitialOfflineSyncReady()).toBe(false);
  });

  it("returns false when the offline sync hint version is stale", () => {
    window.localStorage.setItem(
      OFFLINE_SYNC_READY_HINT_KEY,
      String(OFFLINE_SYNC_VERSION - 1),
    );

    expect(getInitialOfflineSyncReady()).toBe(false);
  });

  it("returns true when the offline sync hint matches the current version", () => {
    window.localStorage.setItem(
      OFFLINE_SYNC_READY_HINT_KEY,
      String(OFFLINE_SYNC_VERSION),
    );

    expect(getInitialOfflineSyncReady()).toBe(true);
  });
});
