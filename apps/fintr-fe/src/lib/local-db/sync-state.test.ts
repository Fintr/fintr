import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "./db";
import {
  getUnsyncedSpaceCodes,
  markOfflineSyncComplete,
  OFFLINE_SYNC_VERSION,
  shouldRunFullOfflineSync,
} from "./sync-state";

describe("offline sync state — new spaces", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("treats all spaces as unsynced before the first sync", async () => {
    await expect(
      getUnsyncedSpaceCodes(["A", "B"]),
    ).resolves.toEqual(["A", "B"]);
    await expect(shouldRunFullOfflineSync()).resolves.toBe(true);
  });

  it("returns only newly granted space codes after a completed sync", async () => {
    await markOfflineSyncComplete(["A", "B"]);

    await expect(shouldRunFullOfflineSync()).resolves.toBe(false);
    await expect(
      getUnsyncedSpaceCodes(["A", "B", "C"]),
    ).resolves.toEqual(["C"]);
  });

  it("merges newly synced space codes into meta", async () => {
    await markOfflineSyncComplete(["A"]);
    await markOfflineSyncComplete(["B"]);

    await expect(
      getUnsyncedSpaceCodes(["A", "B", "C"]),
    ).resolves.toEqual(["C"]);
  });

  it("requires a full sync when the offline sync version changes", async () => {
    await markOfflineSyncComplete(["A"]);
    expect(OFFLINE_SYNC_VERSION).toBeTypeOf("number");
    await expect(shouldRunFullOfflineSync()).resolves.toBe(false);
  });
});
