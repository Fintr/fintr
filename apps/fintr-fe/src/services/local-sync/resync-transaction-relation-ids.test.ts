import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db/db";
import {
  isSpaceTransactionIndexComplete,
  markSpaceTransactionIndexComplete,
} from "@/lib/local-db/transactions";
import { shouldResyncTransactionRelationIds } from "@/lib/local-db/transaction-relation-resync";

import { resyncTransactionRelationIdsIfNeeded } from "./bootstrap-local-data";

describe("resyncTransactionRelationIdsIfNeeded", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("keeps the transaction index complete while the replacement fetch is still running", async () => {
    await markSpaceTransactionIndexComplete("fintr");

    let rejectGet: (error: Error) => void = () => {};
    const api = {
      get: vi.fn(
        () =>
          new Promise((_resolve, reject) => {
            rejectGet = reject;
          }),
      ),
    } as unknown as AxiosInstance;

    const pending = resyncTransactionRelationIdsIfNeeded(
      api,
      new QueryClient(),
      ["fintr"],
    );

    await vi.waitFor(() => {
      expect(api.get).toHaveBeenCalled();
    });

    await expect(isSpaceTransactionIndexComplete("fintr")).resolves.toBe(true);

    rejectGet(new Error("stop"));
    await pending;

    await expect(shouldResyncTransactionRelationIds()).resolves.toBe(true);
  });
});
