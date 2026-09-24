import "fake-indexeddb/auto";

import { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { AxiosError } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import { resetLocalDbForTests } from "@/lib/local-db";
import { getSyncCursor, setSyncCursor } from "@/lib/local-db/sync-cursor";
import {
  offlineBootstrapDateRange,
} from "@/lib/local-sync/offline-bootstrap-dates";
import * as bootstrapLocalData from "./bootstrap-local-data";
import { pullSpaceChanges } from "./pull-space-changes";

/**
 * Integration-style test for the 100-day offline gap:
 * stale cursor → 410 → bootstrap → pull from oldestAvailableSeq.
 */
describe("long-offline sync integration", () => {
  const spaceId = "SPACE_OFFLINE_100";
  const bootstrapRange = offlineBootstrapDateRange();

  afterEach(async () => {
    await resetLocalDbForTests();
    vi.restoreAllMocks();
  });

  it("recovers peer changes after 100-day offline via bootstrap then pull", async () => {
    await setSyncCursor(spaceId, {
      lastPulledSeq: 1000,
      lastPulledAt: Date.now() - 100 * 24 * 60 * 60 * 1000,
    });

    const bootstrapSpy = vi
      .spyOn(bootstrapLocalData, "syncLocalDataFromBackend")
      .mockResolvedValue({
        dashboard: null,
        accounts: null,
        transactions: null,
        transactionPages: [],
        errors: [],
      });

    let pullCallCount = 0;
    const api = {
      get: vi.fn(async (path: string, config?: { params?: { since?: number } }) => {
        if (path === "/spaces/sync/changes") {
          pullCallCount += 1;
          const since = config?.params?.since ?? 0;

          if (pullCallCount === 1 && since === 1000) {
            throw new AxiosError(
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
                      oldestAvailableSeq: 5000,
                    },
                  },
                },
                headers: {},
                config: {} as never,
              },
            );
          }

          return {
            data: {
              data: {
                spaceId,
                since,
                latestSeq: 5002,
                oldestAvailableSeq: 5000,
                hasMore: false,
                changes: [
                  {
                    seq: 5001,
                    op: "transaction.created",
                    occurredAt: "2026-05-01T00:00:00.000Z",
                    payload: {
                      transactions: [{ id: "recovered-peer-tx" }],
                    },
                  },
                ],
              },
            },
          };
        }

        throw new Error(`Unexpected path: ${path}`);
      }),
    } as unknown as AxiosInstance;

    const queryClient = new QueryClient();

    const firstPull = await pullSpaceChanges({
      api,
      spaceId,
      queryClient,
    });

    expect(firstPull).toEqual({
      status: "bootstrap_required",
      oldestAvailableSeq: 5000,
    });

    await bootstrapLocalData.syncLocalDataFromBackend(api, queryClient, {
      spaceCode: spaceId,
      startDate: bootstrapRange.startDate,
      endDate: bootstrapRange.endDate,
    });

    expect(bootstrapSpy).toHaveBeenCalledWith(
      api,
      queryClient,
      {
        spaceCode: spaceId,
        startDate: bootstrapRange.startDate,
        endDate: bootstrapRange.endDate,
      },
    );

    await setSyncCursor(spaceId, {
      lastPulledSeq: 5000,
      lastPulledAt: Date.now(),
    });

    const applied: number[] = [];
    const secondPull = await pullSpaceChanges({
      api,
      spaceId,
      queryClient,
      applyChange: async ({ change }) => {
        applied.push(change.seq);
      },
    });

    expect(secondPull).toEqual({ status: "complete", latestSeq: 5002 });
    expect(applied).toEqual([5001]);

    const cursor = await getSyncCursor(spaceId);
    expect(cursor?.lastPulledSeq).toBe(5002);
  });
});
