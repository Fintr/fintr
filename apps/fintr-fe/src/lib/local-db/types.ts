export type LocalMetaKey =
  | "schemaVersion"
  | `syncCursor:${string}`
  | `accountsSyncedAt:${string}`
  | `accountsResponse:${string}`;

export type LocalAccountRecord = {
  /**
   * Composite key: `${spaceId}:${accountId}`
   */
  key: string;
  spaceId: string;
  id: string;
  name: string;
  balance: string;
  balanceCurrency: string;
  accountCategory: string;
  createdAt?: string;
  updatedAt?: string;
  cachedAt: number;
};

export type LocalOutboxStatus = "pending" | "syncing" | "failed";

/**
 * Mutation queue for local-first writes (FIN-195).
 * Create path enqueues pending records; a full background drain is still follow-up.
 */
export type LocalOutboxRecord = {
  id: string;
  spaceId: string;
  commandType: string;
  payload: unknown;
  clientMutationId: string;
  status: LocalOutboxStatus;
  createdAt: number;
  updatedAt: number;
  lastError?: string;
};

export type LocalMetaRecord = {
  key: LocalMetaKey | string;
  value: unknown;
};

/** Normalized local transaction row (IndexedDB entity table, not a response snapshot). */
export type LocalTransactionRecord = {
  /** Composite key: `${spaceId}:${transactionId}` */
  key: string;
  spaceId: string;
  id: string;
  /** YYYY-MM-DD — indexed for range queries */
  date: string;
  type: string;
  categoryId: string;
  payload: import("@/types/transactionTypes").IndexTransaction;
  updatedAt: number;
};
