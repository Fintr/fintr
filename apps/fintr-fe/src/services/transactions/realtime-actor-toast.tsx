"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { isRealtimeOriginFromThisTab } from "@/lib/client-tab-id";
import { requestOpenTransaction } from "@/lib/open-transaction-request";
import { toastSurfaceClassName } from "@/lib/toast-styles";
import type { IndexTransaction } from "@/types/transactionTypes";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";

export type RealtimeTransactionActor = {
  userId?: string;
  authId?: string;
  fullName?: string;
  photoUrl?: string | null;
};

export type RealtimeTransactionToastAction =
  | "added"
  | "updated"
  | "deleted";

/** @deprecated Prefer shouldNotifyRealtimeActor — kept for space settings toasts. */
export const shouldShowRealtimeActorToast = (params: {
  actorAuthId?: string | null;
  originTabId?: string | null;
  isLocalEcho?: boolean;
}): boolean => {
  if (params.isLocalEcho) {
    return false;
  }

  if (isRealtimeOriginFromThisTab(params.originTabId)) {
    return false;
  }

  return Boolean(params.actorAuthId?.trim());
};

export const realtimeTransactionToastMessage = (params: {
  action: RealtimeTransactionToastAction;
  fullName?: string | null;
  transactionType?: CombinedTransactionTypeEnum;
}): string => {
  const name = params.fullName?.trim() || "Someone";

  if (params.transactionType === CombinedTransactionTypeEnum.LOAN_PAYMENT) {
    switch (params.action) {
      case "added":
        return `${name} has recorded a loan payment`;
      case "updated":
        return `${name} has updated a loan payment`;
      case "deleted":
        return `${name} has deleted a loan payment`;
    }
  }

  switch (params.action) {
    case "added":
      return `${name} has added a transaction`;
    case "updated":
      return `${name} has updated a transaction`;
    case "deleted":
      return `${name} has deleted a transaction`;
  }
};

export const realtimeSpaceCurrencyChangedMessage = (
  fullName?: string | null,
): string => {
  const name = fullName?.trim() || "Someone";
  return `${name} changed the currency`;
};

export const formatToastTransactionNote = (
  description?: string | null,
  maxLength = 80,
): string | null => {
  const trimmed = description?.trim() ?? "";
  if (!trimmed) {
    return null;
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(1, maxLength - 1))}…`;
};

const initialsFromName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const RealtimeActorToastContent = (params: {
  action: RealtimeTransactionToastAction;
  actor: RealtimeTransactionActor;
  note: string | null;
  transactionType?: CombinedTransactionTypeEnum;
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const fullName = params.actor.fullName?.trim() || "Someone";
  const initials = initialsFromName(fullName);
  const showImage = Boolean(params.actor.photoUrl) && !imageFailed;
  const message = realtimeTransactionToastMessage({
    action: params.action,
    fullName,
    transactionType: params.transactionType,
  });

  useEffect(() => {
    setImageFailed(false);
  }, [params.actor.photoUrl]);

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold text-foreground ring-1 ring-border"
        aria-hidden
      >
        {showImage ? (
          <img
            src={params.actor.photoUrl ?? undefined}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span>{initials || "?"}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground">
          <span className="font-medium">{fullName}</span>
          {message.slice(fullName.length)}
        </p>
        {params.note ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {params.note}
          </p>
        ) : null}
      </div>
    </div>
  );
};

const RealtimeActorMessageToastContent = (params: {
  actor: RealtimeTransactionActor;
  message: string;
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const fullName = params.actor.fullName?.trim() || "Someone";
  const initials = initialsFromName(fullName);
  const showImage = Boolean(params.actor.photoUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [params.actor.photoUrl]);

  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[11px] font-semibold text-foreground ring-1 ring-border"
        aria-hidden
      >
        {showImage ? (
          <img
            src={params.actor.photoUrl ?? undefined}
            alt=""
            className="h-full w-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span>{initials || "?"}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-foreground">
          <span className="font-medium">{fullName}</span>
          {params.message.slice(fullName.length)}
        </p>
      </div>
    </div>
  );
};

/** Toast for a realtime transaction event. Caller must gate with shouldNotifyRealtimeActor. */
export const showRealtimeTransactionActorToast = (params: {
  action: RealtimeTransactionToastAction;
  actor: RealtimeTransactionActor;
  selfAuthId?: string | null;
  transaction?: IndexTransaction | null;
}): void => {
  const note = formatToastTransactionNote(params.transaction?.description);
  const canOpen =
    params.action !== "deleted" && Boolean(params.transaction?.id);

  toast.custom(
    (toastId) => {
      const content = (
        <RealtimeActorToastContent
          action={params.action}
          actor={params.actor}
          note={note}
          transactionType={params.transaction?.type}
        />
      );

      if (!canOpen || !params.transaction) {
        return (
          <div className={`w-full ${toastSurfaceClassName} px-3 py-2.5`}>
            {content}
          </div>
        );
      }

      return (
        <button
          type="button"
          aria-label="Open transaction"
          className={`w-full cursor-pointer ${toastSurfaceClassName} px-3 py-2.5 text-left transition-colors hover:bg-muted/40`}
          onClick={() => {
            requestOpenTransaction(params.transaction!);
            toast.dismiss(toastId);
          }}
        >
          {content}
        </button>
      );
    },
    { duration: 4500 },
  );
};

/** Peer-only toast when another member changes space currency settings. */
export const showRealtimeSpaceCurrencyChangedToast = (params: {
  actor: RealtimeTransactionActor;
}): void => {
  if (!shouldShowRealtimeActorToast({ actorAuthId: params.actor.authId })) {
    return;
  }

  const fullName = params.actor.fullName?.trim() || "Someone";
  const message = realtimeSpaceCurrencyChangedMessage(fullName);

  toast.custom(
    () => (
      <div className={`w-full ${toastSurfaceClassName} px-3 py-2.5`}>
        <RealtimeActorMessageToastContent
          actor={params.actor}
          message={message}
        />
      </div>
    ),
    { duration: 4500 },
  );
};
