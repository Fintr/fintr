import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "./db";
import { putLocalResponseSnapshot } from "./response-cache";
import {
  getTransactionRelationIdsResyncVersion,
  markTransactionRelationIdsResyncComplete,
  shouldResyncTransactionRelationIds,
  TRANSACTION_RELATION_IDS_RESYNC_VERSION,
} from "./transaction-relation-resync";

describe("transaction relation ids resync", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("requires a resync before the migration has completed", async () => {
    await expect(shouldResyncTransactionRelationIds()).resolves.toBe(true);
    await expect(getTransactionRelationIdsResyncVersion()).resolves.toBe(0);
  });

  it("skips resync after the migration version is recorded", async () => {
    await markTransactionRelationIdsResyncComplete();

    await expect(shouldResyncTransactionRelationIds()).resolves.toBe(false);
    await expect(getTransactionRelationIdsResyncVersion()).resolves.toBe(
      TRANSACTION_RELATION_IDS_RESYNC_VERSION,
    );
  });

  it("requires resync when the stored version is stale", async () => {
    await putLocalResponseSnapshot("transactionRelationIdsResyncMeta", {
      version: TRANSACTION_RELATION_IDS_RESYNC_VERSION - 1,
      completedAt: Date.now(),
    });

    await expect(shouldResyncTransactionRelationIds()).resolves.toBe(true);
  });
});
