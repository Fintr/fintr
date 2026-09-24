import { isRealtimeOriginFromThisTab } from "@/lib/client-tab-id";
import type { IndexTransaction } from "@/types/transactionTypes";

import {
  showRealtimeTransactionActorToast,
  type RealtimeTransactionActor,
  type RealtimeTransactionToastAction,
} from "./realtime-actor-toast";

export const shouldNotifyRealtimeActor = (params: {
  suppressActorToast?: boolean;
  originTabId?: string | null;
  actorAuthId?: string | null;
}): boolean => {
  if (params.suppressActorToast) {
    return false;
  }

  if (isRealtimeOriginFromThisTab(params.originTabId)) {
    return false;
  }

  return Boolean(params.actorAuthId?.trim());
};

export const normalizeRealtimeActor = (
  payload: Record<string, unknown> | undefined,
): RealtimeTransactionActor | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const authId =
    payload.authId == null ? "" : String(payload.authId).trim();
  if (!authId) {
    return null;
  }

  return {
    userId:
      payload.userId == null || payload.userId === ""
        ? undefined
        : String(payload.userId),
    authId,
    fullName:
      payload.fullName == null || payload.fullName === ""
        ? undefined
        : String(payload.fullName),
    photoUrl:
      payload.photoUrl == null
        ? null
        : String(payload.photoUrl) || null,
  };
};

export const notifyRealtimeTransactionActor = (params: {
  action: RealtimeTransactionToastAction;
  actorPayload: Record<string, unknown> | undefined;
  originTabId?: string | null;
  selfAuthId?: string | null;
  transaction?: IndexTransaction | null;
  transactionIds?: string[];
  suppressActorToast?: boolean;
}): void => {
  const actor = normalizeRealtimeActor(params.actorPayload);
  if (
    !shouldNotifyRealtimeActor({
      suppressActorToast: params.suppressActorToast,
      originTabId: params.originTabId,
      actorAuthId: actor?.authId,
    })
  ) {
    return;
  }

  if (!actor) {
    return;
  }

  showRealtimeTransactionActorToast({
    action: params.action,
    actor,
    selfAuthId: params.selfAuthId,
    transaction: params.transaction ?? null,
  });
};
