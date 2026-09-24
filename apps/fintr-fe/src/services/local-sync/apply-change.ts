import type { QueryClient } from "@tanstack/react-query";
import type { SetStateAction } from "jotai";

import { isSeqApplied, markSeqApplied } from "@/lib/local-db/applied-seqs";
import type { Space } from "@/types/spaceTypes";
import type { SpaceChange, SpaceSettingsChangePayload } from "@/types/syncTypes";

import {
  applyLoanCreated,
  applyLoanDeleted,
  applyLoanPaymentCreated,
  applyLoanPaymentDeleted,
  applyLoanPaymentUpdated,
  applyLoanUpdated,
} from "./apply-loan-change";
import { applySpaceSettingsChange } from "./apply-settings-change";
import {
  applyTransactionCreated,
  applyTransactionDeleted,
  applyTransactionUpdated,
} from "./apply-transaction-change";

export type ApplySpaceChangeParams = {
  spaceId: string;
  change: SpaceChange & {
    originTabId?: string;
    suppressActorToast?: boolean;
  };
  queryClient: QueryClient;
  source: "cable" | "pull";
  targetSpace?: string;
  selfAuthId?: string;
  setCurrentSpace?: (update: SetStateAction<Space | null>) => void;
  setAvailableSpaces?: (update: SetStateAction<Space[]>) => void;
};

export const applySpaceChange = async (
  params: ApplySpaceChangeParams,
): Promise<void> => {
  const { spaceId, change, queryClient, source } = params;
  const targetSpace = params.targetSpace ?? spaceId;
  const notifyActor = source === "cable";

  if (change.seq > 0 && (await isSeqApplied(spaceId, change.seq))) {
    return;
  }

  switch (change.op) {
    case "transaction.created":
      await applyTransactionCreated({
        spaceId,
        change,
        queryClient,
        targetSpace,
        selfAuthId: params.selfAuthId,
        originTabId: change.originTabId ?? null,
        suppressActorToast: change.suppressActorToast,
        notifyActor,
      });
      break;
    case "transaction.updated":
      await applyTransactionUpdated({
        spaceId,
        change,
        queryClient,
        targetSpace,
        selfAuthId: params.selfAuthId,
        originTabId: change.originTabId ?? null,
        suppressActorToast: change.suppressActorToast,
        notifyActor,
      });
      break;
    case "transaction.deleted":
      await applyTransactionDeleted({
        spaceId,
        change,
        queryClient,
        targetSpace,
        selfAuthId: params.selfAuthId,
        originTabId: change.originTabId ?? null,
        suppressActorToast: change.suppressActorToast,
        notifyActor,
      });
      break;
    case "space.settings.updated":
      await applySpaceSettingsChange({
        spaceId,
        subscriptionSpaceKey: targetSpace,
        payload: change.payload as SpaceSettingsChangePayload,
        queryClient,
        setCurrentSpace: params.setCurrentSpace,
        setAvailableSpaces: params.setAvailableSpaces,
        actor: change.actor
          ? {
              userId: change.actor.userId,
              authId: change.actor.authId,
              fullName: change.actor.fullName,
              photoUrl: change.actor.photoUrl ?? null,
            }
          : null,
        originTabId: change.originTabId ?? null,
        notifyActor,
      });
      break;
    case "loan.created":
      await applyLoanCreated({
        spaceId,
        targetSpace,
        change,
        queryClient,
      });
      break;
    case "loan.updated":
      await applyLoanUpdated({
        spaceId,
        targetSpace,
        change,
        queryClient,
      });
      break;
    case "loan.deleted":
      await applyLoanDeleted({
        spaceId,
        targetSpace,
        change,
        queryClient,
      });
      break;
    case "loan_payment.created":
      await applyLoanPaymentCreated({
        spaceId,
        targetSpace,
        change,
        queryClient,
      });
      break;
    case "loan_payment.updated":
      await applyLoanPaymentUpdated({
        spaceId,
        targetSpace,
        change,
        queryClient,
      });
      break;
    case "loan_payment.deleted":
      await applyLoanPaymentDeleted({
        spaceId,
        targetSpace,
        change,
        queryClient,
      });
      break;
    default:
      console.warn("[sync] Unknown op", change.op);
      return;
  }

  if (change.seq > 0) {
    await markSeqApplied(spaceId, change.seq);
  }
};
