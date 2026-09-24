import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { AxiosError } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { getAppliedSeqsMeta } from "@/lib/local-db/applied-seqs";
import { getSyncCursor, setSyncCursor } from "@/lib/local-db/sync-cursor";
import {
  bootstrapRequiredDetails,
  isBootstrapRequiredError,
} from "@/services/local-sync/sync-errors";

import { pullSpaceChanges } from "./pull-space-changes";

const spaceId = "SPACE100";

const goneResponse = (oldestAvailableSeq: number) =>
  new AxiosError(
    "Gone",
    "410",
    undefined,
    undefined,
    {
      status: 410,
      statusText: "Gone",
      data: {
        success: false,
        error: {
          message: "Cursor older than retained change log",
          details: {
            bootstrapRequired: true,
            oldestAvailableSeq,
          },
        },
      },
      headers: {},
      config: {} as never,
    },
  );

const createApiMock = (
  handlers: Array<(since: number) => unknown>,
): AxiosInstance => {
  let callIndex = 0;

  return {
    get: vi.fn(async (_path: string, config?: { params?: { since?: number } }) => {
      const since = config?.params?.since ?? 0;
      const handler = handlers[callIndex] ?? handlers[handlers.length - 1];
      callIndex += 1;
      const result = handler(since);

      if (result instanceof Error) {
        throw result;
      }

      return { data: { data: result } };
    }),
  } as unknown as AxiosInstance;
};

describe("pullSpaceChanges — 100-day offline scenario", () => {
  afterEach(async () => {
    await resetLocalDbForTests();
  });

  it("returns bootstrap_required when cursor predates retained log (410)", async () => {
    await setSyncCursor(spaceId, {
      lastPulledSeq: 1000,
      lastPulledAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
    });

    const api = createApiMock([() => goneResponse(5000)]);
    const queryClient = new QueryClient();

    const result = await pullSpaceChanges({
      api,
      spaceId,
      queryClient,
    });

    expect(result).toEqual({
      status: "bootstrap_required",
      oldestAvailableSeq: 5000,
    });
  });

  it("does not advance lastPulledSeq when bootstrap is required", async () => {
    await setSyncCursor(spaceId, {
      lastPulledSeq: 1000,
      lastPulledAt: 0,
    });

    const api = createApiMock([() => goneResponse(5000)]);
    const queryClient = new QueryClient();

    await pullSpaceChanges({ api, spaceId, queryClient });

    const cursor = await getSyncCursor(spaceId);
    expect(cursor?.lastPulledSeq).toBe(1000);
  });

  it("applies retained changes after bootstrap sets cursor to oldestAvailableSeq", async () => {
    const appliedSeqs: number[] = [];
    const applyChange = vi.fn(async ({ change }) => {
      appliedSeqs.push(change.seq);
    });

    await setSyncCursor(spaceId, {
      lastPulledSeq: 5000,
      lastPulledAt: Date.now(),
    });

    const api = createApiMock([
      () => ({
        spaceId,
        since: 5000,
        latestSeq: 5002,
        oldestAvailableSeq: 5000,
        hasMore: false,
        changes: [
          {
            seq: 5001,
            op: "transaction.created",
            occurredAt: "2026-05-01T00:00:00.000Z",
            payload: { transactions: [{ id: "peer-day-95" }] },
          },
          {
            seq: 5002,
            op: "transaction.created",
            occurredAt: "2026-08-01T00:00:00.000Z",
            payload: { transactions: [{ id: "peer-day-100" }] },
          },
        ],
      }),
    ]);

    const queryClient = new QueryClient();
    const result = await pullSpaceChanges({
      api,
      spaceId,
      queryClient,
      applyChange,
    });

    expect(result).toEqual({ status: "complete", latestSeq: 5002 });
    expect(appliedSeqs).toEqual([5001, 5002]);

    const cursor = await getSyncCursor(spaceId);
    expect(cursor?.lastPulledSeq).toBe(5002);
  });

  it("skips seq already applied via cable before pull replays", async () => {
    const appliedSeqs: number[] = [];
    const applyChange = vi.fn(async ({ spaceId: id, change }) => {
      const { markSeqApplied, isSeqApplied } = await import(
        "@/lib/local-db/applied-seqs"
      );
      if (change.seq > 0 && (await isSeqApplied(id, change.seq))) {
        return;
      }
      if (change.seq > 0) {
        appliedSeqs.push(change.seq);
        await markSeqApplied(id, change.seq);
      }
    });

    await setSyncCursor(spaceId, { lastPulledSeq: 5000, lastPulledAt: 0 });
    const { markSeqApplied } = await import("@/lib/local-db/applied-seqs");
    await markSeqApplied(spaceId, 5002);

    const api = createApiMock([
      () => ({
        spaceId,
        since: 5000,
        latestSeq: 5002,
        oldestAvailableSeq: 5000,
        hasMore: false,
        changes: [
          {
            seq: 5001,
            op: "transaction.created",
            occurredAt: "2026-05-01T00:00:00.000Z",
            payload: { transactions: [{ id: "peer-day-95" }] },
          },
          {
            seq: 5002,
            op: "transaction.created",
            occurredAt: "2026-08-01T00:00:00.000Z",
            payload: { transactions: [{ id: "peer-day-100" }] },
          },
        ],
      }),
    ]);

    const queryClient = new QueryClient();
    await pullSpaceChanges({
      api,
      spaceId,
      queryClient,
      applyChange,
    });

    expect(applyChange).toHaveBeenCalledTimes(2);
    expect(appliedSeqs).toEqual([5001]);
    const meta = await getAppliedSeqsMeta(spaceId);
    expect(meta.seqs).toContain(5001);
    expect(meta.seqs).toContain(5002);
  });
});

describe("isBootstrapRequiredError", () => {
  it("detects 410 bootstrapRequired payloads", () => {
    const error = goneResponse(5000);
    expect(isBootstrapRequiredError(error)).toBe(true);
    expect(bootstrapRequiredDetails(error)).toEqual({
      bootstrapRequired: true,
      oldestAvailableSeq: 5000,
    });
  });
});
