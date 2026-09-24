import type {
  CableInboundMessage,
  CableLegacySettingsMessage,
  CableSyncMessage,
  SpaceChange,
  SpaceChangeOp,
  SpaceSettingsChangePayload,
  SyncActor,
  SyncIndexTransaction,
  TransactionChangePayload,
} from "@/types/syncTypes";

export type { CableInboundMessage };

const legacyOpMap = {
  transaction_created: "transaction.created",
  transaction_updated: "transaction.updated",
  transaction_deleted: "transaction.deleted",
} as const satisfies Record<string, SpaceChangeOp>;

const asString = (value: unknown): string =>
  value == null ? "" : String(value);

const normalizeActor = (
  actor: Record<string, unknown> | SyncActor | undefined,
): SyncActor | undefined => {
  if (!actor || typeof actor !== "object") {
    return undefined;
  }

  const userId = String(
    (actor as SyncActor).userId ??
      (actor as Record<string, unknown>).userId ??
      (actor as Record<string, unknown>).user_id ??
      "",
  );
  const authId = String(
    (actor as SyncActor).authId ??
      (actor as Record<string, unknown>).authId ??
      (actor as Record<string, unknown>).auth_id ??
      "",
  );
  const fullName = String(
    (actor as SyncActor).fullName ??
      (actor as Record<string, unknown>).fullName ??
      (actor as Record<string, unknown>).full_name ??
      "",
  );
  const photoUrlRaw =
    (actor as SyncActor).photoUrl ??
    (actor as Record<string, unknown>).photoUrl ??
    (actor as Record<string, unknown>).photo_url;

  if (!userId && !authId) {
    return undefined;
  }

  return {
    userId,
    authId,
    fullName,
    photoUrl: photoUrlRaw ? String(photoUrlRaw) : undefined,
  };
};

const legacyTransactionPayload = (
  message: Extract<CableInboundMessage, { type: string }>,
): TransactionChangePayload | null => {
  if (!("transaction" in message) && !("transactions" in message)) {
    return null;
  }

  if (Array.isArray(message.transactions) && message.transactions.length > 0) {
    return {
      transactions: message.transactions as SyncIndexTransaction[],
    };
  }

  if (message.transaction) {
    return {
      transaction: message.transaction as SyncIndexTransaction,
    };
  }

  return null;
};

const legacySettingsPayload = (
  message: CableLegacySettingsMessage,
): SpaceSettingsChangePayload | null => {
  const currency = asString(message.currency);
  if (!currency) {
    return null;
  }

  return {
    spaceId: asString(message.spaceId) || undefined,
    currency,
    defaultTransactionCurrency: message.defaultTransactionCurrency,
  };
};

export const cableMessageToSpaceChange = (
  message: CableInboundMessage,
): (SpaceChange & {
  originTabId?: string;
  suppressActorToast?: boolean;
}) | null => {
  if (message.type === "sync_change") {
    return {
      seq: message.seq,
      op: message.op,
      occurredAt: message.occurredAt ?? new Date().toISOString(),
      payload: message.payload,
      actor: normalizeActor(message.actor),
      originClientMutationId: message.originClientMutationId,
      originTabId: message.originTabId,
      suppressActorToast: message.suppressActorToast,
    };
  }

  if (message.type === "space_currency_changed") {
    const payload = legacySettingsPayload(message);
    if (!payload) {
      return null;
    }

    return {
      seq: 0,
      op: "space.settings.updated",
      occurredAt: new Date().toISOString(),
      payload,
      actor: normalizeActor(message.actor),
      originTabId: message.originTabId,
    };
  }

  const op = legacyOpMap[message.type as keyof typeof legacyOpMap];
  if (!op) {
    return null;
  }

  const payload = legacyTransactionPayload(message);
  if (!payload) {
    return null;
  }

  return {
    seq: 0,
    op,
    occurredAt: new Date().toISOString(),
    payload,
    actor: normalizeActor(message.actor),
    originTabId: message.originTabId,
    suppressActorToast:
      "suppressActorToast" in message ? message.suppressActorToast : undefined,
  };
};

export type { CableSyncMessage };
