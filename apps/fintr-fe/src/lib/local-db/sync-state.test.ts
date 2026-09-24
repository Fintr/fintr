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
  readOfflineSyncReadyHint,
  resolveOfflineSyncBootstrapState,
  shouldRunFullOfflineSync,
} from "./sync-state";

describe("offline sync state — new spaces", () => {
  afterEach(async () => {
    window.localStorage.removeItem("fintr:offlineSyncReadyVersion");
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

  it("does not block on a full import after IndexedDB records a completed sync", async () => {
    await markOfflineSyncComplete(["fintr"]);
    await markSpaceTransactionIndexComplete("fintr");

    await expect(shouldRunFullOfflineSync()).resolves.toBe(false);
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

  it("requires reimport when localStorage hint exists but IndexedDB was cleared", async () => {
    window.localStorage.setItem(
      "fintr:offlineSyncReadyVersion",
      String(OFFLINE_SYNC_VERSION),
    );

    await expect(
      resolveOfflineSyncBootstrapState("fintr"),
    ).resolves.toEqual({
      needsFullSync: true,
      spaceCacheComplete: false,
      requiresReimport: true,
    });
    expect(readOfflineSyncReadyHint()).toBe(false);
  });

  it("clears a stale ready hint when the active space cache is incomplete", async () => {
    window.localStorage.setItem(
      "fintr:offlineSyncReadyVersion",
      String(OFFLINE_SYNC_VERSION),
    );
    await markOfflineSyncComplete(["fintr"]);

    await expect(
      resolveOfflineSyncBootstrapState("fintr"),
    ).resolves.toMatchObject({
      requiresReimport: true,
    });
    expect(readOfflineSyncReadyHint()).toBe(false);
  });

  it("does not require reimport when meta, summaries, and index exist", async () => {
    await markOfflineSyncComplete(["fintr"]);
    await putLocalResponseSnapshot("monthlyFinancialSummaries:fintr", []);
    await markSpaceTransactionIndexComplete("fintr");

    await expect(
      resolveOfflineSyncBootstrapState("fintr"),
    ).resolves.toEqual({
      needsFullSync: false,
      spaceCacheComplete: true,
      requiresReimport: false,
    });
  });

  it("accepts a completed index when summaries show activity but no rows were stored", async () => {
    await markOfflineSyncComplete(["fintr"]);
    await putLocalResponseSnapshot("monthlyFinancialSummaries:fintr", [
      {
        id: "1",
        year: 2026,
        month: 8,
        currency: "PHP",
        fxBased: false,
        calculatedAt: "2026-08-01T00:00:00.000Z",
        totalIncome: 1000,
        totalExpenses: 500,
        netSavings: 500,
        savingsPercentage: 50,
        monthStartDate: "2026-08-01",
        monthEndDate: "2026-08-31",
      },
    ]);
    await markSpaceTransactionIndexComplete("fintr");

    await expect(isOfflineSpaceCacheComplete("fintr")).resolves.toBe(true);
    await expect(
      resolveOfflineSyncBootstrapState("fintr"),
    ).resolves.toMatchObject({
      requiresReimport: false,
    });
  });
});
