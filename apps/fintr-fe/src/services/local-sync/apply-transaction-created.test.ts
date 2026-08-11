import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import {
  loadLocalIndexTransactionById,
  upsertLocalIndexTransaction,
} from "@/services/transactions/local-cache";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

import { applyTransactionCreated } from "./apply-transaction-change";

const baseRow = {
  description: "Coffee",
  amount: 200,
  amountCurrency: "GBP",
  categoryName: "Food",
  fromAccountName: "Cash",
  toAccountName: "",
  type: CombinedTransactionTypeEnum.EXPENSE,
  inSeries: false,
  hasImage: false,
  categoryId: "11111111-1111-4111-8111-111111111111",
};

describe("applyTransactionCreated — optimistic reconcile", () => {
  const spaceId = "SPACE_CREATE_JANK";
  const queryKey = [
    "transactions",
    spaceId,
    "[]",
    "2026-08-01",
    "2026-08-31",
    "",
    "",
    "",
    "[]",
    "local",
  ];

  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("renames local:cid to the server id before upsert (no duplicate list row)", async () => {
    const queryClient = new QueryClient();
    const clientMutationId = "cid-smooth-1";
    const localId = `local:${clientMutationId}`;
    const serverId = "server-tx-1";

    const optimistic = {
      ...baseRow,
      id: localId,
      date: "2026-08-10",
      createdAt: "2026-08-10T10:00:00.000Z",
    };

    await upsertLocalIndexTransaction(spaceId, optimistic);
    queryClient.setQueryData(queryKey, {
      pages: [
        {
          transactions: [optimistic],
          nextPage: null,
          totalPages: 1,
          totalCount: 1,
          totals: { income: 0, expense: 200, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    await applyTransactionCreated({
      spaceId,
      queryClient,
      change: {
        seq: 12,
        op: "transaction.created",
        occurredAt: "2026-08-10T10:00:00.100Z",
        originClientMutationId: clientMutationId,
        payload: {
          transaction: {
            ...baseRow,
            id: serverId,
            date: "2026-08-10",
            createdAt: "2026-08-10T10:00:00.050Z",
            bookedAmount: 16414.84,
            bookedAmountCurrency: "PHP",
          },
        },
      },
      notifyActor: false,
    });

    const cached = queryClient.getQueryData<{
      pages: Array<{ transactions: Array<{ id: string; amount: number }> }>;
    }>(queryKey);

    expect(cached?.pages[0]?.transactions.map((row) => row.id)).toEqual([
      serverId,
    ]);
    expect(await loadLocalIndexTransactionById(spaceId, localId)).toBeUndefined();
    expect((await loadLocalIndexTransactionById(spaceId, serverId))?.id).toBe(
      serverId,
    );
  });

  it("keeps list position when server createdAt differs from optimistic", async () => {
    const queryClient = new QueryClient();
    const clientMutationId = "cid-smooth-2";
    const localId = `local:${clientMutationId}`;
    const serverId = "server-tx-2";

    const olderSameDay = {
      ...baseRow,
      id: "older-same-day",
      date: "2026-08-10",
      createdAt: "2026-08-10T09:00:00.000Z",
      description: "Earlier",
      amount: 10,
    };
    const optimistic = {
      ...baseRow,
      id: localId,
      date: "2026-08-10",
      createdAt: "2026-08-10T12:00:00.000Z",
    };

    await upsertLocalIndexTransaction(spaceId, olderSameDay);
    await upsertLocalIndexTransaction(spaceId, optimistic);
    queryClient.setQueryData(queryKey, {
      pages: [
        {
          transactions: [optimistic, olderSameDay],
          nextPage: null,
          totalPages: 1,
          totalCount: 2,
          totals: { income: 0, expense: 210, transfer: 0 },
        },
      ],
      pageParams: [1],
    });

    await applyTransactionCreated({
      spaceId,
      queryClient,
      change: {
        seq: 13,
        op: "transaction.created",
        occurredAt: "2026-08-10T12:00:00.100Z",
        originClientMutationId: clientMutationId,
        payload: {
          transaction: {
            ...baseRow,
            id: serverId,
            date: "2026-08-10",
            // Older than optimistic — would shove the row below olderSameDay
            // if we re-sorted on upsert.
            createdAt: "2026-08-10T08:00:00.000Z",
          },
        },
      },
      notifyActor: false,
    });

    const cached = queryClient.getQueryData<{
      pages: Array<{ transactions: Array<{ id: string }> }>;
    }>(queryKey);

    expect(cached?.pages[0]?.transactions.map((row) => row.id)).toEqual([
      serverId,
      "older-same-day",
    ]);
  });
});
