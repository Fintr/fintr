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

const pickField = (
  payload: Record<string, unknown>,
  camel: string,
  snake: string,
): unknown => payload[camel] ?? payload[snake];

export const normalizeRealtimeIndexTransaction = (
  payload: Record<string, unknown>,
): IndexTransactionWithCategoryIds | null => {
  const id = asString(pickField(payload, "id", "id"));
  if (!id) return null;

  const tags = parseRealtimeTransactionTags(payload);

  return {
    id,
    date: asString(pickField(payload, "date", "date")),
    description: asString(pickField(payload, "description", "description")),
    amount: asNumber(pickField(payload, "amount", "amount")),
    amountCurrency: pickField(payload, "amountCurrency", "amount_currency")
      ? asString(pickField(payload, "amountCurrency", "amount_currency"))
      : undefined,
    bookedAmount:
      pickField(payload, "bookedAmount", "booked_amount") != null
        ? asNumber(pickField(payload, "bookedAmount", "booked_amount"))
        : undefined,
    bookedAmountCurrency: pickField(
      payload,
      "bookedAmountCurrency",
      "booked_amount_currency",
    )
      ? asString(
          pickField(payload, "bookedAmountCurrency", "booked_amount_currency"),
        )
      : undefined,
    createdAt: pickField(payload, "createdAt", "created_at")
      ? asString(pickField(payload, "createdAt", "created_at"))
      : new Date().toISOString(),
    categoryName: asString(
      pickField(payload, "categoryName", "category_name"),
    ),
    subcategoryName:
      pickField(payload, "subcategoryName", "subcategory_name") == null
        ? null
        : asString(
            pickField(payload, "subcategoryName", "subcategory_name"),
          ),
    fromAccountName: asString(
      pickField(payload, "fromAccountName", "from_account_name"),
    ),
    toAccountName: asString(
      pickField(payload, "toAccountName", "to_account_name"),
    ),
    type: asType(pickField(payload, "type", "type")),
    inSeries: Boolean(
      pickField(payload, "inSeries", "in_series") ?? false,
    ),
    hasImage: Boolean(
      pickField(payload, "hasImage", "has_image") ?? false,
    ),
    hasLoanPayment: Boolean(
      pickField(payload, "hasLoanPayment", "has_loan_payment") ?? false,
    ),
    calculated:
      pickField(payload, "calculated", "calculated") == null
        ? undefined
        : Boolean(pickField(payload, "calculated", "calculated")),
    activitableId: pickField(payload, "activitableId", "activitable_id")
      ? asString(pickField(payload, "activitableId", "activitable_id"))
      : id,
    isLoanActivity:
      pickField(payload, "isLoanActivity", "is_loan_activity") == null
        ? undefined
        : Boolean(
            pickField(payload, "isLoanActivity", "is_loan_activity"),
          ),
    loanType: pickField(payload, "loanType", "loan_type") as
      IndexTransactionWithCategoryIds["loanType"],
    loanId: pickField(payload, "loanId", "loan_id")
      ? asString(pickField(payload, "loanId", "loan_id"))
      : undefined,
    entityName: pickField(payload, "entityName", "entity_name")
      ? asString(pickField(payload, "entityName", "entity_name"))
      : undefined,
    categoryId: pickField(payload, "categoryId", "category_id")
      ? asString(pickField(payload, "categoryId", "category_id"))
      : null,
    subcategoryId: pickField(payload, "subcategoryId", "subcategory_id")
      ? asString(pickField(payload, "subcategoryId", "subcategory_id"))
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
