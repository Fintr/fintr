"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Subscription } from "@rails/actioncable";

import {
  createActionCableConsumer,
  getConsumer,
} from "@/lib/actionCable";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthApi } from "@/hooks/useAuthApi";

export type TransactionEditorPresence = {
  userId: string;
  authId: string;
  fullName: string;
  photoUrl?: string | null;
  startedAt: string;
};

type EditorsMessage = {
  type?: string;
  editors?: TransactionEditorPresence[];
};

const compareEditorsByPresence = (
  left: TransactionEditorPresence,
  right: TransactionEditorPresence,
): number => {
  const byStartedAt = left.startedAt.localeCompare(right.startedAt);
  if (byStartedAt !== 0) {
    return byStartedAt;
  }

  return left.userId.localeCompare(right.userId);
};

/**
 * ActionCable presence for the transaction edit dialog (FIN-195).
 * First editor (earliest startedAt) keeps write access; later joiners are soft-locked.
 */
export const useTransactionEditingPresence = (params: {
  spaceId: string;
  transactionId: string | null | undefined;
  enabled: boolean;
}): {
  editors: TransactionEditorPresence[];
  primaryEditor: TransactionEditorPresence | null;
  lockingEditor: TransactionEditorPresence | null;
  isLockedByOther: boolean;
  lockMessage: string | null;
} => {
  const { spaceId, transactionId, enabled } = params;
  const { user } = useAuth();
  const { getToken, isAuthenticated, isLoading } = useAuthApi();
  const [editors, setEditors] = useState<TransactionEditorPresence[]>([]);
  const subscriptionRef = useRef<Subscription | null>(null);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const canSubscribe =
    enabled &&
    isAuthenticated &&
    !isLoading &&
    Boolean(spaceId) &&
    Boolean(transactionId) &&
    !String(transactionId).startsWith("local:");

  useEffect(() => {
    if (!canSubscribe || !transactionId) {
      setEditors([]);
      return;
    }

    let cancelled = false;

    const connect = async () => {
      try {
        const consumer =
          getConsumer() ??
          (await createActionCableConsumer(() => getTokenRef.current()));
        if (cancelled) return;

        subscriptionRef.current = consumer.subscriptions.create(
          {
            channel: "TransactionEditingChannel",
            space_id: spaceId,
            transaction_id: transactionId,
          },
          {
            connected() {
              this.perform("start_editing");
            },
            received(data: EditorsMessage) {
              if (data?.type === "editors" && Array.isArray(data.editors)) {
                setEditors(data.editors);
              }
            },
            disconnected() {
              // no-op; reconnect rebuilds consumer elsewhere
            },
            rejected() {
              setEditors([]);
            },
          },
        );
      } catch (error) {
        console.warn("[presence] Failed to subscribe to transaction editing", error);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      const subscription = subscriptionRef.current;
      subscriptionRef.current = null;
      if (subscription) {
        try {
          subscription.perform("stop_editing");
        } catch {
          // ignore
        }
        subscription.unsubscribe();
      }
      setEditors([]);
    };
  }, [canSubscribe, spaceId, transactionId]);

  const selfAuthId = user?.sub ?? "";

  const primaryEditor = useMemo(() => {
    if (editors.length === 0) {
      return null;
    }

    return [...editors].sort(compareEditorsByPresence)[0] ?? null;
  }, [editors]);

  const isSelfPrimaryEditor = Boolean(
    primaryEditor &&
      selfAuthId &&
      primaryEditor.authId === selfAuthId,
  );

  const lockingEditor =
    primaryEditor && selfAuthId && !isSelfPrimaryEditor
      ? primaryEditor
      : null;

  const isLockedByOther = lockingEditor != null;
  const lockMessage = lockingEditor
    ? `${lockingEditor.fullName || "Someone"} is editing this transaction`
    : null;

  return {
    editors,
    primaryEditor,
    lockingEditor,
    isLockedByOther,
    lockMessage,
  };
};
