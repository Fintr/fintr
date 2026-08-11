"use client";

import { useEffect, useRef } from "react";
import type { Subscription } from "@rails/actioncable";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";

import {
  createActionCableConsumer,
  getConsumer,
} from "@/lib/actionCable";
import { isSpaceSyncPullEnabled } from "@/lib/space-sync-feature-flag";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthApi } from "@/hooks/useAuthApi";
import { applySpaceChange } from "@/services/local-sync/apply-change";
import {
  asTargetSpace,
} from "@/services/local-sync/apply-transaction-change";
import {
  cableMessageToSpaceChange,
  type CableInboundMessage,
} from "@/services/local-sync/normalize-cable-message";
import {
  schedulePullForSpace,
} from "@/services/local-sync/sync-coordinator";
import {
  type IndexTransactionWithCategoryIds,
} from "@/services/transactions/upsert-into-query-caches";
import { CombinedTransactionTypeEnum } from "@/types/transactionTypes";
import type { TransactionTag } from "@/types/transactionTagTypes";

type TransactionRealtimeMessage = CableInboundMessage & Record<string, unknown>;

const asString = (value: unknown): string =>
  value == null ? "" : String(value);

const asNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseRealtimeTransactionTags = (
  payload: Record<string, unknown>,
): TransactionTag[] | undefined => {
  const raw = payload.tags;
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const tags = raw
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = asString(record.id);
      const name = asString(record.name);
      const color = asString(record.color);
      if (!id || !name) {
        return null;
      }

      return {
        id,
        name,
        color: color || "#000000",
        isDefault: Boolean(record.isDefault ?? record.is_default),
        styleImageUrl: asString(
          record.styleImageUrl ?? record.style_image_url,
        ) || undefined,
      } satisfies TransactionTag;
    })
    .filter((tag): tag is TransactionTag => tag !== null);

  return tags;
};

const asType = (value: unknown): CombinedTransactionTypeEnum => {
  const raw = asString(value);
  if (
    Object.values(CombinedTransactionTypeEnum).includes(
      raw as CombinedTransactionTypeEnum,
    )
  ) {
    return raw as CombinedTransactionTypeEnum;
  }
  return CombinedTransactionTypeEnum.EXPENSE;
};

export const normalizeRealtimeIndexTransaction = (
  payload: Record<string, unknown>,
): IndexTransactionWithCategoryIds | null => {
  const id = asString(payload.id);
  if (!id) return null;

  const tags = parseRealtimeTransactionTags(payload);

  return {
    id,
    date: asString(payload.date),
    description: asString(payload.description),
    amount: asNumber(payload.amount),
    amountCurrency: payload.amountCurrency
      ? asString(payload.amountCurrency)
      : undefined,
    bookedAmount:
      payload.bookedAmount != null ? asNumber(payload.bookedAmount) : undefined,
    bookedAmountCurrency: payload.bookedAmountCurrency
      ? asString(payload.bookedAmountCurrency)
      : undefined,
    createdAt: payload.createdAt
      ? asString(payload.createdAt)
      : new Date().toISOString(),
    categoryName: asString(payload.categoryName),
    subcategoryName:
      payload.subcategoryName == null
        ? null
        : asString(payload.subcategoryName),
    fromAccountName: asString(payload.fromAccountName),
    toAccountName: asString(payload.toAccountName),
    type: asType(payload.type),
    inSeries: Boolean(payload.inSeries),
    hasImage: Boolean(payload.hasImage),
    hasLoanPayment: Boolean(payload.hasLoanPayment),
    calculated: payload.calculated == null ? undefined : Boolean(payload.calculated),
    activitableId: payload.activitableId
      ? asString(payload.activitableId)
      : id,
    isLoanActivity:
      payload.isLoanActivity == null
        ? undefined
        : Boolean(payload.isLoanActivity),
    loanType: payload.loanType as IndexTransactionWithCategoryIds["loanType"],
    loanId: payload.loanId ? asString(payload.loanId) : undefined,
    entityName: payload.entityName ? asString(payload.entityName) : undefined,
    categoryId: payload.categoryId ? asString(payload.categoryId) : null,
    subcategoryId: payload.subcategoryId
      ? asString(payload.subcategoryId)
      : null,
    ...(tags && tags.length > 0
      ? {
          tags,
          tagIds: tags.map((tag) => tag.id),
        }
      : {}),
  };
};

const handleRealtimeMessage = async (params: {
  data: TransactionRealtimeMessage;
  spaceId: string;
  client: QueryClient;
  selfAuthId: string;
  api: ReturnType<typeof useAuthApi>["api"];
}): Promise<void> => {
  const { data, spaceId, client, selfAuthId } = params;
  const change = cableMessageToSpaceChange(data);
  if (!change) {
    return;
  }

  const targetSpace = asTargetSpace(spaceId, data.spaceId);

  await applySpaceChange({
    spaceId,
    change,
    queryClient: client,
    source: "cable",
    targetSpace,
    selfAuthId,
  });
};

/**
 * Live transaction list updates via ActionCable TransactionsChannel.
 */
export const useTransactionsRealtime = (params: {
  spaceId: string;
  enabled?: boolean;
}): void => {
  const { spaceId, enabled = true } = params;
  const { user } = useAuth();
  const { getToken, isAuthenticated, isLoading, api } = useAuthApi();
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<Subscription | null>(null);
  const getTokenRef = useRef(getToken);
  const queryClientRef = useRef(queryClient);
  const selfAuthIdRef = useRef(user?.sub ?? "");
  const apiRef = useRef(api);

  getTokenRef.current = getToken;
  queryClientRef.current = queryClient;
  selfAuthIdRef.current = user?.sub ?? "";
  apiRef.current = api;

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
            channel: "TransactionsChannel",
            space_id: spaceId,
          },
          {
            connected() {
              console.log(
                "[realtime] Subscribed to TransactionsChannel",
                spaceId,
              );
            },
            received(data: TransactionRealtimeMessage) {
              console.log("[realtime] TransactionsChannel message", data?.type);
              void handleRealtimeMessage({
                data,
                spaceId,
                client: queryClientRef.current,
                selfAuthId: selfAuthIdRef.current,
                api: apiRef.current,
              });
            },
            rejected() {
              console.warn(
                "[realtime] TransactionsChannel subscription rejected",
                spaceId,
              );
            },
            disconnected() {
              console.warn(
                "[realtime] TransactionsChannel disconnected",
                spaceId,
              );

              if (
                !isSpaceSyncPullEnabled() ||
                !apiRef.current ||
                !spaceId
              ) {
                return;
              }

              void schedulePullForSpace(
                {
                  api: apiRef.current,
                  queryClient: queryClientRef.current,
                  spaceCodes: [spaceId],
                },
                spaceId,
                "cable_disconnect",
              );
            },
          },
        );
      } catch (error) {
        console.warn("[realtime] Failed to subscribe to transactions", error);
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
