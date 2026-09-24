import type { QueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "jotai";

import type { Space } from "@/types/spaceTypes";
import {
  showRealtimeSpaceCurrencyChangedToast,
  shouldShowRealtimeActorToast,
  type RealtimeTransactionActor,
} from "@/services/transactions/realtime-actor-toast";
import {
  cacheSpaceContext,
  cacheSpacesList,
  loadCachedSpaceContext,
  loadCachedSpacesList,
} from "@/services/spaces/spaces-list-cache";
import { invalidateSpaceFinancialQueries } from "@/utils/invalidateSpaceQueries";
import type { SpaceSettingsChangePayload } from "@/types/syncTypes";

export type ApplySpaceSettingsParams = {
  spaceId: string;
  subscriptionSpaceKey: string;
  payload: SpaceSettingsChangePayload;
  queryClient: QueryClient;
  setCurrentSpace?: (update: SetStateAction<Space | null>) => void;
  setAvailableSpaces?: (update: SetStateAction<Space[]>) => void;
  actor?: RealtimeTransactionActor | null;
  originTabId?: string | null;
  notifyActor?: boolean;
};

const matchesSpace = (
  space: { id: string; code: string },
  subscriptionSpaceKey: string,
  broadcastSpaceId: string,
): boolean =>
  space.id === broadcastSpaceId ||
  space.code === subscriptionSpaceKey ||
  space.id === subscriptionSpaceKey ||
  space.code === broadcastSpaceId;

export const applySpaceSettingsChange = async (
  params: ApplySpaceSettingsParams,
): Promise<void> => {
  const currency = params.payload.currency?.toUpperCase();
  if (!currency) {
    return;
  }

  const defaultTransactionCurrency =
    params.payload.defaultTransactionCurrency?.toUpperCase() ?? null;
  const broadcastSpaceId = params.payload.spaceId || params.spaceId;

  params.setCurrentSpace?.((current) => {
    if (!current || !matchesSpace(current, params.subscriptionSpaceKey, broadcastSpaceId)) {
      return current;
    }

    return {
      ...current,
      currency,
      defaultTransactionCurrency,
    };
  });

  params.setAvailableSpaces?.((spaces) =>
    spaces.map((space) =>
      matchesSpace(space, params.subscriptionSpaceKey, broadcastSpaceId)
        ? {
            ...space,
            currency,
            defaultTransactionCurrency,
          }
        : space,
    ),
  );

  try {
    const cachedSpaces = await loadCachedSpacesList();
    if (cachedSpaces) {
      await cacheSpacesList(
        cachedSpaces.map((space) =>
          matchesSpace(space, params.subscriptionSpaceKey, broadcastSpaceId)
            ? {
                ...space,
                currency,
                defaultTransactionCurrency,
              }
            : space,
        ),
      );
    }

    const cachedContext = await loadCachedSpaceContext(params.subscriptionSpaceKey);
    if (cachedContext?.space && matchesSpace(cachedContext.space, params.subscriptionSpaceKey, broadcastSpaceId)) {
      await cacheSpaceContext(params.subscriptionSpaceKey, {
        ...cachedContext,
        space: {
          ...cachedContext.space,
          currency,
          defaultTransactionCurrency,
        },
      });
    }
  } catch (error) {
    console.warn("[sync] Failed to persist space settings change locally", error);
  }

  await invalidateSpaceFinancialQueries(params.queryClient);
  await params.queryClient.invalidateQueries({ queryKey: ["spaces"] });
  await params.queryClient.invalidateQueries({
    queryKey: ["space-context", params.subscriptionSpaceKey],
  });
  await params.queryClient.invalidateQueries({ queryKey: ["space-context"] });

  if (
    params.notifyActor &&
    params.actor &&
    shouldShowRealtimeActorToast({
      actorAuthId: params.actor.authId,
      originTabId: params.originTabId ?? null,
    })
  ) {
    showRealtimeSpaceCurrencyChangedToast({ actor: params.actor });
  }
};
