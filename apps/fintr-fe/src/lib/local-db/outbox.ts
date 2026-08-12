import { getLocalDb } from "./db";
import type { LocalOutboxRecord, LocalOutboxStatus } from "./types";

export const OUTBOX_COMMAND_TRANSACTION_CREATE = "transaction.create";
export const OUTBOX_COMMAND_TRANSACTION_DELETE = "transaction.delete";
export const OUTBOX_COMMAND_TRANSACTION_UPDATE = "transaction.update";
export const OUTBOX_COMMAND_TRANSFER_CREATE = "transfer.create";
export const OUTBOX_COMMAND_TRANSFER_DELETE = "transfer.delete";
export const OUTBOX_COMMAND_TRANSFER_UPDATE = "transfer.update";
export const OUTBOX_COMMAND_LOAN_CREATE = "loan.create";
export const OUTBOX_COMMAND_LOAN_DELETE = "loan.delete";
export const OUTBOX_COMMAND_LOAN_UPDATE = "loan.update";
export const OUTBOX_COMMAND_LOAN_PAYMENT_CREATE = "loan_payment.create";
export const OUTBOX_COMMAND_LOAN_PAYMENT_DELETE = "loan_payment.delete";
export const OUTBOX_COMMAND_LOAN_PAYMENT_UPDATE = "loan_payment.update";
export const OUTBOX_COMMAND_SPACE_SETTINGS_UPDATE = "space.settings.update";
export const OUTBOX_COMMAND_USER_SETTINGS_UPDATE = "user.settings.update";

/** Outbox rows that are not scoped to a real space (e.g. profile updates). */
export const OUTBOX_SPACE_ID_USER = "__user__";

/** Recover rows stuck in `syncing` longer than this (ms). */
export const OUTBOX_STUCK_SYNCING_MS = 5 * 60 * 1000;

const now = (): number => Date.now();

export const enqueueOutboxRecord = async (params: {
  spaceId: string;
  commandType: string;
  payload: unknown;
  clientMutationId: string;
}): Promise<LocalOutboxRecord> => {
  const record: LocalOutboxRecord = {
    id: params.clientMutationId,
    spaceId: params.spaceId,
    commandType: params.commandType,
    payload: params.payload,
    clientMutationId: params.clientMutationId,
    status: "pending",
    createdAt: now(),
    updatedAt: now(),
  };

  await getLocalDb().outbox.put(record);
  return record;
};

export const updateOutboxStatus = async (params: {
  id: string;
  status: LocalOutboxStatus;
  lastError?: string;
}): Promise<void> => {
  const db = getLocalDb();
  const existing = await db.outbox.get(params.id);
  if (!existing) {
    return;
  }

  await db.outbox.put({
    ...existing,
    status: params.status,
    lastError: params.lastError,
    updatedAt: now(),
  });
};

export const removeOutboxRecord = async (id: string): Promise<void> => {
  await getLocalDb().outbox.delete(id);
};

/**
 * Pending (and stuck syncing) outbox rows for a space, oldest first.
 */
export const listPendingOutboxOrdered = async (params: {
  spaceId: string;
  stuckSyncingMs?: number;
}): Promise<LocalOutboxRecord[]> => {
  const stuckMs = params.stuckSyncingMs ?? OUTBOX_STUCK_SYNCING_MS;
  const cutoff = now() - stuckMs;
  const db = getLocalDb();
  const rows = await db.outbox
    .where("spaceId")
    .equals(params.spaceId)
    .toArray();

  return rows
    .filter((row) => {
      if (row.status === "pending") return true;
      if (row.status === "syncing" && row.updatedAt <= cutoff) return true;
      return false;
    })
    .sort((a, b) => a.createdAt - b.createdAt);
};

export const claimOutboxRecord = async (id: string): Promise<boolean> => {
  const db = getLocalDb();
  const existing = await db.outbox.get(id);
  if (!existing) return false;
  if (existing.status === "failed") return false;

  await db.outbox.put({
    ...existing,
    status: "syncing",
    updatedAt: now(),
    lastError: undefined,
  });
  return true;
};

export const listDistinctOutboxSpaceIds = async (): Promise<string[]> => {
  const rows = await getLocalDb().outbox.toArray();
  return Array.from(
    new Set(
      rows
        .filter((row) => row.status === "pending" || row.status === "syncing")
        .map((row) => row.spaceId),
    ),
  );
};
