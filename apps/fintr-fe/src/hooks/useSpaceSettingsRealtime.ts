"use client";

import { useEffect, useRef } from "react";
import type { Subscription } from "@rails/actioncable";
import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";

import {
  createActionCableConsumer,
  getConsumer,
} from "@/lib/actionCable";
import { useAuthApi } from "@/hooks/useAuthApi";
import {
  currentSpaceAtom,
  availableSpacesAtom,
} from "@/atoms/spaceAtoms";
import { applySpaceChange } from "@/services/local-sync/apply-change";
import {
  cableMessageToSpaceChange,
  type CableInboundMessage,
} from "@/services/local-sync/normalize-cable-message";

/**
 * Live space settings updates via ActionCable SpacesChannel.
 */
export const useSpaceSettingsRealtime = (params: {
  spaceId: string;
  enabled?: boolean;
}): void => {
  const { spaceId, enabled = true } = params;
  const { getToken, isAuthenticated, isLoading } = useAuthApi();
  const queryClient = useQueryClient();
  const setCurrentSpace = useSetAtom(currentSpaceAtom);
  const setAvailableSpaces = useSetAtom(availableSpacesAtom);
  const subscriptionRef = useRef<Subscription | null>(null);
  const getTokenRef = useRef(getToken);
  const queryClientRef = useRef(queryClient);
  const setCurrentSpaceRef = useRef(setCurrentSpace);
  const setAvailableSpacesRef = useRef(setAvailableSpaces);

  getTokenRef.current = getToken;
  queryClientRef.current = queryClient;
  setCurrentSpaceRef.current = setCurrentSpace;
  setAvailableSpacesRef.current = setAvailableSpaces;

  const canSubscribe =
    enabled && Boolean(spaceId) && isAuthenticated && !isLoading;

  useEffect(() => {
    if (!canSubscribe) {
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
            channel: "SpacesChannel",
            space_id: spaceId,
          },
          {
            connected() {
              console.log("[realtime] Subscribed to SpacesChannel", spaceId);
            },
            received(data: CableInboundMessage) {
              console.log("[realtime] SpacesChannel message", data?.type);

              const change = cableMessageToSpaceChange(data);
              if (!change || change.op !== "space.settings.updated") {
                return;
              }

              void applySpaceChange({
                spaceId,
                change,
                queryClient: queryClientRef.current,
                source: "cable",
                targetSpace: spaceId,
                setCurrentSpace: setCurrentSpaceRef.current,
                setAvailableSpaces: setAvailableSpacesRef.current,
              });
            },
            rejected() {
              console.warn(
                "[realtime] SpacesChannel subscription rejected",
                spaceId,
              );
            },
            disconnected() {
              console.warn("[realtime] SpacesChannel disconnected", spaceId);
            },
          },
        );
      } catch (error) {
        console.warn("[realtime] Failed to subscribe to space settings", error);
      }
    };

    void connect();

    return () => {
      cancelled = true;
      const subscription = subscriptionRef.current;
      subscriptionRef.current = null;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [canSubscribe, spaceId]);
};
