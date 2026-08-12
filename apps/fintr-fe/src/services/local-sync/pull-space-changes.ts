import type { QueryClient } from "@tanstack/react-query";
import type { AxiosInstance } from "axios";
import { isAxiosError } from "axios";

import { markSeqApplied, isSeqApplied } from "@/lib/local-db/applied-seqs";
import { setSyncCursor, getSyncCursor } from "@/lib/local-db/sync-cursor";
import type {
  PullChangesResponse,
  PullSpaceChangesResult,
  SpaceChange,
} from "@/types/syncTypes";

import { applySpaceChange } from "./apply-change";
import { bootstrapRequiredDetails, isBootstrapRequiredError } from "./sync-errors";
import { refreshReferenceDataCaches } from "./refresh-reference-data-caches";

const spaceRequestConfig = (spaceCode: string) => ({
  headers: {
    "X-Space-Code": spaceCode,
  },
});

export type ApplySpaceChangeFn = (params: {
  spaceId: string;
  change: SpaceChange;
  queryClient: QueryClient;
  source: "cable" | "pull";
}) => Promise<void>;

export const applySpaceChangeStub = async (params: {
  spaceId: string;
  change: SpaceChange;
}): Promise<void> => {
  if (params.change.seq > 0 && (await isSeqApplied(params.spaceId, params.change.seq))) {
    return;
  }

  if (params.change.seq > 0) {
    await markSeqApplied(params.spaceId, params.change.seq);
  }
};

export const pullSpaceChanges = async (params: {
  api: AxiosInstance;
  spaceId: string;
  queryClient: QueryClient;
  applyChange?: ApplySpaceChangeFn;
}): Promise<PullSpaceChangesResult> => {
  const applyChange =
    params.applyChange ??
    ((applyParams) =>
      applySpaceChange({
        ...applyParams,
        change: applyParams.change,
      }));
  const cursor = await getSyncCursor(params.spaceId);
  let since = cursor?.lastPulledSeq ?? 0;
  let latestSeq = since;

  try {
    while (true) {
      const response = await params.api.get("/spaces/sync/changes", {
        params: { since, limit: 500 },
        ...spaceRequestConfig(params.spaceId),
      });

      const data = response.data.data as PullChangesResponse;

      for (const change of data.changes) {
        await applyChange({
          spaceId: params.spaceId,
          change,
          queryClient: params.queryClient,
          source: "pull",
        });
      }

      latestSeq = data.latestSeq;

      if (!data.hasMore) {
        await setSyncCursor(params.spaceId, {
          lastPulledSeq: data.latestSeq,
          lastPulledAt: Date.now(),
        });

        if (
          typeof navigator === "undefined" ||
          navigator.onLine !== false
        ) {
          await refreshReferenceDataCaches({
            api: params.api,
            spaceCode: params.spaceId,
            queryClient: params.queryClient,
          });
        }

        return { status: "complete", latestSeq: data.latestSeq };
      }

      since = data.latestSeq;
    }
  } catch (error) {
    if (isBootstrapRequiredError(error)) {
      const details = bootstrapRequiredDetails(error);
      return {
        status: "bootstrap_required",
        oldestAvailableSeq: details?.oldestAvailableSeq ?? 0,
      };
    }

    if (isAxiosError(error)) {
      throw error;
    }

    throw error;
  }
};
