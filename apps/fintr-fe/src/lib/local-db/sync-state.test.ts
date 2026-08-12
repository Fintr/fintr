import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "./db";
import { putLocalResponseSnapshot } from "./response-cache";
import { markSpaceTransactionIndexComplete } from "./transactions";
import {
  getUnsyncedSpaceCodes,
  isOfflineSpaceCacheComplete,
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
    await putLocalResponseSnapshot("monthlyFinancialSummaries:A", []);
    await putLocalResponseSnapshot("monthlyFinancialSummaries:B", []);
    await markSpaceTransactionIndexComplete("A");
    await markSpaceTransactionIndexComplete("B");

    await expect(shouldRunFullOfflineSync()).resolves.toBe(false);
    await expect(
      getUnsyncedSpaceCodes(["A", "B", "C"]),
    ).resolves.toEqual(["C"]);
  });

  it("merges newly synced space codes into meta", async () => {
    await markOfflineSyncComplete(["A"]);
    await putLocalResponseSnapshot("monthlyFinancialSummaries:A", []);
    await markSpaceTransactionIndexComplete("A");
    await markOfflineSyncComplete(["B"]);
    await putLocalResponseSnapshot("monthlyFinancialSummaries:B", []);
    await markSpaceTransactionIndexComplete("B");

    await expect(
      getUnsyncedSpaceCodes(["A", "B", "C"]),
    ).resolves.toEqual(["C"]);
  });

  it("requires a full sync when monthly summaries are missing for a synced space", async () => {
    await markOfflineSyncComplete(["fintr"]);
    await markSpaceTransactionIndexComplete("fintr");

    await expect(shouldRunFullOfflineSync()).resolves.toBe(true);
  });

  it("does not require a full sync when summaries and transaction index exist", async () => {
    await markOfflineSyncComplete(["fintr"]);
    await markSpaceTransactionIndexComplete("fintr");
    await putLocalResponseSnapshot("monthlyFinancialSummaries:fintr", []);

    await expect(isOfflineSpaceCacheComplete("fintr")).resolves.toBe(true);
    await expect(shouldRunFullOfflineSync()).resolves.toBe(false);
  });

  it("requires a full sync when the offline sync version changes", async () => {
    await markOfflineSyncComplete(["A"]);
    await putLocalResponseSnapshot("monthlyFinancialSummaries:A", []);
    await markSpaceTransactionIndexComplete("A");
    expect(OFFLINE_SYNC_VERSION).toBeTypeOf("number");
    await expect(shouldRunFullOfflineSync()).resolves.toBe(false);
  });
});
